import type { Position } from "@/tui/render/types/index.ts";
import { toAnsi, toBgAnsi } from "./color.ts";

export type BorderStyle = "single" | "double" | "round" | "bold" | "dash" | "block";

const BORDER_CHARS: Record<BorderStyle, { h: string; v: string; tl: string; tr: string; bl: string; br: string }> = {
	single: { h: "─", v: "│", tl: "┌", tr: "┐", bl: "└", br: "┘" },
	double: { h: "═", v: "║", tl: "╔", tr: "╗", bl: "╚", br: "╝" },
	round: { h: "─", v: "│", tl: "╭", tr: "╮", bl: "╰", br: "╯" },
	bold: { h: "━", v: "┃", tl: "┏", tr: "┓", bl: "┗", br: "┛" },
	dash: { h: "┄", v: "┆", tl: "┌", tr: "┐", bl: "└", br: "┘" },
	block: { h: "█", v: "█", tl: "█", tr: "█", bl: "█", br: "█" },
};

export interface DrawBoxOptions {
	x: number;
	y: number;
	w: number;
	h: number;
	style?: BorderStyle;
	color?: string;
	label?: string;
	labelColor?: string;
	bgColor?: string;
}

export const drawBox = (
	x: number,
	y: number,
	w: number,
	h: number,
	style: BorderStyle = "single",
	color?: string,
	label?: string,
	labelColor?: string,
	bgColor?: string,
): Position[] => {
	if (w < 2 || h < 2) return [];

	const chars = BORDER_CHARS[style];
	const positions: Position[] = [];

	const wrap = (char?: string, overrideColor?: string) => {
		if (!char) return "";
		let result = char;
		const c = overrideColor ?? color;
		if (c) {
			const ansi = toAnsi(c);
			if (ansi) result = `${ansi}${result}\x1b[39m`;
		}
		if (bgColor) {
			const bg = toBgAnsi(bgColor);
			if (bg) result = `${bg}${result}\x1b[49m`;
		}
		return result;
	};

	positions.push({ x, y, text: wrap(chars.tl) });
	positions.push({ x: x + w - 1, y, text: wrap(chars.tr) });
	positions.push({ x, y: y + h - 1, text: wrap(chars.bl) });
	positions.push({ x: x + w - 1, y: y + h - 1, text: wrap(chars.br) });

	const labelText = label ? ` ${label} ` : "";
	const labelLen = labelText.length;
	const labelStart = 2;

	for (let i = 1; i < w - 1; i++) {
		if (label && i >= labelStart && i < labelStart + labelLen) {
			const charIndex = i - labelStart;
			positions.push({
				x: x + i,
				y,
				text: wrap(labelText[charIndex], labelColor),
			});
		} else {
			positions.push({ x: x + i, y, text: wrap(chars.h) });
		}
		positions.push({ x: x + i, y: y + h - 1, text: wrap(chars.h) });
	}

	for (let i = 1; i < h - 1; i++) {
		positions.push({ x, y: y + i, text: wrap(chars.v) });
		positions.push({ x: x + w - 1, y: y + i, text: wrap(chars.v) });
	}

	return positions;
};
