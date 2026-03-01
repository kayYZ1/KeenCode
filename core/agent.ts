import type { DeltaToolCall, LLMProvider, Message, ToolCall, Usage } from "@/api/types.ts";
import { getDefinitions } from "@/core/tools/types.ts";
import type { ToolRegistry, ToolResult } from "@/core/tools/types.ts";
import { trimContext, type TrimOptions } from "@/core/context.ts";

// ---------------------------------------------------------------------------
// Agent events — yielded by run() for the UI to consume
// ---------------------------------------------------------------------------

export type AgentEvent =
	| { type: "text_delta"; content: string }
	| { type: "tool_call_start"; id: string; name: string }
	| { type: "tool_call_args_delta"; id: string; args: string }
	| { type: "tool_call_end"; id: string }
	| { type: "tool_result"; id: string; result: ToolResult }
	| { type: "message_complete"; usage?: Usage; generationId?: string }
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
	contextLimit?: TrimOptions;
	signal?: AbortSignal;
}

const DEFAULT_MAX_TOOL_ROUNDS = 10;
const REFLECTION_INTERVAL = 3;
const MAX_API_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

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

	const recentCallSignatures: string[] = [];

	for (let round = 0; round < maxRounds; round++) {
		if (config.signal?.aborted) return;

		// Self-reflection: after every N tool rounds, prompt the model to assess progress
		if (round > 0 && round % REFLECTION_INTERVAL === 0) {
			context.push({
				role: "system",
				content:
					`You have completed ${round} tool rounds. Before continuing, briefly assess: Are you making progress toward the user's goal? If you are stuck or repeating yourself, try a different approach.`,
			});
		}

		// Accumulate the assistant message from streaming deltas
		let textContent = "";
		const toolCallAccumulator = new Map<number, { id: string; name: string; args: string }>();
		let lastUsage: Usage | undefined;
		let generationId: string | undefined;

		const useTools = toolDefs.length > 0;
		const effectiveContext = config.contextLimit ? trimContext(context, config.contextLimit) : context;
		let streamSuccess = false;

		for (let attempt = 0; attempt < MAX_API_RETRIES; attempt++) {
			// Reset accumulators on retry
			textContent = "";
			toolCallAccumulator.clear();
			lastUsage = undefined;
			generationId = undefined;

			try {
				const stream = config.provider.stream({
					model: config.model,
					messages: effectiveContext,
					tools: useTools ? toolDefs : undefined,
					temperature: config.temperature,
					signal: config.signal,
				});

				for await (const chunk of stream) {
					if (chunk.id) generationId = chunk.id;
					if (chunk.usage) lastUsage = chunk.usage;

					const choice = chunk.choices[0];
					if (!choice) continue;

					const delta = choice.delta;

					if (delta.content) {
						textContent += delta.content;
						yield { type: "text_delta", content: delta.content };
					}

					if (delta.tool_calls) {
						for (const tc of delta.tool_calls) {
							yield* processToolCallDelta(tc, toolCallAccumulator);
						}
					}
				}

				streamSuccess = true;
				break;
			} catch (err) {
				if (attempt < MAX_API_RETRIES - 1 && isRetryableError(err)) {
					const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
					await new Promise((resolve) => setTimeout(resolve, delay));
					continue;
				}
				yield { type: "error", error: err instanceof Error ? err : new Error(String(err)) };
				return;
			}
		}

		if (!streamSuccess) {
			yield { type: "error", error: new Error("LLM API failed after retries") };
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

		yield { type: "message_complete", usage: lastUsage, generationId };

		// If no tool calls, we're done
		if (toolCalls.length === 0) return;

		// Loop detection: check if the model is repeating the exact same tool calls
		const callSignature = toolCalls.map((tc) => `${tc.function.name}:${tc.function.arguments}`).join("|");
		const repeated = recentCallSignatures.filter((s) => s === callSignature).length;
		recentCallSignatures.push(callSignature);

		if (repeated >= 2) {
			context.push({
				role: "system",
				content:
					"You have repeated the same tool calls 3 times. You are stuck in a loop. Stop and either try a completely different approach or respond to the user explaining what went wrong.",
			});
		}

		// Execute tool calls with dependency-aware ordering:
		// read-only tools run in parallel first, then side-effect tools run sequentially
		const readonlyCalls = toolCalls.filter((tc) => config.tools.get(tc.function.name)?.readonly);
		const sideEffectCalls = toolCalls.filter((tc) => !config.tools.get(tc.function.name)?.readonly);

		const toolResults: { tc: ToolCall; result: ToolResult }[] = [];

		if (readonlyCalls.length > 0) {
			const results = await Promise.all(readonlyCalls.map((tc) => executeTool(tc, config.tools)));
			toolResults.push(...results);
		}

		for (const tc of sideEffectCalls) {
			toolResults.push(await executeTool(tc, config.tools));
		}

		// Emit results in original tool call order
		for (const tc of toolCalls) {
			const entry = toolResults.find((r) => r.tc.id === tc.id)!;
			yield { type: "tool_result", id: tc.id, result: entry.result };
			context.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: entry.result.content });
		}

		// Grounding: after side-effect tools, nudge the model to verify its changes
		if (sideEffectCalls.length > 0) {
			const toolNames = sideEffectCalls.map((tc) => tc.function.name).join(", ");
			context.push({
				role: "system",
				content:
					`You just ran side-effect tools (${toolNames}). Verify your changes worked as expected before proceeding — read the affected files or run a check command.`,
			});
		}

		// Loop back to call the LLM again with tool results
	}

	yield { type: "error", error: new Error(`Exceeded maximum tool rounds (${maxRounds})`) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRetryableError(err: unknown): boolean {
	if (err instanceof DOMException && err.name === "AbortError") return false;
	const msg = err instanceof Error ? err.message : String(err);
	return /\b(429|500|502|503|504)\b/.test(msg) ||
		msg.includes("network") ||
		msg.includes("ECONNRESET") ||
		msg.includes("fetch failed") ||
		msg.includes("ETIMEDOUT");
}

async function executeTool(tc: ToolCall, tools: ToolRegistry): Promise<{ tc: ToolCall; result: ToolResult }> {
	const tool = tools.get(tc.function.name);
	if (!tool) {
		return { tc, result: enrichError(tc.function.name, `Unknown tool: ${tc.function.name}`, "unknown_tool") };
	}

	let parsedArgs: unknown;
	try {
		parsedArgs = JSON.parse(tc.function.arguments);
	} catch {
		return { tc, result: enrichError(tc.function.name, tc.function.arguments, "invalid_args") };
	}

	try {
		const result = await tool.execute(parsedArgs);
		return { tc, result };
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : String(err);
		return { tc, result: enrichError(tc.function.name, errorMsg, "execution") };
	}
}

type ErrorKind = "unknown_tool" | "invalid_args" | "execution";

function enrichError(toolName: string, rawError: string, kind: ErrorKind): ToolResult {
	const hints: Record<ErrorKind, string> = {
		unknown_tool:
			`Available tools may have different names. Check the tool list and try again with the correct name.`,
		invalid_args:
			`The arguments could not be parsed as JSON. Review the tool's parameter schema and provide valid JSON.`,
		execution: getExecutionHint(rawError),
	};

	return {
		content: `Error [${toolName}]: ${rawError}\n\nHint: ${hints[kind]}`,
		isError: true,
	};
}

function getExecutionHint(error: string): string {
	if (error.includes("No such file") || error.includes("ENOENT") || error.includes("not found")) {
		return "The file or path does not exist. Use glob to find the correct path before retrying.";
	}
	if (error.includes("Permission denied") || error.includes("EACCES")) {
		return "Permission denied. Check file permissions or try a different approach.";
	}
	if (error.includes("command not found")) {
		return "The command was not found. Check spelling or verify the tool is installed.";
	}
	if (error.includes("timed out") || error.includes("timeout")) {
		return "The operation timed out. Try a simpler command or increase the timeout.";
	}
	return "The tool execution failed. Review the error message and try a different approach.";
}

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
