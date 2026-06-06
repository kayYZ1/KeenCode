import { join } from "@std/path/join";
import { relayDir } from "@/core/paths.ts";

export interface RelayConfig {
	baseURL: string;
	model: string;
	temperature: number;
	maxTokens: number;
	preserveRecentTurns: number;
	maxCompletionTokens: number;
}

const defaults: RelayConfig = {
	baseURL: "https://openrouter.ai/api/v1",
	model: "moonshotai/kimi-k2.6",
	temperature: 0.1,
	maxTokens: 350_000,
	preserveRecentTurns: 6,
	maxCompletionTokens: 16_384,
};

function loadUserConfig(): Partial<RelayConfig> {
	const path = join(relayDir(), "config.json");
	try {
		const raw = Deno.readTextFileSync(path);
		return JSON.parse(raw) as Partial<RelayConfig>;
	} catch {
		try {
			const dir = relayDir();
			Deno.mkdirSync(dir, { recursive: true });
			Deno.writeTextFileSync(path, JSON.stringify(defaults, null, "\t") + "\n");
		} catch { /* ignore — read-only fs or similar */ }
		return {};
	}
}

export const config: RelayConfig = { ...defaults, ...loadUserConfig() };
