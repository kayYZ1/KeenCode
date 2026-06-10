import type { Message, Usage } from "@/api/types.ts";
import { type AgentConfig, run } from "@/core/agent.ts";
import type { ToolResult } from "@/core/tools/types.ts";

/**
 * Callbacks for the agent runner — implemented by each client (TUI, HTTP, etc.).
 * Each callback may return a Promise; the runner will await it.
 */
export interface RunnerCallbacks {
	/** Called for each text delta from the LLM stream. */
	onTextDelta(delta: string): void | Promise<void>;
	/** Called when a tool call is fully received (args already accumulated). */
	onToolCallEnd(id: string, name: string, args: string): void | Promise<void>;
	/** Called when a tool execution completes. */
	onToolResult(id: string, result: ToolResult): void | Promise<void>;
	/** Called when the LLM finishes generating a single message. */
	onMessageComplete(usage?: Usage, generationId?: string): void | Promise<void>;
	/** Called when a full agent turn completes (assistant message + tool results). */
	onTurnComplete(assistantMessage: Message, toolResults: Message[]): void | Promise<void>;
	/** Called when the agent encounters an error. */
	onError(error: Error): void | Promise<void>;
}

/**
 * Runs the agent loop and invokes callbacks as events are received.
 *
 * This is a thin wrapper around core/agent.ts's `run()` async generator that:
 * - Accumulates tool call args across deltas
 * - Tracks tool call names from start events
 * - Checks for abort signals
 * - Awaits each callback so async work (e.g. session writes) completes in order
 *
 * Consumers (TUI, HTTP SSE, WebSocket, etc.) implement {@link RunnerCallbacks}
 * to handle state updates in their own medium.
 */
export async function runAgentLoop(
	messages: Message[],
	config: AgentConfig,
	callbacks: RunnerCallbacks,
): Promise<void> {
	const events = run(messages, config);
	const toolCallArgs = new Map<string, string>();
	const toolCallNames = new Map<string, string>();

	for await (const event of events) {
		switch (event.type) {
			case "text_delta":
				await callbacks.onTextDelta(event.content);
				break;

			case "tool_call_start":
				toolCallNames.set(event.id, event.name);
				toolCallArgs.set(event.id, "");
				break;

			case "tool_call_args_delta": {
				const current = toolCallArgs.get(event.id) ?? "";
				toolCallArgs.set(event.id, current + event.args);
				break;
			}

			case "tool_call_end": {
				const name = toolCallNames.get(event.id) ?? "unknown";
				const args = toolCallArgs.get(event.id) ?? "";
				await callbacks.onToolCallEnd(event.id, name, args);
				break;
			}

			case "tool_result":
				await callbacks.onToolResult(event.id, event.result);
				break;

			case "message_complete":
				await callbacks.onMessageComplete(event.usage, event.generationId);
				break;

			case "turn_complete":
				await callbacks.onTurnComplete(event.assistantMessage, event.toolResults);
				break;

			case "error":
				await callbacks.onError(event.error);
				break;
		}

		if (config.signal?.aborted) break;
	}
}
