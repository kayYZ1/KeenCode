import type { DeltaToolCall, LLMProvider, Message, ToolCall, Usage } from "@/api/types.ts";
import { getDefinitions } from "@/core/tools/types.ts";
import type { ToolRegistry, ToolResult } from "@/core/tools/types.ts";

// ---------------------------------------------------------------------------
// Agent events — yielded by run() for the UI to consume
// ---------------------------------------------------------------------------

export type AgentEvent =
	| { type: "text_delta"; content: string }
	| { type: "tool_call_start"; id: string; name: string }
	| { type: "tool_call_args_delta"; id: string; args: string }
	| { type: "tool_call_end"; id: string }
	| { type: "tool_result"; id: string; result: ToolResult }
	| { type: "message_complete"; usage?: Usage }
	| { type: "error"; error: Error };

// ---------------------------------------------------------------------------
// Agent config
// ---------------------------------------------------------------------------

export interface AgentConfig {
	provider: LLMProvider;
	tools: ToolRegistry;
	model: string;
	systemPrompt: string;
	maxToolRounds?: number;
	temperature?: number;
}

const DEFAULT_MAX_TOOL_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Agent loop (async generator)
// ---------------------------------------------------------------------------

export async function* run(
	messages: Message[],
	config: AgentConfig,
): AsyncGenerator<AgentEvent> {
	const maxRounds = config.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
	const toolDefs = getDefinitions(config.tools);

	const context: Message[] = [
		{ role: "system", content: config.systemPrompt },
		...messages,
	];

	for (let round = 0; round < maxRounds; round++) {
		// Accumulate the assistant message from streaming deltas
		let textContent = "";
		const toolCallAccumulator = new Map<number, { id: string; name: string; args: string }>();
		let lastUsage: Usage | undefined;

		try {
			const stream = config.provider.stream({
				model: config.model,
				messages: context,
				tools: toolDefs.length > 0 ? toolDefs : undefined,
				tool_choice: toolDefs.length > 0 ? "auto" : undefined,
				temperature: config.temperature,
			});

			for await (const chunk of stream) {
				const choice = chunk.choices[0];
				if (!choice) continue;

				if (chunk.usage) lastUsage = chunk.usage;

				const delta = choice.delta;

				// Text content delta
				if (delta.content) {
					textContent += delta.content;
					yield { type: "text_delta", content: delta.content };
				}

				// Tool call deltas
				if (delta.tool_calls) {
					for (const tc of delta.tool_calls) {
						yield* processToolCallDelta(tc, toolCallAccumulator);
					}
				}
			}
		} catch (err) {
			yield { type: "error", error: err instanceof Error ? err : new Error(String(err)) };
			return;
		}

		// Emit tool_call_end for any accumulated tool calls
		for (const [, tc] of toolCallAccumulator) {
			yield { type: "tool_call_end", id: tc.id };
		}

		// Build the completed assistant message
		const toolCalls = buildToolCalls(toolCallAccumulator);
		const assistantMessage: Message = {
			role: "assistant",
			content: textContent || null,
			...(toolCalls.length > 0 && { tool_calls: toolCalls }),
		};
		context.push(assistantMessage);

		yield { type: "message_complete", usage: lastUsage };

		// If no tool calls, we're done
		if (toolCalls.length === 0) return;

		// Execute tool calls and append results
		for (const tc of toolCalls) {
			const tool = config.tools.get(tc.function.name);
			if (!tool) {
				const result: ToolResult = { content: `Unknown tool: ${tc.function.name}`, isError: true };
				yield { type: "tool_result", id: tc.id, result };
				context.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: result.content });
				continue;
			}

			let parsedArgs: unknown;
			try {
				parsedArgs = JSON.parse(tc.function.arguments);
			} catch {
				const result: ToolResult = { content: `Invalid tool arguments: ${tc.function.arguments}`, isError: true };
				yield { type: "tool_result", id: tc.id, result };
				context.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: result.content });
				continue;
			}

			try {
				const result = await tool.execute(parsedArgs);
				yield { type: "tool_result", id: tc.id, result };
				context.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: result.content });
			} catch (err) {
				const result: ToolResult = {
					content: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
					isError: true,
				};
				yield { type: "tool_result", id: tc.id, result };
				context.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: result.content });
			}
		}

		// Loop back to call the LLM again with tool results
	}

	yield { type: "error", error: new Error(`Exceeded maximum tool rounds (${maxRounds})`) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function* processToolCallDelta(
	delta: DeltaToolCall,
	accumulator: Map<number, { id: string; name: string; args: string }>,
): Generator<AgentEvent> {
	let entry = accumulator.get(delta.index);

	if (!entry) {
		entry = { id: delta.id ?? "", name: "", args: "" };
		accumulator.set(delta.index, entry);
	}

	if (delta.id) entry.id = delta.id;
	if (delta.function?.name) {
		entry.name = delta.function.name;
		yield { type: "tool_call_start", id: entry.id, name: entry.name };
	}
	if (delta.function?.arguments) {
		entry.args += delta.function.arguments;
		yield { type: "tool_call_args_delta", id: entry.id, args: delta.function.arguments };
	}
}

function buildToolCalls(
	accumulator: Map<number, { id: string; name: string; args: string }>,
): ToolCall[] {
	const sorted = [...accumulator.entries()].sort(([a], [b]) => a - b);
	return sorted.map(([, tc]) => ({
		id: tc.id,
		type: "function" as const,
		function: { name: tc.name, arguments: tc.args },
	}));
}
