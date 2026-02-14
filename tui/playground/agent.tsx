import { run } from "@/tui/render/index.ts";
import { Box, CommandPalette, Markdown, ScrollArea, Spinner, Text, TextInput } from "@/tui/render/components.tsx";
import { initDevTools } from "@/tui/dev/index.ts";
import { useSignal } from "@/tui/render/hooks/signals.ts";
import { useTextInput, type VimMode } from "@/tui/render/hooks/text-input.ts";
import { type CommandPaletteItem, useCommandPalette } from "@/tui/render/hooks/command-palette.ts";

interface ToolCall {
	name: string;
	input: string;
	output: string;
}

interface Message {
	role: "user" | "agent";
	content: string;
	toolCalls?: ToolCall[];
}

const COMMANDS: CommandPaletteItem[] = [
	{ id: "new-chat", title: "New Chat", description: "Start a new conversation", keywords: ["clear", "reset"] },
	{ id: "model", title: "Change Model", description: "Switch LLM model", keywords: ["provider", "llm"] },
	{ id: "compact", title: "Compact History", description: "Summarize conversation", keywords: ["compress"] },
	{ id: "copy", title: "Copy Last Response", description: "Copy to clipboard", keywords: ["clipboard"] },
	{ id: "clear", title: "Clear Screen", description: "Clear message history", keywords: ["reset"] },
	{ id: "help", title: "Help", description: "Show available commands", keywords: ["usage"] },
	{ id: "quit", title: "Quit", description: "Exit the agent", keywords: ["exit", "close"] },
];

const SIMULATED_RESPONSES: { content: string; toolCalls?: ToolCall[] }[] = [
	{
		content: "I'll read the file to understand its structure.",
		toolCalls: [
			{
				name: "Read",
				input: "src/index.ts",
				output: 'export function main() {\n  console.log("hello");\n}',
			},
		],
	},
	{
		content:
			'Here\'s what I found:\n\n```typescript\nexport function main() {\n  console.log("hello");\n}\n```\n\nThe file exports a `main` function that logs **hello** to the console. Want me to modify it?',
	},
	{
		content: "I'll search for related files first.",
		toolCalls: [
			{
				name: "Grep",
				input: '"import.*main" src/',
				output:
					"src/cli.ts:1: import { main } from './index.ts';\nsrc/test.ts:2: import { main } from './index.ts';",
			},
			{
				name: "Read",
				input: "src/cli.ts",
				output: 'import { main } from "./index.ts";\nmain();',
			},
		],
	},
	{
		content:
			"Found **2 files** that import `main`:\n\n1. `src/cli.ts` — entry point\n2. `src/test.ts` — test file\n\nI'll update both after modifying the *main* function.",
	},
	{
		content: "Let me make the edit.",
		toolCalls: [
			{
				name: "edit_file",
				input: "src/index.ts",
				output: "✓ Applied edit to src/index.ts",
			},
		],
	},
];

function StatusBar({ model, tokenCount }: { model: string; tokenCount: number }) {
	return (
		<Box flexDirection="row" justifyContent="space-between" padding={1}>
			<Box flexDirection="row" gap={2}>
				<Text bold color="cyan">
					TinyAgent
				</Text>
				<Text color="gray">│</Text>
				<Text color="yellow">{model}</Text>
			</Box>
			<Box flexDirection="row" gap={2}>
				<Text color="gray">
					tokens: <Text color="white">{tokenCount}</Text>
				</Text>
				<Text color="gray">│</Text>
				<Text color="green">~/projects/myapp</Text>
			</Box>
		</Box>
	);
}

function ToolCallView({ tool }: { tool: ToolCall }) {
	return (
		<Box flexDirection="column">
			<Box flexDirection="row" gap={1}>
				<Text color="yellow" bold>
					⚡ {tool.name}
				</Text>
				<Text color="gray">{tool.input}</Text>
			</Box>
			<Box padding={1}>
				<Text color="gray" italic>
					{tool.output}
				</Text>
			</Box>
		</Box>
	);
}

function MessageView({ msg }: { msg: Message }) {
	if (msg.role === "user") {
		return (
			<Box flexDirection="row" gap={1}>
				<Text color="green" bold>
					❯
				</Text>
				<Text flex color="white">
					{msg.content}
				</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" gap={1}>
			{msg.toolCalls?.map((tool, i) => <ToolCallView key={i} tool={tool} />)}
			<Box flexDirection="row" gap={1}>
				<Text color="blue" bold>
					●
				</Text>
				<Markdown flex>{msg.content}</Markdown>
			</Box>
		</Box>
	);
}

function Agent() {
	const input = useSignal("");
	const cursor = useSignal(0);
	const mode = useSignal<VimMode>("INSERT");
	const isLoading = useSignal(false);
	const model = useSignal("claude-sonnet-4-20250514");
	const tokenCount = useSignal(0);
	const responseIndex = useSignal(0);
	const messages = useSignal<Message[]>([
		{
			role: "agent",
			content:
				"Hello! I'm your coding assistant. I can **read files**, *search code*, and help you build things.\n\nWhat would you like to work on?",
		},
	]);

	const handleSubmit = (value: string) => {
		if (!value.trim() || isLoading.value) return;

		messages.value = [...messages.value, { role: "user", content: value }];
		input.value = "";
		cursor.value = 0;
		isLoading.value = true;
		tokenCount.value += value.length * 2;

		const idx = responseIndex.value % SIMULATED_RESPONSES.length;
		const response = SIMULATED_RESPONSES[idx];

		if (response.toolCalls) {
			setTimeout(() => {
				messages.value = [
					...messages.value,
					{ role: "agent", content: response.content, toolCalls: response.toolCalls },
				];
				tokenCount.value += response.content.length * 3;
				isLoading.value = false;
				responseIndex.value++;
			}, 2000);
		} else {
			setTimeout(() => {
				messages.value = [...messages.value, { role: "agent", content: response.content }];
				tokenCount.value += response.content.length * 3;
				isLoading.value = false;
				responseIndex.value++;
			}, 1500);
		}
	};

	const palette = useCommandPalette({
		items: COMMANDS,
		onSelect: (item) => {
			if (item.id === "new-chat" || item.id === "clear") {
				messages.value = [
					{
						role: "agent",
						content: "Chat cleared. How can I help you?",
					},
				];
				tokenCount.value = 0;
			} else if (item.id === "model") {
				model.value = model.value.includes("sonnet") ? "claude-opus-4-20250514" : "claude-sonnet-4-20250514";
			}
		},
	});

	const { cursorStyle } = useTextInput({
		value: input,
		cursorPosition: cursor,
		mode,
		focused: true,
		onSubmit: handleSubmit,
	});

	return (
		<Box flex flexDirection="column">
			<StatusBar model={model.value} tokenCount={tokenCount.value} />

			<ScrollArea flex flexDirection="column" gap={1} padding={1} scrollbar focused autoScroll>
				{messages.value.map((msg, i) => <MessageView key={i} msg={msg} />)}
				{isLoading.value && (
					<Box flexDirection="row" gap={1}>
						<Spinner color="cyan" />
						<Text color="gray" italic>
							Thinking...
						</Text>
					</Box>
				)}
			</ScrollArea>

			<Box border="round" borderColor="cyan" borderLabel={mode.value} borderLabelColor="cyan" padding={1}>
				<TextInput
					value={input.value}
					cursorPosition={cursor.value}
					cursorStyle={cursorStyle}
					placeholder="Ask me anything..."
					placeholderColor="gray"
					focused
				/>
			</Box>

			<Box padding={1}>
				<Text color="gray" italic>
					Enter to send • / for commands • PageUp/PageDown to scroll • i/Esc to toggle mode • Ctrl+C to exit
				</Text>
			</Box>

			<CommandPalette palette={palette} />
		</Box>
	);
}

initDevTools();
run(() => <Agent />);
