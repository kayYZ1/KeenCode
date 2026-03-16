import { toAnsi } from "@/tui/core/primitives/color.ts";
import { splitTextWithOffsets, wrapText, wrapTextWithOffsets } from "@/tui/core/primitives/wrap-text.ts";
import type { CursorStyle, ElementHandler, Position, TextInputInstance } from "../types/index.ts";
import type { LayoutHandler } from "./index.ts";

export const TextInputLayout: LayoutHandler<TextInputInstance> = (instance) => {
	if (instance.props.width !== undefined) instance.yogaNode.setWidth(instance.props.width);
	else instance.yogaNode.setWidthAuto();

	const height = instance.props.height;
	if (height !== undefined) {
		instance.yogaNode.unsetMeasureFunc();
		instance.yogaNode.setHeight(height);
	} else {
		instance.yogaNode.setHeightAuto();
		instance.yogaNode.setMeasureFunc((width) => {
			const value = instance.props.value || instance.props.placeholder || "";
			const lines = wrapText(value, Math.floor(width));
			return { width, height: Math.max(1, lines.length) };
		});
	}
};

interface CursorInfo {
	x: number;
	y: number;
	visible: boolean;
	style?: CursorStyle;
}

let pendingCursor: CursorInfo | null = null;

export function getPendingCursor(): CursorInfo | null {
	return pendingCursor;
}

export function clearPendingCursor() {
	pendingCursor = null;
}

interface MentionRange {
	start: number;
	end: number;
}

const MENTION_RE = /(^|(?<=\s))@[^\s]+/g;

function findMentions(text: string): MentionRange[] {
	const ranges: MentionRange[] = [];
	for (const match of text.matchAll(MENTION_RE)) {
		ranges.push({ start: match.index!, end: match.index! + match[0].length });
	}
	return ranges;
}

function formatLineWithMentions(
	line: string,
	lineStart: number,
	width: number,
	mentions: MentionRange[],
	defaultAnsi: string | null,
	mentionAnsi: string,
): string {
	const padded = line.slice(0, width).padEnd(width, " ");
	if (mentions.length === 0) {
		if (defaultAnsi) return `${defaultAnsi}${padded}\x1b[0m`;
		return padded;
	}

	let result = "";
	let inMention = false;

	for (let i = 0; i < padded.length; i++) {
		const absIdx = lineStart + i;
		const isMention = i < line.length && mentions.some((m) => absIdx >= m.start && absIdx < m.end);

		if (isMention !== inMention) {
			if (isMention) {
				result += `${mentionAnsi}`;
			} else {
				result += `\x1b[0m${defaultAnsi ?? ""}`;
			}
			inMention = isMention;
		}
		result += padded[i];
	}

	result += "\x1b[0m";
	return result;
}

export function calculateCursorPosition(
	cursorPos: number,
	width: number,
	lines: string[],
	useWordWrap: boolean,
): { line: number; col: number } {
	let cursorLine = 0;
	let cursorCol = 0;
	if (useWordWrap) {
		let charCount = 0;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			const lineLen = line.length;
			const lineEnd = charCount + lineLen + (i < lines.length - 1 ? 1 : 0);
			if (cursorPos <= charCount + lineLen) {
				cursorLine = i;
				cursorCol = cursorPos - charCount;
				break;
			}
			charCount = lineEnd;
			cursorLine = i;
			cursorCol = lineLen;
		}
	} else {
		cursorLine = Math.floor(cursorPos / width);
		cursorCol = cursorPos % width;
	}
	return { line: cursorLine, col: cursorCol };
}

export const TextInputElement: ElementHandler<TextInputInstance> = (instance, context): Position[] => {
	const x = context.parentX + Math.round(instance.yogaNode.getComputedLeft());
	const y = context.parentY + Math.round(instance.yogaNode.getComputedTop());
	const width = Math.round(instance.yogaNode.getComputedWidth());
	const height = Math.round(instance.yogaNode.getComputedHeight());

	const value = instance.props.value || "";
	const placeholder = instance.props.placeholder || "";
	const displayText = value || placeholder;
	const isPlaceholder = !value && placeholder;
	const cursorPos = instance.props.cursorPosition ?? value.length;
	const useWordWrap = instance.props.height === undefined;

	// Split text into lines with offset tracking
	const textToSplit = displayText || "";
	const linesWithOffsets = useWordWrap
		? wrapTextWithOffsets(textToSplit, width)
		: splitTextWithOffsets(textToSplit, width);
	const lines = linesWithOffsets.map((l) => l.line);

	// Find @mention ranges in the original value
	const mentions = !isPlaceholder ? findMentions(value) : [];

	// Calculate cursor line and column
	const { line: cursorLine, col: cursorCol } = calculateCursorPosition(cursorPos, width, lines, useWordWrap);

	// Trim or pad lines to fit height
	const displayEntries = linesWithOffsets.slice(0, height);
	while (displayEntries.length < height) {
		displayEntries.push({ line: "", startIndex: 0 });
	}

	const positions: Position[] = [];
	const colorToUse = isPlaceholder ? instance.props.placeholderColor : instance.props.color;
	const defaultAnsi = colorToUse ? toAnsi(colorToUse) : null;
	const mentionAnsi = toAnsi("cyan") ?? "\x1b[36m";

	for (let lineIdx = 0; lineIdx < displayEntries.length; lineIdx++) {
		const entry = displayEntries[lineIdx];
		const formattedText = mentions.length > 0
			? formatLineWithMentions(entry.line, entry.startIndex, width, mentions, defaultAnsi, mentionAnsi)
			: (() => {
				let text = entry.line.slice(0, width).padEnd(width, " ");
				if (defaultAnsi) text = `${defaultAnsi}${text}\x1b[0m`;
				return text;
			})();

		positions.push({
			x,
			y: y + lineIdx,
			text: formattedText,
		});
	}

	if (instance.props.focused && cursorLine < height) {
		pendingCursor = {
			x: x + cursorCol,
			y: y + cursorLine,
			visible: true,
			style: instance.props.cursorStyle,
		};
	}

	return positions;
};
