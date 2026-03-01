export { bashTool } from "./bash.ts";
export { editFileTool } from "./edit.ts";
export { globTool } from "./glob.ts";
export { grepTool } from "./grep.ts";
export { readFileTool } from "./read.ts";
export { writeFileTool } from "./write.ts";

export { createToolRegistry, defineTool, getDefinitions } from "./types.ts";
export type { Tool, ToolRegistry, ToolResult } from "./types.ts";

import { bashTool } from "./bash.ts";
import { editFileTool } from "./edit.ts";
import { globTool } from "./glob.ts";
import { grepTool } from "./grep.ts";
import { readFileTool } from "./read.ts";
import { writeFileTool } from "./write.ts";
import type { Tool } from "./types.ts";

/** All built-in tools. */
export const defaultTools: Tool[] = [
	bashTool,
	readFileTool,
	writeFileTool,
	editFileTool,
	grepTool,
	globTool,
];
