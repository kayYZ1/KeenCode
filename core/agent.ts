import type { LLMProvider, Message, Usage } from "@/api/types.ts";
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
	// TODO: Phase 3 — full implementation
	void messages;
	void config;
	void DEFAULT_MAX_TOOL_ROUNDS;
	yield { type: "message_complete" as const };
}
