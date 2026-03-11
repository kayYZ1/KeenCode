import { join } from "@std/path/join";

const AGENT_DIR = ".tinyag2";

function getUsername(): string | undefined {
	return Deno.env.get("USER") ?? Deno.env.get("USERNAME");
}

function getHomeDir(): string | undefined {
	return Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
}

export function sessionsBaseDir(): string {
	const home = getHomeDir() ?? ".";
	return join(home, AGENT_DIR, "sessions");
}

export function sessionDir(_cwd: string): string {
	const username = getUsername() ?? "default";
	return join(sessionsBaseDir(), username);
}

export function sessionFilePath(cwd: string, id: string): string {
	const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
	return join(sessionDir(cwd), `${ts}_${id}.jsonl`);
}
