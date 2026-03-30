export interface KeenCodeConfig {
	baseURL: string;
	model: string;
	temperature: number;
	maxTokens: number;
	preserveRecentTurns: number;
}

export const config: KeenCodeConfig = {
	baseURL: "https://openrouter.ai/api/v1",
	model: "moonshotai/kimi-k2.5",
	temperature: 0.6,
	maxTokens: 200_000,
	preserveRecentTurns: 4,
};
