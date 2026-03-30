import { join } from "@std/path/join";
import { keencodeDir } from "@/core/paths.ts";

interface AuthData {
	apiKey: string;
}

function loadAuthFile(path: string): AuthData | null {
	let raw: string;
	try {
		raw = Deno.readTextFileSync(path);
	} catch {
		return null;
	}

	try {
		const parsed = JSON.parse(raw);
		if (typeof parsed.apiKey === "string" && parsed.apiKey.length > 0) {
			return { apiKey: parsed.apiKey };
		}
		return null;
	} catch {
		return null;
	}
}

async function promptAndSave(path: string): Promise<AuthData> {
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();

	Deno.stdout.writeSync(encoder.encode("Enter your API key: "));

	const buf = new Uint8Array(1024);
	const n = await Deno.stdin.read(buf);
	const key = decoder.decode(buf.subarray(0, n ?? 0)).trim();

	if (!key) {
		console.error("No API key provided.");
		Deno.exit(1);
	}

	const dir = keencodeDir();
	Deno.mkdirSync(dir, { recursive: true });

	const data: AuthData = { apiKey: key };
	Deno.writeTextFileSync(path, JSON.stringify(data, null, "\t") + "\n", { mode: 0o600 });
	console.log(`API key saved to ${path}\n`);

	return data;
}

export async function loadApiKey(): Promise<string> {
	const path = join(keencodeDir(), "auth.json");
	const existing = loadAuthFile(path);
	if (existing) return existing.apiKey;
	const created = await promptAndSave(path);
	return created.apiKey;
}
