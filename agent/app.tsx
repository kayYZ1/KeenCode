import { type PermissionDecision, run as runAgent } from "@/core/agent.ts";
import { CompletionsProvider } from "@/api/providers/completions.ts";
import { createToolRegistry, defaultTools } from "@/core/tools/index.ts";
import { entriesToMessages, type Entry, SessionManager } from "@/core/sessions/index.ts";
import { run } from "@/tui/render/index.ts";
import {
	Box,
	CommandPalette,
	Markdown,
	ScrollArea,
	Spinner,
	Text,
	TextInput,
	WelcomeScreen,
} from "@/tui/render/components.tsx";
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
import { config } from "./config.ts";
import { VERSION } from "@/version.ts";
import "@std/dotenv/load";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const apiKey = Deno.env.get("LLM_API_KEY");
if (!apiKey) {
	console.error("Missing API key. Set it with: export LLM_API_KEY=<your-openrouter-key>");
	Deno.exit(1);
}

const branchName = await new Deno.Command("git", {
	args: ["branch", "--show-current"],
	stdout: "piped",
	stderr: "null",
})
	.output().then((o) => new TextDecoder().decode(o.stdout).trim()).catch(() => "");

const provider = new CompletionsProvider({ apiKey, baseURL: config.baseURL });
const tools = createToolRegistry(defaultTools);

const SYSTEM_PROMPT = await Deno.readTextFile(new URL("./system-prompt.md", import.meta.url));

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
// Permissions
// ---------------------------------------------------------------------------

type PermissionAction = "once" | "chat" | "session" | "deny";

interface PendingPermission {
	toolName: string;
	args: unknown;
	resolve: (action: PermissionAction) => void;
}

const PERMISSION_OPTIONS: { id: PermissionAction; title: string; description: string }[] = [
	{ id: "once", title: "Allow Once", description: "Run this command only" },
	{ id: "chat", title: "Allow for Chat", description: "Allow this tool for the rest of this chat" },
	{ id: "session", title: "Allow for Session", description: "Allow this tool until app exit" },
	{ id: "deny", title: "Deny", description: "Block this command" },
];

const appSessionAllowed = new Set<string>();

function PermissionDialog({ pending }: { pending: PendingPermission | null }) {
	const selectedIndex = useSignal(0);
	const pendingRef = useSignal<PendingPermission | null>(null);
	pendingRef.value = pending;

	const permKey = getHookKey("perm-");
	if (!hasCleanup(permKey)) {
		const cleanup = inputManager.onKeyGlobal((event) => {
			const current = pendingRef.value;
			if (!current) return false;

			if (event.key === "up") {
				selectedIndex.value = Math.max(0, selectedIndex.value - 1);
				return true;
			}
			if (event.key === "down") {
				selectedIndex.value = Math.min(PERMISSION_OPTIONS.length - 1, selectedIndex.value + 1);
				return true;
			}
			if (event.key === "enter") {
				current.resolve(PERMISSION_OPTIONS[selectedIndex.value].id);
				selectedIndex.value = 0;
				return true;
			}
			return true;
		});
		setCleanup(permKey, cleanup);
	}

	if (!pending) return <Box />;

	const commandPreview = typeof (pending.args as Record<string, unknown>)?.command === "string"
		? (pending.args as Record<string, unknown>).command as string
		: JSON.stringify(pending.args);
	const displayCmd = commandPreview.length > 80 ? commandPreview.slice(0, 80) + "…" : commandPreview;

	return (
		<Box position="absolute" bottom={4} left={1}>
			<Box
				border="round"
				borderColor="yellow"
				borderLabel="Permission Required"
				borderLabelColor="yellow"
				bgColor="default"
				flexDirection="column"
				padding={1}
				gap={1}
				width={65}
			>
				<Box flexDirection="row" gap={1}>
					<Text color="yellow" bold>
						{pending.toolName}
					</Text>
					<Text color="gray">{displayCmd}</Text>
				</Box>
				<Box flexDirection="column">
					{PERMISSION_OPTIONS.map((option, i) => {
						const isSelected = i === selectedIndex.value;
						return (
							<Box key={option.id} flexDirection="row" gap={1}>
								<Text color={isSelected ? "cyan" : "gray"} bold={isSelected}>
									{isSelected ? ">" : " "}
								</Text>
								<Text color={isSelected ? "white" : "gray"} bold={isSelected}>
									{option.title}
								</Text>
								<Text color="gray" italic>
									{option.description}
								</Text>
							</Box>
						);
					})}
				</Box>
			</Box>
		</Box>
	);
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

type AgentStatus =
	| { kind: "thinking" }
	| { kind: "writing" }
	| { kind: "running_tool"; toolName: string }
	| { kind: "awaiting_permission" };

function formatStatus(status: AgentStatus): string {
	switch (status.kind) {
		case "thinking":
			return "Thinking...";
		case "writing":
			return "Writing...";
		case "running_tool":
			return `Running ${status.toolName}...`;
		case "awaiting_permission":
			return "Awaiting permission...";
	}
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

const CONTEXT_WINDOW = 200_000;
const TOKEN_BAR_WIDTH = 20;

const CONTEXT_WINDOW_LABEL = "200k";

function formatTokens(n: number): string {
	if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
	if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
	return String(n);
}

function TokenBar({ tokenCount }: { tokenCount: number }) {
	const ratio = Math.min(tokenCount / CONTEXT_WINDOW, 1);
	const filled = Math.round(ratio * TOKEN_BAR_WIDTH);
	const empty = TOKEN_BAR_WIDTH - filled;
	const color = ratio >= 0.8 ? "red" : ratio >= 0.5 ? "yellow" : "green";

	return (
		<Box flexDirection="row" gap={1}>
			<Text color="gray">tokens</Text>
			{filled > 0 && <Text color={color}>{"█".repeat(filled)}</Text>}
			{empty > 0 && <Text color="gray">{"░".repeat(empty)}</Text>}
			<Text color={color}>{formatTokens(tokenCount)}</Text>
			<Text color="gray">/ {CONTEXT_WINDOW_LABEL}</Text>
		</Box>
	);
}

function StatusBar({ tokenCount, totalCost }: { tokenCount: number; totalCost: number }) {
	return (
		<Box flexDirection="row" justifyContent="space-between" padding={1}>
			<Box flexDirection="row" gap={1}>
				<Text bold color="cyan">
					KeenCode
				</Text>
				{branchName && <Text color="yellow">on {branchName}</Text>}
			</Box>
			<Box flexDirection="row" gap={2}>
				<TokenBar tokenCount={tokenCount} />
				<Box flexDirection="row" gap={1}>
					<Text color="gray">cost:</Text>
					<Text color="green">{totalCost.toFixed(2)}$</Text>
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
		<Box flexDirection="column">
			<Box flexDirection="row" gap={1}>
				<Text color="yellow" bold>{tool.name}</Text>
				<Text color="gray">{tool.input}</Text>
				{diffSummary && <Text color="gray">({diffSummary})</Text>}
			</Box>
			{showDiff ? <DiffView diff={tool.diff!} /> : output ? <Text color="gray">{output}</Text> : null}
		</Box>
	);
}

function getToolDisplayOutput(tool: UIToolCall): string | null {
	if (!tool.output) return null;
	switch (tool.name) {
		case "read_file":
		case "write_file":
		case "edit_file":
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
		case "bash": {
			const firstLine = tool.output.split("\n")[0];
			return firstLine.length > 120 ? firstLine.slice(0, 120) + "..." : firstLine;
		}
		default:
			return tool.output.length > 120 ? tool.output.slice(0, 120) + "..." : tool.output;
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

	const hasText = !!msg.content?.trim();
	const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0;
	if (!hasText && !hasToolCalls) return <Box />;

	return (
		<Box flexDirection="column" gap={1}>
			{hasText
				? (
					<Box flexDirection="row" gap={1}>
						<Text color="blue" bold>
							●
						</Text>
						<Markdown flex>{msg.content}</Markdown>
					</Box>
				)
				: null}
			{msg.toolCalls?.map((tool, i) => <ToolCallView key={i} tool={tool} />)}
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

	const chatAllowed = useSignal(new Set<string>());
	const pendingPermission = useSignal<PendingPermission | null>(null);

	const onPermissionRequest = (toolName: string, args: unknown): Promise<PermissionDecision> => {
		if (appSessionAllowed.has(toolName) || chatAllowed.value.has(toolName)) {
			return Promise.resolve("allow");
		}

		status.value = { kind: "awaiting_permission" };
		return new Promise<PermissionAction>((resolve) => {
			pendingPermission.value = { toolName, args, resolve };
		}).then((action) => {
			pendingPermission.value = null;
			status.value = { kind: "thinking" };
			if (action === "chat") {
				chatAllowed.value = new Set([...chatAllowed.value, toolName]);
			} else if (action === "session") {
				appSessionAllowed.add(toolName);
			}
			return action === "deny" ? "deny" as const : "allow" as const;
		});
	};

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
		status.value = { kind: "thinking" };

		const ac = new AbortController();
		abortController.value = ac;
		void runSubmission(value, ac);
	};

	const runSubmission = async (value: string, ac: AbortController) => {
		await session.value.append({ type: "message", role: "user", content: value });
		const messages = entriesToMessages(session.value.getEntries());

		const draft = { text: "", toolCalls: [] as UIToolCall[], msgIndex: -1 };
		const toolCallState = new Map<string, { name: string; args: string }>();

		const syncDraft = () => {
			const msgs = [...uiMessages.value];
			const entry: UIMessage = { role: "agent", content: draft.text, toolCalls: [...draft.toolCalls] };
			if (draft.msgIndex >= 0 && draft.msgIndex < msgs.length) {
				msgs[draft.msgIndex] = entry;
			} else {
				draft.msgIndex = msgs.length;
				msgs.push(entry);
			}
			uiMessages.value = msgs;
		};

		const events = runAgent(messages, {
			provider,
			tools,
			model: config.model,
			systemPrompt: SYSTEM_PROMPT,
			temperature: 0.6,
			contextLimit: { maxTokens: 200_000, preserveRecentTurns: 4 },
			signal: ac.signal,
			onPermissionRequest,
		});

		for await (const event of events) {
			let shouldSync = false;

			switch (event.type) {
				case "text_delta": {
					status.value = { kind: "writing" };
					draft.text += event.content;
					shouldSync = true;
					break;
				}
				case "tool_call_start": {
					status.value = { kind: "running_tool", toolName: event.name };
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
						draft.toolCalls.push(createUIToolCall(tc.name, tc.args));
						shouldSync = true;
					}
					break;
				}
				case "tool_result": {
					const tc = toolCallState.get(event.id);
					if (tc) {
						const idx = draft.toolCalls.findIndex((t) => t.name === tc.name && !t.output);
						if (idx !== -1) {
							draft.toolCalls[idx] = {
								...draft.toolCalls[idx],
								output: event.result.content,
								diff: event.result.meta?.diff,
							};
						}
						shouldSync = true;
					}
					break;
				}
				case "message_complete": {
					if (event.usage) {
						tokenCount.value += event.usage.prompt_tokens + event.usage.completion_tokens;
						if (event.usage.cost) totalCost.value += event.usage.cost;
					}
					if (event.generationId) {
						const sid = sessionId.value;
						provider.getGenerationStats(event.generationId).then((stats) => {
							if (!stats || sessionId.value !== sid) return;
							if (stats.totalCost !== null) totalCost.value += stats.totalCost;
							if (!event.usage && stats.promptTokens !== null && stats.completionTokens !== null) {
								tokenCount.value += stats.promptTokens + stats.completionTokens;
							}
						});
					}
					status.value = { kind: "thinking" };
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

					draft.text = "";
					draft.toolCalls = [];
					draft.msgIndex = -1;
					toolCallState.clear();
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

			if (shouldSync) syncDraft();
			if (ac.signal.aborted) break;
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
				chatAllowed.value = new Set();
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
			<StatusBar tokenCount={tokenCount.value} totalCost={totalCost.value} />

			{uiMessages.value.length === 0
				? <WelcomeScreen version={VERSION} />
				: (
					<ScrollArea flex flexDirection="column" gap={1} padding={1} scrollbar focused autoScroll>
						{uiMessages.value.map((msg, i) => <MessageView key={i} msg={msg} />)}
					</ScrollArea>
				)}

			<Box height={1} />
			<Box border="round" borderColor="white" borderLabel={mode.value} borderLabelColor="white" padding={1}>
				<TextInput
					value={input.value}
					cursorPosition={cursor.value}
					placeholder="Awaiting instructions..."
					placeholderColor="gray"
					focused={!pendingPermission.value}
				/>
			</Box>

			<Box flexDirection="row" justifyContent="space-between" padding={1}>
				<Box flexDirection="row" gap={1}>
					{isLoading.value && (
						<>
							<Spinner color="cyan" />
							<Text color="gray" bold italic>
								{formatStatus(status.value)}
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

			<PermissionDialog pending={pendingPermission.value} />
			<CommandPalette palette={palette} />
			<CommandPalette palette={filePalette} placeholder="Search files..." borderLabel="Files" />
			<CommandPalette palette={threadsPalette} placeholder="Search threads..." borderLabel="Threads" width={80} />
		</Box>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summarizeToolArgs(name: string, args: string): string {
	try {
		const parsed = JSON.parse(args);
		switch (name) {
			case "read_file":
			case "write_file":
			case "edit_file":
				return parsed.path ?? args;
			case "glob":
				return parsed.filePattern ?? args;
			case "grep":
				return parsed.pattern ?? args;
			case "bash":
				return parsed.command ?? args;
			default:
				return Object.entries(parsed)
					.filter(([, v]) => typeof v === "string" && v.length < 100)
					.map(([k, v]) => `${k}=${v}`)
					.join(" ");
		}
	} catch {
		return args;
	}
}

function createUIToolCall(name: string, args: string): UIToolCall {
	return { name, input: summarizeToolArgs(name, args), output: "" };
}

const initialSession = SessionManager.create(Deno.cwd());
run((quit) => <App onQuit={quit} initialSession={initialSession} />);
