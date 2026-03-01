import { parseSSEStream } from "@/api/streaming/stream.ts";
import type { CompletionRequest, CompletionResponse, LLMProvider, ProviderConfig, StreamChunk } from "@/api/types.ts";

export interface GenerationStats {
	totalCost: number | null;
	promptTokens: number | null;
	completionTokens: number | null;
}

export class CompletionsProvider implements LLMProvider {
	private readonly apiKey: string;
	private readonly baseURL: string;
	readonly defaultModel: string;

	constructor(config: ProviderConfig) {
		this.apiKey = config.apiKey;
		// Normalize: strip trailing slashes and /chat/completions if someone pastes the full endpoint URL
		this.baseURL = config.baseURL
			.replace(/\/+$/, "")
			.replace(/\/chat\/completions$/, "");
		this.defaultModel = config.defaultModel ?? "kimi-k2";
	}

	async complete(request: CompletionRequest): Promise<CompletionResponse> {
		const body = this.buildBody(request, false);
		const response = await this.fetch(body);
		return await response.json() as CompletionResponse;
	}

	async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
		const body = this.buildBody(request, true);
		const response = await this.fetch(body, request.signal);
		yield* parseSSEStream(response);
	}

	private buildBody(request: CompletionRequest, stream: boolean): Record<string, unknown> {
		// Normalize messages: ensure content is never null (some providers reject it)
		const messages = request.messages.map((msg) => ({
			...msg,
			content: msg.content ?? "",
		}));

		return {
			model: request.model ?? this.defaultModel,
			messages,
			stream,
			...(stream && { stream_options: { include_usage: true } }),
			...(request.tools && { tools: request.tools }),
			...(request.tool_choice && { tool_choice: request.tool_choice }),
			...(request.temperature !== undefined && { temperature: request.temperature }),
			...(request.max_tokens !== undefined && { max_tokens: request.max_tokens }),
		};
	}

	/** Fetch generation stats from OpenRouter's generation endpoint. Returns null for non-OpenRouter providers. */
	async getGenerationStats(id: string): Promise<GenerationStats | null> {
		try {
			const url = `${this.baseURL}/generation?id=${encodeURIComponent(id)}`;
			const response = await fetch(url, {
				headers: { "Authorization": `Bearer ${this.apiKey}` },
			});
			if (!response.ok) return null;
			const json = await response.json();
			const data = json?.data;
			if (!data) return null;
			return {
				totalCost: typeof data.total_cost === "number" ? data.total_cost : null,
				promptTokens: typeof data.tokens_prompt === "number" ? data.tokens_prompt : null,
				completionTokens: typeof data.tokens_completion === "number" ? data.tokens_completion : null,
			};
		} catch {
			return null;
		}
	}

	private async fetch(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
		const url = `${this.baseURL}/chat/completions`;
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify(body),
			signal,
		});

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(
				`API error ${response.status}: ${text || response.statusText}\n` +
					`URL: ${url}\n` +
					`Model: ${body.model}`,
			);
		}

		return response;
	}
}
