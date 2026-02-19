import { parseSSEStream } from "@/api/streaming/stream.ts";
import type {
	CompletionRequest,
	CompletionResponse,
	LLMProvider,
	ProviderConfig,
	StreamChunk,
} from "@/api/types.ts";

export class CompletionsProvider implements LLMProvider {
	private readonly apiKey: string;
	private readonly baseURL: string;
	readonly defaultModel: string;

	constructor(config: ProviderConfig) {
		this.apiKey = config.apiKey;
		this.baseURL = config.baseURL.replace(/\/+$/, "");
		this.defaultModel = config.defaultModel ?? "kimi-k2";
	}

	async complete(request: CompletionRequest): Promise<CompletionResponse> {
		const body = this.buildBody(request, false);
		const response = await this.fetch(body);
		return await response.json() as CompletionResponse;
	}

	async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
		const body = this.buildBody(request, true);
		const response = await this.fetch(body);
		yield* parseSSEStream(response);
	}

	private buildBody(request: CompletionRequest, stream: boolean): Record<string, unknown> {
		return {
			model: request.model ?? this.defaultModel,
			messages: request.messages,
			stream,
			...(request.tools && { tools: request.tools }),
			...(request.tool_choice && { tool_choice: request.tool_choice }),
			...(request.temperature !== undefined && { temperature: request.temperature }),
			...(request.max_tokens !== undefined && { max_tokens: request.max_tokens }),
		};
	}

	private async fetch(body: Record<string, unknown>): Promise<Response> {
		const url = `${this.baseURL}/chat/completions`;
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(`${response.status} ${response.statusText}: ${text}`);
		}

		return response;
	}
}
