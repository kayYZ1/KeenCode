import { run as runAgent } from "@/core/agent.ts";
import type { Message, ProviderConfig } from "@/api/types.ts";
import { CompletionsProvider } from "@/api/providers/completions.ts";
import { createToolRegistry, defaultTools } from "@/core/tools/index.ts";
import { run } from "@/tui/render/index.ts";
import { Box, CommandPalette, Markdown, ScrollArea, Spinner, Text, TextInput } from "@/tui/render/components.tsx";
import { useSignal } from "@/tui/render/hooks/signals.ts";
import { useTextInput, type VimMode } from "@/tui/render/hooks/text-input.ts";
import { type CommandPaletteItem, useCommandPalette } from "@/tui/render/hooks/command-palette.ts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const apiKey = Deno.env.get("LLM_API_KEY") ?? "";
const baseURL = Deno.env.get("LLM_BASE_URL") ?? "https://openrouter.ai/api/v1";
const defaultModel = Deno.env.get("LLM_MODEL") ?? "moonshotai/kimi-k2.5";

if (!apiKey) {
	console.error("Set LLM_API_KEY environment variable (and optionally LLM_BASE_URL, LLM_MODEL)");
	Deno.exit(1);
}

const providerConfig: ProviderConfig = { apiKey, baseURL, defaultModel };
const provider = new CompletionsProvider(providerConfig);
const tools = createToolRegistry(defaultTools);

const SYSTEM_PROMPT =
	`You are a helpful coding assistant. You have access to tools for reading files, writing files, searching code, and running shell commands. Use them to help the user with their tasks. Be concise and direct.`;

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
				{totalCost > 0 && (
					<Text color="gray">
						cost: <Text color="green">${totalCost.toFixed(4)}</Text>
					</Text>
				)}
			</Box>
		</Box>
	);
}

function ToolCallView({ tool }: { key?: number; tool: UIToolCall }) {
	return (
		<Box flexDirection="column">
			<Box flexDirection="row" gap={1}>
				<Text color="yellow" bold>
					⚡ {tool.name}
				</Text>
				<Text color="gray">{tool.input}</Text>
			</Box>
			{tool.output && (
				<Box padding={1}>
					<Text color="gray" italic>
						{tool.output.length > 200 ? tool.output.slice(0, 200) + "..." : tool.output}
					</Text>
				</Box>
			)}
		</Box>
	);
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
	const tokenCount = useSignal(0);
	const totalCost = useSignal(0);
	const sessionId = useSignal(0);
	const uiMessages = useSignal<UIMessage[]>([]);
	const conversationHistory = useSignal<Message[]>([]);

	const handleSubmit = (value: string) => {
		if (!value.trim() || isLoading.value) return;

		uiMessages.value = [...uiMessages.value, { role: "user", content: value }];
		conversationHistory.value = [...conversationHistory.value, { role: "user", content: value }];
		input.value = "";
		cursor.value = 0;
		isLoading.value = true;

		(async () => {
			let currentText = "";
			const currentToolCalls: UIToolCall[] = [];
			const toolCallState = new Map<string, { name: string; args: string }>();

			const events = runAgent(conversationHistory.value, {
				provider,
				tools,
				model: defaultModel,
				systemPrompt: SYSTEM_PROMPT,
				temperature: 0.6,
			});

			for await (const event of events) {
				switch (event.type) {
					case "text_delta": {
						currentText += event.content;
						updateAgentMessage(uiMessages, currentText, currentToolCalls);
						break;
					}
					case "tool_call_start": {
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
								input: formatToolInput(tc.args),
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
						}
						if (event.generationId) {
							const sid = sessionId.value;
							provider.getGenerationCost(event.generationId).then((cost) => {
								if (cost !== null && sessionId.value === sid) totalCost.value += cost;
							});
						}
						// Reset for next LLM round (after tool execution)
						currentText = "";
						break;
					}
					case "error": {
						uiMessages.value = [
							...uiMessages.value,
							{ role: "agent", content: `**Error:** ${event.error.message}` },
						];
						break;
					}
				}
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
				Deno.exit(0);
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
			<StatusBar model={defaultModel} tokenCount={tokenCount.value} totalCost={totalCost.value} />

			<ScrollArea flex flexDirection="column" gap={1} padding={1} scrollbar focused autoScroll>
				{uiMessages.value.map((msg, i) => <MessageView key={i} msg={msg} />)}
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
	const msg: UIMessage = {
		role: "agent",
		content,
		toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
	};
	if (last?.role === "agent") {
		msgs[msgs.length - 1] = msg;
	} else {
		msgs.push(msg);
	}
	uiMessages.value = msgs;
}

function formatToolInput(argsJson: string): string {
	try {
		const parsed = JSON.parse(argsJson);
		return parsed.command ?? parsed.pattern ?? parsed.path ?? argsJson;
	} catch {
		return argsJson;
	}
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

run(() => <App />);
