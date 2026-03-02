import { run as runAgent } from "@/core/agent.ts";
import type { Message, ProviderConfig } from "@/api/types.ts";
import { CompletionsProvider } from "@/api/providers/completions.ts";
import { createToolRegistry, defaultTools } from "@/core/tools/index.ts";
import { run } from "@/tui/render/index.ts";
import { Box, CommandPalette, Markdown, ScrollArea, Spinner, Text, TextInput } from "@/tui/render/components.tsx";
import { getHookKey, hasCleanup, setCleanup, useSignal } from "@/tui/render/hooks/signals.ts";
import { useTextInput, type VimMode } from "@/tui/render/hooks/text-input.ts";
import { type CommandPaletteItem, useCommandPalette } from "@/tui/render/hooks/command-palette.ts";
import { inputManager } from "@/tui/core/input.ts";
import "@std/dotenv/load";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const apiKey = Deno.env.get("LLM_API_KEY");
const baseURL = Deno.env.get("LLM_BASE_URL");
const model = Deno.env.get("LLM_MODEL_URL");

if (!apiKey) {
	console.error("Set LLM_API_KEY in .env file");
	Deno.exit(1);
}

if (!baseURL) {
	console.error("Set LLM_BASE_URL in .env file");
	Deno.exit(1);
}

if (!model) {
	console.error("Set LLM_MODEL_URL in .env file");
	Deno.exit(1);
}

const providerConfig: ProviderConfig = { apiKey, baseURL };
const provider = new CompletionsProvider(providerConfig);
const tools = createToolRegistry(defaultTools);

const SYSTEM_PROMPT =
	`You are a coding assistant running in a terminal. You have access to tools for reading files, writing files, searching code, and running shell commands.

## Available Tools

- Read files, search code with grep, write/edit files, run shell commands
- Use tools to accomplish tasks efficiently. Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety concerns.

## Code Style

- Keep functions short and focused
- Avoid try/catch where possible
- Prefer const over let; use ternaries or early returns instead of reassignment
- Use functional array methods (flatMap, filter, map) over for loops
- Avoid unnecessary destructuring; use dot notation to preserve context

## Project Context

- When starting a new task, check for AGENTS.md in the project root and relevant subdirectories
- Read any AGENTS.md files you find to understand project-specific rules, conventions, and structure
- Follow the instructions in those files when working on the project

Be concise and direct in responses.`;

// ---------------------------------------------------------------------------
// UI Types
// ---------------------------------------------------------------------------

interface UIToolCall {
	name: string;
	input: string;
	output: string;
}

interface UIMessage {
	role: "user" | "agent";
	content: string;
	toolCalls?: UIToolCall[];
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const COMMANDS: CommandPaletteItem[] = [
	{ id: "new-chat", title: "New Chat", description: "Start a new conversation", keywords: ["clear", "reset"] },
	{ id: "quit", title: "Quit", description: "Exit the agent", keywords: ["exit", "close"] },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function StatusBar({ model, tokenCount, totalCost }: { model: string; tokenCount: number; totalCost: number }) {
	return (
		<Box flexDirection="row" justifyContent="space-between" padding={1}>
			<Box flexDirection="row" gap={1}>
				<Text bold color="cyan">
					TinyAgent
				</Text>
				<Text color="gray">│</Text>
				<Text color="yellow">{model}</Text>
			</Box>
			<Box flexDirection="row" gap={4}>
				<Box flexDirection="row" gap={1}>
					<Text color="gray">tokens:</Text>
					<Text color="white">{tokenCount}</Text>
				</Box>
				<Box flexDirection="row" gap={1}>
					<Text color="gray">cost:</Text>
					<Text color="green">${totalCost > 0 ? `${totalCost.toFixed(4)}` : "-"}</Text>
				</Box>
			</Box>
		</Box>
	);
}

function ToolCallView({ tool }: { key?: number; tool: UIToolCall }) {
	const output = getToolDisplayOutput(tool);
	return (
		<Box flexDirection="column">
			<Box flexDirection="row" gap={1}>
				<Text color="yellow" bold>
					⚡ {tool.name}
				</Text>
				<Text color="gray">{tool.input}</Text>
			</Box>
			{output && (
				<Box flexDirection="row">
					<Text color="gray">  {output}</Text>
				</Box>
			)}
		</Box>
	);
}

function getToolDisplayOutput(tool: UIToolCall): string | null {
	if (!tool.output) return null;
	switch (tool.name) {
		case "read_file":
			return null;
		case "glob": {
			const files = tool.output.split("\n").filter(Boolean);
			return files.join(", ");
		}
		default:
			return tool.output.length > 200 ? tool.output.slice(0, 200) + "..." : tool.output;
	}
}

function MessageView({ msg }: { key?: number; msg: UIMessage }) {
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
			{msg.content && (
				<Box flexDirection="row" gap={1}>
					<Text color="blue" bold>
						●
					</Text>
					<Markdown flex>{msg.content}</Markdown>
				</Box>
			)}
		</Box>
	);
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

function App() {
	const input = useSignal("");
	const cursor = useSignal(0);
	const mode = useSignal<VimMode>("INSERT");
	const isLoading = useSignal(false);
	const statusText = useSignal("Thinking...");
	const tokenCount = useSignal(0);
	const totalCost = useSignal(0);
	const sessionId = useSignal(0);
	const uiMessages = useSignal<UIMessage[]>([]);
	const conversationHistory = useSignal<Message[]>([]);
	const abortController = useSignal<AbortController | null>(null);
	const cancelPrimed = useSignal(false);

	// Double-CTRL+C to cancel: first CTRL+C primes, second aborts
	const cancelKey = getHookKey("cancel-");
	if (!hasCleanup(cancelKey)) {
		const cleanup = inputManager.onKeyGlobal((event) => {
			if (event.key !== "c" || !event.ctrl || !isLoading.value) return false;
			if (!cancelPrimed.value) {
				cancelPrimed.value = true;
				setTimeout(() => {
					cancelPrimed.value = false;
				}, 1500);
				return true;
			}
			abortController.value?.abort();
			cancelPrimed.value = false;
			return true;
		});
		setCleanup(cancelKey, cleanup);
	}

	const handleSubmit = (value: string) => {
		if (!value.trim() || isLoading.value) return;

		uiMessages.value = [...uiMessages.value, { role: "user", content: value }];
		conversationHistory.value = [...conversationHistory.value, { role: "user", content: value }];
		input.value = "";
		cursor.value = 0;
		isLoading.value = true;
		statusText.value = "Thinking...";
		const ac = new AbortController();
		abortController.value = ac;

		(async () => {
			let currentText = "";
			const currentToolCalls: UIToolCall[] = [];
			const toolCallState = new Map<string, { name: string; args: string }>();

			const events = runAgent(conversationHistory.value, {
				provider,
				tools,
				model: model,
				systemPrompt: SYSTEM_PROMPT,
				temperature: 0.6,
				contextLimit: { maxTokens: 100_000, preserveRecentTurns: 4 },
				signal: ac.signal,
			});

			for await (const event of events) {
				switch (event.type) {
					case "text_delta": {
						statusText.value = "Writing...";
						currentText += event.content;
						updateAgentMessage(uiMessages, currentText, currentToolCalls);
						break;
					}
					case "tool_call_start": {
						statusText.value = `Running ${event.name}...`;
						toolCallState.set(event.id, { name: event.name, args: "" });
						break;
					}
					case "tool_call_args_delta": {
						const tc = toolCallState.get(event.id);
						if (tc) tc.args += event.args;
						break;
					}
					case "tool_call_end": {
						const tc = toolCallState.get(event.id);
						if (tc) {
							currentToolCalls.push({
								name: tc.name,
								input: formatToolInput(tc.name, tc.args),
								output: "",
							});
							updateAgentMessage(uiMessages, currentText, currentToolCalls);
						}
						break;
					}
					case "tool_result": {
						const tc = toolCallState.get(event.id);
						if (tc) {
							const idx = currentToolCalls.findIndex((t) => t.name === tc.name && !t.output);
							if (idx !== -1) {
								currentToolCalls[idx] = { ...currentToolCalls[idx], output: event.result.content };
							}
							updateAgentMessage(uiMessages, currentText, currentToolCalls);
						}
						break;
					}
					case "message_complete": {
						if (event.usage) {
							tokenCount.value += event.usage.prompt_tokens + event.usage.completion_tokens;
							// Some providers return cost directly in usage
							if (event.usage.cost) {
								totalCost.value += event.usage.cost;
							}
						}
						if (event.generationId) {
							const sid = sessionId.value;
							provider.getGenerationStats(event.generationId).then((stats) => {
								if (!stats || sessionId.value !== sid) return;
								if (stats.totalCost !== null) totalCost.value += stats.totalCost;
								// Fallback: use generation stats for tokens if streaming didn't provide usage
								if (!event.usage && stats.promptTokens !== null && stats.completionTokens !== null) {
									tokenCount.value += stats.promptTokens + stats.completionTokens;
								}
							});
						}
						// Reset for next LLM round (after tool execution)
						currentText = "";
						statusText.value = "Thinking...";
						break;
					}
					case "error": {
						if (ac.signal.aborted) break;
						uiMessages.value = [
							...uiMessages.value,
							{ role: "agent", content: `**Error:** ${event.error.message}` },
						];
						break;
					}
				}
				if (ac.signal.aborted) break;
			}

			// Sync final assistant content back to conversation history
			const lastUI = uiMessages.value[uiMessages.value.length - 1];
			if (lastUI?.role === "agent" && lastUI.content) {
				conversationHistory.value = [
					...conversationHistory.value,
					{ role: "assistant", content: lastUI.content },
				];
			}

			isLoading.value = false;
			abortController.value = null;
			cancelPrimed.value = false;
		})();
	};

	const palette = useCommandPalette({
		items: COMMANDS,
		onSelect: (item) => {
			if (item.id === "new-chat") {
				uiMessages.value = [];
				conversationHistory.value = [];
				tokenCount.value = 0;
				totalCost.value = 0;
				sessionId.value++;
			} else if (item.id === "quit") {
				quitRef.current?.();
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
		<Box flex flexDirection="column" padding={1}>
			<StatusBar model={model} tokenCount={tokenCount.value} totalCost={totalCost.value} />

			<ScrollArea flex flexDirection="column" gap={1} padding={1} scrollbar focused autoScroll>
				{uiMessages.value.map((msg, i) => <MessageView key={i} msg={msg} />)}
			</ScrollArea>

			<Box height={1} />
			<Box border="round" borderColor="white" borderLabel={mode.value} borderLabelColor="white" padding={1}>
				<TextInput
					value={input.value}
					cursorPosition={cursor.value}
					cursorStyle={cursorStyle}
					placeholder="Awaiting instructions..."
					placeholderColor="gray"
					focused
				/>
			</Box>

			<Box flexDirection="row" justifyContent="space-between" padding={1}>
				<Box flexDirection="row" gap={1}>
					{isLoading.value && (
						<>
							<Spinner color="cyan" />
							<Text color="gray" bold italic>
								{statusText.value}
							</Text>
							{cancelPrimed.value
								? (
									<Text color="yellow" bold>
										Press Ctrl+C again to cancel
									</Text>
								)
								: (
									<Text color="gray" italic>
										Ctrl+C to cancel
									</Text>
								)}
						</>
					)}
				</Box>
				<Text color="gray" italic>
					Enter to send • / for commands • PageUp/PageDown to scroll • i/Esc to toggle mode
				</Text>
			</Box>

			<CommandPalette palette={palette} />
		</Box>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function updateAgentMessage(
	uiMessages: { value: UIMessage[] },
	content: string,
	toolCalls: UIToolCall[],
) {
	const msgs = [...uiMessages.value];
	const last = msgs[msgs.length - 1];
	if (last?.role === "agent") {
		msgs[msgs.length - 1] = { ...last, content, toolCalls: [...toolCalls] };
	} else {
		msgs.push({ role: "agent", content, toolCalls: [...toolCalls] });
	}
	uiMessages.value = msgs;
}

function formatToolInput(name: string, args: string): string {
	try {
		const parsed = JSON.parse(args);
		switch (name) {
			case "read_file":
				return parsed.path ?? args;
			case "glob":
				return parsed.pattern ?? args;
			case "grep":
				return parsed.pattern ?? args;
			case "bash":
				return parsed.command ?? args;
			default:
				return Object.entries(parsed)
					.map(([k, v]) => `${k}=${JSON.stringify(v)}`)
					.join(" ");
		}
	} catch {
		return args;
	}
}

const quitRef: { current: (() => void) | undefined } = { current: undefined };

const { unmount } = run(() => <App />);
quitRef.current = () => {
	unmount();
	Deno.exit(0);
};
