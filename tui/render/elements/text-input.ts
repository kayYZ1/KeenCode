import { toAnsi } from "@/tui/core/primitives/color.ts";
import { splitText, wrapText } from "@/tui/core/primitives/wrap-text.ts";
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

	// Split text into lines based on width
	const textToSplit = displayText || "";
	const lines = useWordWrap ? wrapText(textToSplit, width) : splitText(textToSplit, width);

	// Calculate cursor line and column
	let cursorLine = 0;
	let cursorCol = 0;
	if (useWordWrap) {
		// For word-wrapped text, find cursor position by walking through lines
		let charCount = 0;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			const lineLen = line.length;
			const lineEnd = charCount + lineLen + (i < lines.length - 1 ? 1 : 0); // +1 for space between words
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

	// Trim or pad lines to fit height
	const displayLines = lines.slice(0, height);
	while (displayLines.length < height) {
		displayLines.push("");
	}

	const positions: Position[] = [];

	for (let lineIdx = 0; lineIdx < displayLines.length; lineIdx++) {
		const line = displayLines[lineIdx] ?? "";

		let formattedText = line.slice(0, width).padEnd(width, " ");

		const colorToUse = isPlaceholder ? instance.props.placeholderColor : instance.props.color;
		if (colorToUse) {
			const ansi = toAnsi(colorToUse);
			if (ansi) {
				formattedText = `${ansi}${formattedText}\x1b[0m`;
			}
		}

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
