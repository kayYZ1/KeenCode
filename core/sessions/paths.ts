import { join } from "@std/path/join";
import { keencodeDir } from "@/core/paths.ts";

function getUsername(): string | undefined {
	return Deno.env.get("USER") ?? Deno.env.get("USERNAME");
}

export function sessionsBaseDir(): string {
	return join(keencodeDir(), "sessions");
}

export function sessionDir(_cwd: string): string {
	const username = getUsername() ?? "default";
	return join(sessionsBaseDir(), username);
}

export function sessionFilePath(cwd: string, id: string): string {
	const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
	return join(sessionDir(cwd), `${ts}_${id}.jsonl`);
}
