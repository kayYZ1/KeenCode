export { run } from "./agent.ts";
export type { AgentConfig, AgentEvent } from "./agent.ts";

export { runAgentLoop } from "./runner.ts";
export type { RunnerCallbacks } from "./runner.ts";

export {
	createUIToolCall,
	getToolDisplayName,
	getToolDisplayOutput,
	parseDiffLines,
	summarizeToolArgs,
	TOOL_DISPLAY_NAMES,
} from "./display.ts";
export type { DiffLine, UIToolCall } from "./display.ts";

export { estimateMessageTokens, estimateTokens, trimContext } from "./context.ts";
export type { TrimOptions } from "./context.ts";

export { createToolRegistry, defaultTools, defineTool, getDefinitions } from "./tools/index.ts";
export type { Tool, ToolRegistry, ToolResult } from "./tools/index.ts";

export { entriesToMessages, SessionManager, stripAttachedContext } from "./sessions/index.ts";
export { sessionDir, sessionsBaseDir } from "./sessions/index.ts";
export type { Entry, MessageEntry, Session, SessionHeader, SessionSummary, ToolResultEntry } from "./sessions/index.ts";

export { homeDir, relayDir } from "./paths.ts";
