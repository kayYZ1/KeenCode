import type { Message } from "@/api/types.ts";

// ---------------------------------------------------------------------------
// Token estimation (heuristic: ~4 chars per token)
// ---------------------------------------------------------------------------

const CHARS_PER_TOKEN = 4;
const MESSAGE_OVERHEAD = 4; // role, separators

export function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateMessageTokens(message: Message): number {
	let tokens = MESSAGE_OVERHEAD;
	if (message.content) tokens += estimateTokens(message.content);
	if (message.name) tokens += estimateTokens(message.name);
	if (message.tool_calls) {
		for (const tc of message.tool_calls) {
			tokens += estimateTokens(tc.function.name) + estimateTokens(tc.function.arguments);
		}
	}
	return tokens;
}

// ---------------------------------------------------------------------------
// Turns — groups of messages that must be kept or dropped together
// ---------------------------------------------------------------------------

interface Turn {
	messages: Message[];
	tokens: number;
	droppable: boolean;
}

/**
 * Group messages into turns. A turn is:
 * - System message (not droppable)
 * - User message
 * - Assistant message + its following tool result messages
 */
function groupIntoTurns(messages: Message[]): Turn[] {
	const turns: Turn[] = [];
	let i = 0;

	while (i < messages.length) {
		const msg = messages[i];

		if (msg.role === "system") {
			turns.push({ messages: [msg], tokens: estimateMessageTokens(msg), droppable: false });
			i++;
		} else if (msg.role === "user") {
			turns.push({ messages: [msg], tokens: estimateMessageTokens(msg), droppable: true });
			i++;
		} else if (msg.role === "assistant") {
			const group: Message[] = [msg];
			let groupTokens = estimateMessageTokens(msg);

			// Collect following tool result messages
			if (msg.tool_calls?.length) {
				let j = i + 1;
				while (j < messages.length && messages[j].role === "tool") {
					group.push(messages[j]);
					groupTokens += estimateMessageTokens(messages[j]);
					j++;
				}
				i = j;
			} else {
				i++;
			}

			turns.push({ messages: group, tokens: groupTokens, droppable: true });
		} else {
			// Orphan tool message — keep but mark droppable
			turns.push({ messages: [msg], tokens: estimateMessageTokens(msg), droppable: true });
			i++;
		}
	}

	return turns;
}

// ---------------------------------------------------------------------------
// Tool result summarization
// ---------------------------------------------------------------------------

const SUMMARY_THRESHOLD = 500; // only summarize content longer than this (chars)

function summarizeToolContent(content: string, toolName: string): string {
	const lines = content.split("\n");
	const preview = lines.slice(0, 3).join("\n");
	return `${preview}\n... [${toolName}: ${lines.length} lines, ${content.length} chars — trimmed to save context]`;
}

function summarizeTurn(turn: Turn): Turn {
	let changed = false;
	const messages = turn.messages.map((msg) => {
		if (msg.role === "tool" && msg.content && msg.content.length > SUMMARY_THRESHOLD) {
			changed = true;
			return { ...msg, content: summarizeToolContent(msg.content, msg.name ?? "tool") };
		}
		return msg;
	});

	if (!changed) return turn;

	return {
		messages,
		tokens: messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0),
		droppable: turn.droppable,
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TrimOptions {
	/** Maximum token budget for the context. Default: 100_000 */
	maxTokens?: number;
	/** Number of recent turns to always keep intact (not summarized or dropped). Default: 4 */
	preserveRecentTurns?: number;
}

const DEFAULT_MAX_TOKENS = 100_000;
const DEFAULT_PRESERVE_RECENT_TURNS = 4;

/**
 * Trim a message array to fit within a token budget.
 *
 * Strategy (applied in order):
 * 1. If under budget → return as-is
 * 2. Summarize old tool results (replace long content with previews)
 * 3. Drop oldest droppable turns until under budget
 */
export function trimContext(messages: Message[], options: TrimOptions = {}): Message[] {
	const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
	const preserveRecent = options.preserveRecentTurns ?? DEFAULT_PRESERVE_RECENT_TURNS;

	const turns = groupIntoTurns(messages);
	let totalTokens = turns.reduce((sum, t) => sum + t.tokens, 0);

	if (totalTokens <= maxTokens) return messages;

	// Boundary: turns at or after this index are "recent" and kept intact
	const recentStart = Math.max(0, turns.length - preserveRecent);

	// Phase 1: Summarize old tool results
	for (let i = 0; i < recentStart; i++) {
		if (!turns[i].droppable) continue;
		const summarized = summarizeTurn(turns[i]);
		totalTokens += summarized.tokens - turns[i].tokens;
		turns[i] = summarized;
	}

	if (totalTokens <= maxTokens) {
		return turns.flatMap((t) => t.messages);
	}

	// Phase 2: Drop oldest droppable turns
	const dropIndices = new Set<number>();
	for (let i = 0; i < recentStart && totalTokens > maxTokens; i++) {
		if (turns[i].droppable) {
			totalTokens -= turns[i].tokens;
			dropIndices.add(i);
		}
	}

	return turns
		.filter((_, i) => !dropIndices.has(i))
		.flatMap((t) => t.messages);
}
