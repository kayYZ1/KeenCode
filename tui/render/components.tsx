import { toAnsi } from "@/tui/core/primitives/color.ts";
import { type MarkdownSegment, parseMarkdown } from "@/tui/core/primitives/parse-markdown.ts";
import { useScrollArea } from "./hooks/scroll-area.ts";
import { useSignal, useSignalEffect } from "./hooks/signals.ts";
import type {
	BoxProps,
	MarkdownProps,
	ScrollAreaProps,
	SpinnerProps,
	TextInputProps,
	TextProps,
} from "./types/index.ts";

const SPINNER_FRAME_COUNT = 10;

export function Box(props: BoxProps) {
	return <box {...props} />;
}

export function Text(props: TextProps) {
	return <text {...props} />;
}

export function TextInput(props: TextInputProps) {
	return <textInput {...props} />;
}

export function Spinner(props: SpinnerProps) {
	const frame = useSignal(0);
	const interval = props.interval ?? 80;

	useSignalEffect(() => {
		const timer = setInterval(() => {
			frame.value = (frame.value + 1) % SPINNER_FRAME_COUNT;
		}, interval);
		return () => clearInterval(timer);
	});

	return <spinner {...props} frame={frame.value} />;
}

function childrenToString(children: unknown): string {
	if (children == null || children === false) return "";
	if (typeof children === "string") return children;
	if (typeof children === "number") return String(children);
	if (Array.isArray(children)) return children.map(childrenToString).join("");
	return "";
}

function formatSegment(segment: MarkdownSegment): string {
	let text = segment.text;
	if (segment.color) {
		const ansi = toAnsi(segment.color);
		if (ansi) text = `${ansi}${text}\x1b[0m`;
	}
	if (segment.bold) text = `\x1b[1m${text}\x1b[22m`;
	if (segment.italic) text = `\x1b[3m${text}\x1b[23m`;
	if (segment.strikethrough) text = `\x1b[9m${text}\x1b[29m`;
	return text;
}

export function ScrollArea(props: ScrollAreaProps & { autoScroll?: boolean }) {
	const { focused, scrollStep, autoScroll, ...rest } = props;
	const scroll = useScrollArea({ focused, scrollStep, autoScroll });
	return (
		<scrollArea
			{...rest}
			scrollOffset={scroll.scrollOffset.value}
			onMetrics={scroll.onMetrics}
			onScrollOffsetChange={scroll.onScrollOffsetChange}
		/>
	);
}

export { CommandPalette } from "./components/command-palette.tsx";

export function Markdown(props: MarkdownProps) {
	const content = childrenToString(props.children);
	const lines = parseMarkdown(content);

	return (
		<Box flexDirection="column" width={props.width} height={props.height} flex={props.flex}>
			{lines.map((line, i) => {
				const formattedLine = line.segments.map(formatSegment).join("");
				return <Text key={i}>{formattedLine}</Text>;
			})}
		</Box>
	);
}
