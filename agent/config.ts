import { join } from "@std/path/join";
import { keencodeDir } from "@/core/paths.ts";

export interface KeenCodeConfig {
	baseURL: string;
	model: string;
	temperature: number;
	maxTokens: number;
	preserveRecentTurns: number;
}

const defaults: KeenCodeConfig = {
	baseURL: "https://openrouter.ai/api/v1",
	model: "moonshotai/kimi-k2.6",
	temperature: 0.1,
	maxTokens: 200_000,
	preserveRecentTurns: 6,
};

function loadUserConfig(): Partial<KeenCodeConfig> {
	const path = join(keencodeDir(), "config.json");
	try {
		const raw = Deno.readTextFileSync(path);
		return JSON.parse(raw) as Partial<KeenCodeConfig>;
	} catch {
		try {
			const dir = keencodeDir();
			Deno.mkdirSync(dir, { recursive: true });
			Deno.writeTextFileSync(path, JSON.stringify(defaults, null, "\t") + "\n");
		} catch { /* ignore — read-only fs or similar */ }
		return {};
	}
}

export const config: KeenCodeConfig = { ...defaults, ...loadUserConfig() };
