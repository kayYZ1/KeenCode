import { runAgentLoop } from "@vvtxn/relay/core/runner.ts";
import type { ToolResult } from "@vvtxn/relay/core/tools/types.ts";
import { createUIToolCall } from "@vvtxn/relay/core/display.ts";
import type { UIToolCall } from "@vvtxn/relay/core/display.ts";
import type { Message, Usage } from "@vvtxn/relay/api/types.ts";
import { CompletionsProvider } from "@vvtxn/relay/api/providers/completions.ts";
import { createToolRegistry, defaultTools } from "@vvtxn/relay/core/tools/index.ts";
import {
	entriesToMessages,
	type Entry,
	SessionManager,
	stripAttachedContext,
} from "@vvtxn/relay/core/sessions/index.ts";
import { run } from "@/tui/render/index.ts";
import { Box, CommandPalette, ScrollArea, Spinner, Text, TextInput, WelcomeScreen } from "@/tui/render/components.tsx";
import { getHookKey, hasCleanup, setCleanup, useSignal } from "@/tui/render/hooks/signals.ts";
import { useTextInput, type VimMode } from "@/tui/render/hooks/text-input.ts";
import { type CommandPaletteItem, useCommandPalette } from "@/tui/render/hooks/command-palette.ts";
import { inputManager } from "@/tui/core/input.ts";
import { useProjectFiles } from "./hooks/project-files.ts";
import { config } from "./config.ts";
import { loadApiKey } from "./auth.ts";
import { theme } from "@/tui/theme.ts";
import { VERSION } from "../version.ts";
import SYSTEM_PROMPT from "./system-prompt.md" with { type: "text" };

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const apiKey = await loadApiKey();

const branchName = await new Deno.Command("git", {
	args: ["branch", "--show-current"],
	stdout: "piped",
	stderr: "null",
})
	.output().then((o) => new TextDecoder().decode(o.stdout).trim()).catch(() => "");

const provider = new CompletionsProvider({ apiKey, baseURL: config.baseURL });
const tools = createToolRegistry(defaultTools);

import { expandMentions } from "./mention.ts";

// ---------------------------------------------------------------------------
// UI Types
// ---------------------------------------------------------------------------

import { StatusBar } from "./components/status-bar.tsx";
import { MessageView, type UIMessage } from "./components/chat.tsx";

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
// Status
// ---------------------------------------------------------------------------

type AgentStatus =
	| { kind: "thinking" }
	| { kind: "writing" }
	| { kind: "running_tool"; toolName: string };

function formatStatus(status: AgentStatus): string {
	switch (status.kind) {
		case "thinking":
			return "Thinking...";
		case "writing":
			return "Writing...";
		case "running_tool":
			return `Running ${status.toolName}...`;
	}
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

function entriesToUIMessages(entries: Entry[]): UIMessage[] {
	const messages: UIMessage[] = [];
	const toolCallIdMap = new Map<string, UIToolCall>();

	for (const entry of entries) {
		if (entry.type === "message" && entry.role === "user" && typeof entry.content === "string") {
			const displayContent = entry.content.replace(/\n\n<attached_context>[\s\S]*<\/attached_context>$/, "");
			messages.push({ role: "user", content: displayContent });
		} else if (entry.type === "message" && entry.role === "assistant") {
			const hasContent = typeof entry.content === "string" && entry.content.trim();
			const hasToolCalls = entry.toolCalls && entry.toolCalls.length > 0;
			if (!hasContent && !hasToolCalls) continue;
			const toolCalls: UIToolCall[] = entry.toolCalls?.map((tc) => {
				const uiTc = createUIToolCall(tc.function.name, tc.function.arguments);
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
	const status = useSignal<AgentStatus>({ kind: "thinking" });
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
		let escTimer: ReturnType<typeof setTimeout> | null = null;
		const cleanup = inputManager.onKeyGlobal((event) => {
			if (event.key !== "escape" || !isLoading.value) return false;
			const now = Date.now();
			if (now - lastEsc < 1500) {
				abortController.value?.abort();
				lastEsc = 0;
				escPrimed.value = false;
				if (escTimer) {
					clearTimeout(escTimer);
					escTimer = null;
				}
			} else {
				lastEsc = now;
				escPrimed.value = true;
				if (escTimer) clearTimeout(escTimer);
				escTimer = setTimeout(() => {
					escPrimed.value = false;
					escTimer = null;
				}, 1500);
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
		status.value = { kind: "thinking" };

		const ac = new AbortController();
		abortController.value = ac;
		void runSubmission(value, ac);
	};

	const runSubmission = async (value: string, ac: AbortController) => {
		// Resolve @mentions: read file/directory contents and append as context
		const expandedValue = await expandMentions(value);

		// Store stripped version in session (without file content bloat in history)
		await session.value.append({ type: "message", role: "user", content: stripAttachedContext(expandedValue) });
		const messages = entriesToMessages(session.value.getEntries());

		// Replace the last user message with the full expanded content for the LLM
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i].role === "user") {
				messages[i] = { ...messages[i], content: expandedValue };
				break;
			}
		}

		const draft = { text: "", toolCalls: [] as UIToolCall[], msgIndex: -1 };
		const toolCallIndex = new Map<string, number>();

		let syncTimer: ReturnType<typeof setTimeout> | null = null;
		let syncPending = false;

		const doSync = () => {
			const msgs = [...uiMessages.value];
			const entry: UIMessage = { role: "agent", content: draft.text, toolCalls: [...draft.toolCalls] };
			if (draft.msgIndex >= 0 && draft.msgIndex < msgs.length) {
				msgs[draft.msgIndex] = entry;
			} else {
				draft.msgIndex = msgs.length;
				msgs.push(entry);
			}
			uiMessages.value = msgs;
			syncPending = false;
		};

		const syncDraft = (force = false) => {
			if (force) {
				if (syncTimer) clearTimeout(syncTimer);
				syncTimer = null;
				doSync();
				return;
			}
			if (syncPending) return;
			syncPending = true;
			syncTimer = setTimeout(() => {
				syncTimer = null;
				doSync();
			}, 50);
		};

		await runAgentLoop(messages, {
			provider,
			tools,
			model: config.model,
			systemPrompt: SYSTEM_PROMPT,
			temperature: config.temperature,
			contextLimit: { maxTokens: config.maxTokens, preserveRecentTurns: config.preserveRecentTurns },
			maxTokens: config.maxCompletionTokens,
			signal: ac.signal,
		}, {
			onTextDelta(delta: string) {
				status.value = { kind: "writing" };
				draft.text += delta;
				syncDraft();
			},
			onToolCallEnd(id: string, name: string, args: string) {
				status.value = { kind: "running_tool", toolName: name };
				const idx = draft.toolCalls.length;
				toolCallIndex.set(id, idx);
				draft.toolCalls.push(createUIToolCall(name, args));
				syncDraft(true);
			},
			onToolResult(id: string, result: ToolResult) {
				const idx = toolCallIndex.get(id);
				if (idx !== undefined && idx < draft.toolCalls.length) {
					draft.toolCalls[idx] = {
						...draft.toolCalls[idx],
						output: result.content,
						diff: result.meta?.diff,
					};
				}
				syncDraft(true);
			},
			onMessageComplete(usage?: Usage, generationId?: string) {
				if (usage) {
					tokenCount.value = usage.prompt_tokens + usage.completion_tokens;
					if (usage.cost) {
						totalCost.value += usage.cost;
						session.value.setCost(totalCost.value);
					}
					session.value.setTokens(tokenCount.value);
				}
				if (generationId) {
					const sid = sessionId.value;
					provider.getGenerationStats(generationId).then((stats) => {
						if (!stats || sessionId.value !== sid) return;
						if (stats.totalCost !== null) {
							totalCost.value += stats.totalCost;
							session.value.setCost(totalCost.value);
						}
						if (!usage && stats.promptTokens !== null && stats.completionTokens !== null) {
							tokenCount.value = stats.promptTokens + stats.completionTokens;
							session.value.setTokens(tokenCount.value);
						}
					});
				}
				status.value = { kind: "thinking" };
			},
			onTurnComplete: async (assistantMessage: Message, toolResults: Message[]) => {
				const am = assistantMessage;
				await session.value.append({
					type: "message",
					role: "assistant",
					content: am.content,
					...(am.tool_calls?.length && { toolCalls: am.tool_calls }),
				});

				for (const tr of toolResults) {
					await session.value.append({
						type: "tool_result",
						toolCallId: tr.tool_call_id!,
						toolName: tr.name!,
						content: tr.content!,
					});
				}

				draft.text = "";
				draft.toolCalls = [];
				draft.msgIndex = -1;
				toolCallIndex.clear();
			},
			onError(error: Error) {
				if (ac.signal.aborted) return;
				uiMessages.value = [
					...uiMessages.value,
					{ role: "agent", content: `**Error:** ${error.message}` },
				];
			},
		});

		if (syncTimer) {
			clearTimeout(syncTimer);
			doSync();
		}

		isLoading.value = false;
		abortController.value = null;
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
			session.value.flush();
			SessionManager.open(item.id).then((sm) => {
				session.value = sm;
				uiMessages.value = entriesToUIMessages(sm.getEntries());
				tokenCount.value = sm.getTokens();
				totalCost.value = sm.getCost();
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
				session.value.flush();
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

	useTextInput({
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
			<StatusBar tokenCount={tokenCount.value} totalCost={totalCost.value} branchName={branchName} />

			{uiMessages.value.length === 0
				? (
					<WelcomeScreen
						version={VERSION}
						hints="Enter to send • @ for files • / for commands • PageUp/PageDown to scroll • i/Esc to toggle mode"
					/>
				)
				: (
					<ScrollArea flex flexDirection="column" padding={1} gap={1} scrollbar focused autoScroll>
						{uiMessages.value.map((msg, i) => <MessageView key={i} msg={msg} />)}
					</ScrollArea>
				)}

			<Box height={1} />
			<Box
				border="round"
				borderColor={theme.border}
				borderLabel={mode.value}
				borderLabelColor={theme.borderLabel}
				padding={1}
			>
				<TextInput
					value={input.value}
					cursorPosition={cursor.value}
					placeholder="Write a message..."
					placeholderColor={theme.textDim}
					focused
				/>
			</Box>

			{isLoading.value && (
				<Box flexDirection="row" padding={1}>
					<Box flexDirection="row" gap={1}>
						<Spinner color={theme.accent} />
						<Text color={theme.textMuted} bold italic>
							{formatStatus(status.value)}
						</Text>
						{escPrimed.value
							? (
								<Text color={theme.warning} bold>
									Press Esc again to cancel
								</Text>
							)
							: (
								<Text color={theme.textDim} italic>
									Esc to cancel
								</Text>
							)}
					</Box>
				</Box>
			)}

			<CommandPalette palette={palette} />
			<CommandPalette palette={filePalette} placeholder="Search files..." borderLabel="Files" />
			<CommandPalette palette={threadsPalette} placeholder="Search threads..." borderLabel="Threads" width={80} />
		</Box>
	);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

const initialSession = SessionManager.create(Deno.cwd());
run((quit) => <App onQuit={quit} initialSession={initialSession} />);
