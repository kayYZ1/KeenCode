import type { Instance } from "@/tui/render/types/index.ts";
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
			text = `${bg}${text}\x1b[49m`;
		}
	}
	if (typeof instance.props.color === "string") {
		const ansi = toAnsi(instance.props.color);
		if (ansi) {
			text = `${ansi}${text}\x1b[39m`;
		}
	}
	if (instance.props.bold) text = `\x1b[1m${text}\x1b[22m`;
	if (instance.props.italic) text = `\x1b[3m${text}\x1b[23m`;
	if (instance.props.underline) text = `\x1b[4m${text}\x1b[24m`;
	if (instance.props.strikethrough) text = `\x1b[9m${text}\x1b[29m`;

	return text;
};
