import { join } from "@std/path/join";

const AGENT_DIR = ".keencode";

export function homeDir(): string | undefined {
	return Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
}

export function keencodeDir(): string {
	return join(homeDir() ?? ".", AGENT_DIR);
}
