import { join } from "@std/path/join";
import type { Message } from "@/api/types.ts";
import { sessionDir, sessionFilePath } from "./paths.ts";
import {
	CURRENT_VERSION,
	type Entry,
	type MessageEntry,
	type Session,
	type SessionHeader,
	type SessionSummary,
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
	private needsFlush: boolean;

	private constructor(session: Session, path: string | null, needsFlush = false) {
		this.session = session;
		this.path = path;
		this.needsFlush = needsFlush;
	}

	/** Start a new persistent session. File is created lazily on first append. */
	static create(cwd: string): SessionManager {
		const id = newId();
		const path = sessionFilePath(cwd, id);

		const header: SessionHeader = {
			type: "session",
			version: CURRENT_VERSION,
			id,
			timestamp: new Date().toISOString(),
			cwd,
		};

		SessionManager.cleanup(cwd).catch(() => {});
		return new SessionManager({ header, entries: [] }, path, true);
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

	/** List all session files for this cwd, most recently active first. */
	static async list(cwd: string): Promise<string[]> {
		const dir = sessionDir(cwd);
		const files: { path: string; mtime: number }[] = [];

		try {
			for await (const entry of Deno.readDir(dir)) {
				if (entry.isFile && entry.name.endsWith(".jsonl")) {
					try {
						const path = join(dir, entry.name);
						const stat = await Deno.stat(path);
						files.push({ path, mtime: stat.mtime?.getTime() ?? 0 });
					} catch {
						// Skip files that vanish between readDir and stat
					}
				}
			}
		} catch {
			return [];
		}

		return files.sort((a, b) => b.mtime - a.mtime).map((f) => f.path);
	}

	/** Delete old sessions beyond the `keep` most recent. Returns count deleted. */
	static async cleanup(cwd: string, keep = 7): Promise<number> {
		const files = await SessionManager.list(cwd);
		const toDelete = files.slice(keep);
		await Promise.all(toDelete.map((f) => Deno.remove(f)));
		return toDelete.length;
	}

	/** List session summaries (id, timestamp, first user message) for this cwd. */
	static async listSummaries(cwd: string): Promise<SessionSummary[]> {
		const files = await SessionManager.list(cwd);
		const summaries: SessionSummary[] = [];

		for (const filePath of files) {
			try {
				const file = await Deno.open(filePath, { read: true });
				const lines: string[] = [];
				let buf = "";

				// Read only enough to get header + first user message (typically lines 1-2)
				for await (const chunk of file.readable) {
					buf += new TextDecoder().decode(chunk);
					const parts = buf.split("\n");
					for (let i = 0; i < parts.length - 1; i++) {
						if (parts[i].trim()) lines.push(parts[i]);
					}
					buf = parts[parts.length - 1];

					// Header + first entry is enough in most cases
					if (lines.length >= 2) break;
				}
				if (buf.trim()) lines.push(buf);
				if (lines.length === 0) continue;

				const header = JSON.parse(lines[0]) as SessionHeader;
				let firstUserMessage: string | null = null;

				for (let i = 1; i < lines.length; i++) {
					const entry = JSON.parse(lines[i]) as Entry;
					if (entry.type === "message" && entry.role === "user" && typeof entry.content === "string") {
						firstUserMessage = entry.content;
						break;
					}
				}

				summaries.push({ id: header.id, path: filePath, timestamp: header.timestamp, firstUserMessage });
			} catch {
				// Skip corrupt files
			}
		}

		return summaries;
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

	/** Append a new entry to the session. Creates the file on first call. */
	async append(entry: NewEntry): Promise<string> {
		const id = newId();
		const full = { ...entry, id, timestamp: new Date().toISOString() } as Entry;

		if (this.path) {
			if (this.needsFlush) {
				await Deno.mkdir(sessionDir(this.session.header.cwd), { recursive: true });
				await Deno.writeTextFile(this.path, JSON.stringify(this.session.header) + "\n");
				this.needsFlush = false;
			}
			await Deno.writeTextFile(this.path, JSON.stringify(full) + "\n", { append: true });
		}

		this.session.entries.push(full);
		return id;
	}
}
