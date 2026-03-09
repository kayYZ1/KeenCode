import { run as runAgent } from "@/core/agent.ts";
import { CompletionsProvider } from "@/api/providers/completions.ts";
import { createToolRegistry, defaultTools } from "@/core/tools/index.ts";
import { entriesToMessages, type Entry, SessionManager } from "@/core/sessions/index.ts";
import { run } from "@/tui/render/index.ts";
import { Box, CommandPalette, Markdown, ScrollArea, Spinner, Text, TextInput } from "@/tui/render/components.tsx";
import {
	type DisplayDiffLine,
	formatDiffForDisplay,
	shouldShowDiff,
	summarizeDiff,
} from "@/tui/core/primitives/parse-diff.ts";
import { getHookKey, hasCleanup, setCleanup, useSignal } from "@/tui/render/hooks/signals.ts";
import { useTextInput, type VimMode } from "@/tui/render/hooks/text-input.ts";
import { type CommandPaletteItem, useCommandPalette } from "@/tui/render/hooks/command-palette.ts";
import { inputManager } from "@/tui/core/input.ts";
import { useProjectFiles } from "./hooks/project-files.ts";
import "@std/dotenv/load";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
	const value = Deno.env.get(name);
	if (!value) {
		console.error(`Set ${name} in .env file`);
		Deno.exit(1);
	}
	return value;
}

const apiKey = requireEnv("LLM_API_KEY");
const baseURL = requireEnv("LLM_BASE_URL");
const model = requireEnv("LLM_MODEL_URL");

const provider = new CompletionsProvider({ apiKey, baseURL });
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
	diff?: string;
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
	{
		id: "threads",
		title: "Threads",
		description: "Switch to a previous session",
		keywords: ["sessions", "history"],
	},
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
					TinyAg2
				</Text>
				<Text color="gray">│</Text>
				<Text color="yellow">{model}</Text>
			</Box>
			<Box flexDirection="row" gap={2}>
				<Box flexDirection="row" gap={1}>
					<Text color="gray">tokens:</Text>
					<Text color="white">{tokenCount}</Text>
				</Box>
				<Box flexDirection="row" gap={1}>
					<Text color="gray">cost:</Text>
					<Text color="green">{totalCost.toFixed(4)}$</Text>
				</Box>
			</Box>
		</Box>
	);
}

const DIFF_INDICATOR: Record<DisplayDiffLine["type"], { symbol: string; color: string }> = {
	add: { symbol: "+", color: "green" },
	remove: { symbol: "-", color: "red" },
	context: { symbol: " ", color: "gray" },
};

function DiffView({ diff }: { diff: string }) {
	const lines = formatDiffForDisplay(diff);
	const maxNum = lines.reduce((m, l) => Math.max(m, l.newNum ?? 0, l.oldNum ?? 0), 0);
	const numWidth = String(maxNum).length;

	return (
		<Box flexDirection="column">
			{lines.map((line, i) => {
				const { symbol, color } = DIFF_INDICATOR[line.type];
				const num = line.newNum ?? line.oldNum;
				const lineNum = num !== null ? String(num).padStart(numWidth) : " ".repeat(numWidth);
				return (
					<Text key={i} color={color}>
						{`  ${lineNum} ${symbol} ${line.code}`}
					</Text>
				);
			})}
		</Box>
	);
}

function ToolCallView({ tool }: { key?: number; tool: UIToolCall }) {
	const output = getToolDisplayOutput(tool);
	const showDiff = tool.diff && shouldShowDiff(tool.diff);
	const diffSummary = tool.diff && !showDiff ? summarizeDiff(tool.diff) : null;
	return (
		<Box flexDirection="column" gap={1}>
			<Box flexDirection="row" gap={1}>
				<Text color="yellow" bold>{tool.name}</Text>
				<Text color="gray">{tool.input}</Text>
				{diffSummary && <Text color="gray">({diffSummary})</Text>}
			</Box>
			{showDiff && <DiffView diff={tool.diff!} />}
			{!tool.diff && output && (
				<Box flexDirection="row">
					<Text color="gray">{output}</Text>
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
			return `${files.length} file${files.length !== 1 ? "s" : ""} found`;
		}
		case "grep": {
			const lines = tool.output.split("\n").filter(Boolean);
			const fileSet = new Set(lines.map((l) => l.split(":")[0]));
			return `${lines.length} match${lines.length !== 1 ? "es" : ""} in ${fileSet.size} file${
				fileSet.size !== 1 ? "s" : ""
			}`;
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

function entriesToUIMessages(entries: Entry[]): UIMessage[] {
	const messages: UIMessage[] = [];
	const toolCallIdMap = new Map<string, UIToolCall>();

	for (const entry of entries) {
		if (entry.type === "message" && entry.role === "user" && typeof entry.content === "string") {
			messages.push({ role: "user", content: entry.content });
		} else if (entry.type === "message" && entry.role === "assistant") {
			const toolCalls: UIToolCall[] = entry.toolCalls?.map((tc) => {
				const uiTc: UIToolCall = {
					name: tc.function.name,
					input: formatToolInput(tc.function.name, tc.function.arguments),
					output: "",
				};
				toolCallIdMap.set(tc.id, uiTc);
				return uiTc;
			}) ?? [];
			messages.push({
				role: "agent",
				content: typeof entry.content === "string" ? entry.content : "",
				toolCalls,
			});
		} else if (entry.type === "tool_result") {
			const tc = toolCallIdMap.get(entry.toolCallId);
			if (tc) tc.output = entry.content;
		}
	}
	return messages;
}

function App({ onQuit, initialSession }: { onQuit: () => void; initialSession: SessionManager }) {
	const input = useSignal("");
	const cursor = useSignal(0);
	const mode = useSignal<VimMode>("INSERT");
	const isLoading = useSignal(false);
	const statusText = useSignal("Thinking...");
	const tokenCount = useSignal(0);
	const totalCost = useSignal(0);
	const sessionId = useSignal(0);
	const uiMessages = useSignal<UIMessage[]>([]);
	const session = useSignal<SessionManager>(initialSession);
	const abortController = useSignal<AbortController | null>(null);
	const escPrimed = useSignal(false);

	// Double-Esc to cancel streaming (only when loading, so it doesn't conflict with vim mode toggle)
	const cancelKey = getHookKey("cancel-");
	if (!hasCleanup(cancelKey)) {
		let lastEsc = 0;
		const cleanup = inputManager.onKeyGlobal((event) => {
			if (event.key !== "escape" || !isLoading.value) return false;
			const now = Date.now();
			if (now - lastEsc < 1500) {
				abortController.value?.abort();
				lastEsc = 0;
				escPrimed.value = false;
			} else {
				lastEsc = now;
				escPrimed.value = true;
			}
			return true;
		});
		setCleanup(cancelKey, cleanup);
	}

	const handleSubmit = (value: string) => {
		if (!value.trim() || isLoading.value) return;

		uiMessages.value = [...uiMessages.value, { role: "user", content: value }];
		input.value = "";
		cursor.value = 0;
		isLoading.value = true;
		statusText.value = "Thinking...";
		const ac = new AbortController();
		abortController.value = ac;

		(async () => {
			// Append user message to session and build LLM context
			await session.value.append({ type: "message", role: "user", content: value });
			const messages = entriesToMessages(session.value.getEntries());

			let currentText = "";
			const currentToolCalls: UIToolCall[] = [];
			const toolCallState = new Map<string, { name: string; args: string }>();

			const events = runAgent(messages, {
				provider,
				tools,
				model,
				systemPrompt: SYSTEM_PROMPT,
				temperature: 0.6,
				contextLimit: { maxTokens: 200_000, preserveRecentTurns: 4 },
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
								currentToolCalls[idx] = {
									...currentToolCalls[idx],
									output: event.result.content,
									diff: event.result.meta?.diff,
								};
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
					case "turn_complete": {
						const am = event.assistantMessage;
						await session.value.append({
							type: "message",
							role: "assistant",
							content: am.content,
							...(am.tool_calls?.length && { toolCalls: am.tool_calls }),
						});

						for (const tr of event.toolResults) {
							await session.value.append({
								type: "tool_result",
								toolCallId: tr.tool_call_id!,
								toolName: tr.name!,
								content: tr.content!,
							});
						}
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

			isLoading.value = false;
			abortController.value = null;
		})();
	};

	const fileMentionStart = useSignal<number | null>(null);
	const projectFiles = useProjectFiles();

	const threadItems = useSignal<CommandPaletteItem[]>([]);

	const threadsPalette = useCommandPalette({
		items: threadItems.value,
		openKey: null,
		maxResults: 20,
		onSelect: (item) => {
			if (isLoading.value) return;
			SessionManager.open(item.id).then((sm) => {
				session.value = sm;
				uiMessages.value = entriesToUIMessages(sm.getEntries());
				tokenCount.value = 0;
				totalCost.value = 0;
				sessionId.value++;
			});
		},
	});

	const filePalette = useCommandPalette({
		items: projectFiles.files.value,
		openKey: null,
		maxResults: 10,
		onSelect: (item) => {
			const start = fileMentionStart.value;
			if (start !== null) {
				const insertText = `@${item.title} `;
				input.value = input.value.slice(0, start) + insertText + input.value.slice(start + 1);
				cursor.value = start + insertText.length;
				fileMentionStart.value = null;
			}
		},
		onDismiss: () => {
			const start = fileMentionStart.value;
			if (start !== null) {
				input.value = input.value.slice(0, start) + input.value.slice(start + 1);
				cursor.value = start;
				fileMentionStart.value = null;
			}
		},
	});

	const palette = useCommandPalette({
		items: COMMANDS,
		mode,
		onSelect: (item) => {
			if (item.id === "new-chat") {
				uiMessages.value = [];
				tokenCount.value = 0;
				totalCost.value = 0;
				sessionId.value++;
				session.value = SessionManager.create(Deno.cwd());
			} else if (item.id === "threads") {
				SessionManager.listSummaries(Deno.cwd()).then((summaries) => {
					threadItems.value = summaries.map((s) => {
						const date = new Date(s.timestamp);
						const label = date.toLocaleString();
						const preview = s.firstUserMessage
							? s.firstUserMessage.length > 45
								? s.firstUserMessage.slice(0, 45) + "…"
								: s.firstUserMessage
							: "(empty session)";
						return { id: s.path, title: preview, description: label, keywords: [s.id] };
					});
					threadsPalette.openPalette();
				});
			} else if (item.id === "quit") {
				onQuit();
			}
		},
	});

	const { cursorStyle } = useTextInput({
		value: input,
		cursorPosition: cursor,
		mode,
		focused: true,
		onSubmit: handleSubmit,
		onCharInserted: (char, cursorPos) => {
			if (char === "@" && !filePalette.open.value && !palette.open.value && !isLoading.value) {
				fileMentionStart.value = cursorPos - 1;
				projectFiles.startIndexing();
				filePalette.openPalette();
			}
		},
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
							{escPrimed.value
								? (
									<Text color="yellow" bold>
										Press Esc again to cancel
									</Text>
								)
								: (
									<Text color="gray" italic>
										Esc to cancel
									</Text>
								)}
						</>
					)}
				</Box>
				<Text color="gray" italic>
					Enter to send • @ for files • / for commands • PageUp/PageDown to scroll • i/Esc to toggle mode
				</Text>
			</Box>

			<CommandPalette palette={palette} />
			<CommandPalette palette={filePalette} placeholder="Search files..." borderLabel="Files" />
			<CommandPalette palette={threadsPalette} placeholder="Search threads..." borderLabel="Threads" width={80} />
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

const initialSession = SessionManager.create(Deno.cwd());
run((quit) => <App onQuit={quit} initialSession={initialSession} />);
