import type { Instance } from "@/tui/render/types/index.ts";
import {
	BOLD,
	BOLD_OFF,
	ITALIC,
	ITALIC_OFF,
	RESET_BG,
	RESET_FG,
	STRIKETHROUGH,
	STRIKETHROUGH_OFF,
	UNDERLINE,
	UNDERLINE_OFF,
} from "@/tui/core/ansi.ts";
import { toAnsi, toBgAnsi } from "./color.ts";

function childrenToString(children: unknown): string {
	if (children == null || children === false) return "";
	if (typeof children === "string") return children;
	if (typeof children === "number") return String(children);
	if (Array.isArray(children)) return children.map(childrenToString).join("");
	return "";
}

export const formatText = (instance: Instance): string => {
	if (instance.type !== "text") return "";

	let text = childrenToString(instance.props.children);

	if (typeof instance.props.bgColor === "string") {
		const bg = toBgAnsi(instance.props.bgColor);
		if (bg) {
			text = `${bg}${text}${RESET_BG}`;
		}
	}
	if (typeof instance.props.color === "string") {
		const ansi = toAnsi(instance.props.color);
		if (ansi) {
			text = `${ansi}${text}${RESET_FG}`;
		}
	}
	if (instance.props.bold) text = `${BOLD}${text}${BOLD_OFF}`;
	if (instance.props.italic) text = `${ITALIC}${text}${ITALIC_OFF}`;
	if (instance.props.underline) text = `${UNDERLINE}${text}${UNDERLINE_OFF}`;
	if (instance.props.strikethrough) text = `${STRIKETHROUGH}${text}${STRIKETHROUGH_OFF}`;

	return text;
};
