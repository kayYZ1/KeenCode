import type { ToolCall } from "@/api/types.ts";

// ---------------------------------------------------------------------------
// Session header — first line of every .jsonl file
// ---------------------------------------------------------------------------

export interface SessionHeader {
	type: "session";
	version: number;
	id: string;
	timestamp: string;
	cwd: string;
}

// ---------------------------------------------------------------------------
// Entry types — every line after the header is one of these
// ---------------------------------------------------------------------------

export interface EntryBase {
	type: string;
	id: string;
	timestamp: string;
}

export interface MessageEntry extends EntryBase {
	type: "message";
	role: "user" | "assistant";
	content: string | null;
	toolCalls?: ToolCall[];
}

export interface ToolResultEntry extends EntryBase {
	type: "tool_result";
	toolCallId: string;
	toolName: string;
	content: string;
	isError?: boolean;
}

export type Entry = MessageEntry | ToolResultEntry;

// ---------------------------------------------------------------------------
// In-memory session
// ---------------------------------------------------------------------------

export interface Session {
	header: SessionHeader;
	entries: Entry[];
}

export const CURRENT_VERSION = 1;
