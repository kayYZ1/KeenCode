// Public API surface for @vvtxn/relay

// Agent loop
export { run } from "./core/agent.ts";
export type { AgentConfig, AgentEvent } from "./core/agent.ts";

// Agent runner (convenience wrapper with callbacks)
export { runAgentLoop } from "./core/runner.ts";
export type { RunnerCallbacks } from "./core/runner.ts";

// Display utilities
export {
	createUIToolCall,
	getToolDisplayName,
	getToolDisplayOutput,
	parseDiffLines,
	summarizeToolArgs,
	TOOL_DISPLAY_NAMES,
} from "./core/display.ts";
export type { DiffLine, UIToolCall } from "./core/display.ts";

// Context trimming
export { estimateMessageTokens, estimateTokens, trimContext } from "./core/context.ts";
export type { TrimOptions } from "./core/context.ts";

// Tools
export { createToolRegistry, defaultTools, defineTool, getDefinitions } from "./core/tools/index.ts";
export type { Tool, ToolRegistry, ToolResult } from "./core/tools/index.ts";

// Sessions
export { entriesToMessages, SessionManager, stripAttachedContext } from "./core/sessions/index.ts";
export { sessionDir, sessionsBaseDir } from "./core/sessions/index.ts";
export type {
	Entry,
	MessageEntry,
	Session,
	SessionHeader,
	SessionSummary,
	ToolResultEntry,
} from "./core/sessions/index.ts";

// Paths
export { homeDir, relayDir } from "./core/paths.ts";

// API types
export type {
	CompletionRequest,
	CompletionResponse,
	JsonSchema,
	LLMProvider,
	Message,
	ProviderConfig,
	StreamChunk,
	ToolCall,
	ToolDefinition,
	Usage,
} from "./api/types.ts";

// API providers
export { CompletionsProvider } from "./api/providers/completions.ts";
