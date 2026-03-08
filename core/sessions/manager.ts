import { join } from "@std/path/join";
import type { Message } from "@/api/types.ts";
import { sessionDir, sessionFilePath } from "./paths.ts";
import {
	CURRENT_VERSION,
	type Entry,
	type MessageEntry,
	type Session,
	type SessionHeader,
	type ToolResultEntry,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type NewEntry = Omit<MessageEntry, "id" | "timestamp"> | Omit<ToolResultEntry, "id" | "timestamp">;

function newId(): string {
	return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

async function readSession(path: string): Promise<Session> {
	const text = await Deno.readTextFile(path);
	const lines = text.split("\n").filter((l) => l.trim() !== "");
	const header = JSON.parse(lines[0]) as SessionHeader;
	const entries = lines.slice(1).map((l) => JSON.parse(l) as Entry);
	return { header, entries };
}

// ---------------------------------------------------------------------------
// Entry → Message conversion
// ---------------------------------------------------------------------------

function entryToMessage(entry: Entry): Message {
	switch (entry.type) {
		case "message":
			return {
				role: entry.role,
				content: entry.content,
				...(entry.toolCalls?.length && { tool_calls: entry.toolCalls }),
			};
		case "tool_result":
			return {
				role: "tool",
				tool_call_id: entry.toolCallId,
				name: entry.toolName,
				content: entry.content,
			};
	}
}

/** Convert session entries into the Message[] format expected by the LLM provider. */
export function entriesToMessages(entries: Entry[]): Message[] {
	return entries.map(entryToMessage);
}

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

export class SessionManager {
	private session: Session;
	private path: string | null;

	private constructor(session: Session, path: string | null) {
		this.session = session;
		this.path = path;
	}

	/** Start a new persistent session. */
	static async create(cwd: string): Promise<SessionManager> {
		const id = newId();
		const path = sessionFilePath(cwd, id);

		await Deno.mkdir(sessionDir(cwd), { recursive: true });

		const header: SessionHeader = {
			type: "session",
			version: CURRENT_VERSION,
			id,
			timestamp: new Date().toISOString(),
			cwd,
		};

		await Deno.writeTextFile(path, JSON.stringify(header) + "\n");
		return new SessionManager({ header, entries: [] }, path);
	}

	/** Load and continue the most recent session for this cwd. */
	static async continueRecent(cwd: string): Promise<SessionManager | null> {
		const files = await SessionManager.list(cwd);
		if (files.length === 0) return null;
		return SessionManager.open(files[0]);
	}

	/** Load a specific session file. */
	static async open(path: string): Promise<SessionManager> {
		const session = await readSession(path);
		return new SessionManager(session, path);
	}

	/** List all session files for this cwd, most recent first. */
	static async list(cwd: string): Promise<string[]> {
		const dir = sessionDir(cwd);
		const files: string[] = [];

		try {
			for await (const entry of Deno.readDir(dir)) {
				if (entry.isFile && entry.name.endsWith(".jsonl")) {
					files.push(join(dir, entry.name));
				}
			}
		} catch {
			return [];
		}

		return files.sort().reverse();
	}

	getEntries(): Entry[] {
		return this.session.entries;
	}

	getHeader(): SessionHeader {
		return this.session.header;
	}

	getFilePath(): string | null {
		return this.path;
	}

	/** Append a new entry to the session. */
	async append(entry: NewEntry): Promise<string> {
		const id = newId();
		const full = { ...entry, id, timestamp: new Date().toISOString() } as Entry;

		if (this.path) {
			await Deno.writeTextFile(this.path, JSON.stringify(full) + "\n", { append: true });
		}

		this.session.entries.push(full);
		return id;
	}
}
