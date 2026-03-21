export { createToolRegistry, defineTool, getDefinitions } from "./types.ts";
export type { Tool, ToolRegistry, ToolResult } from "./types.ts";

import { bashTool } from "./bash.ts";
import { editFileTool } from "./edit.ts";
import { globTool } from "./glob.ts";
import { grepTool } from "./grep.ts";
import { readDirectoryTool } from "./read-dir.ts";
import { readFileTool } from "./read.ts";
import { writeFileTool } from "./write.ts";
import type { Tool } from "./types.ts";

/** All built-in tools. */
export const defaultTools: Tool[] = [
	bashTool,
	readFileTool,
	readDirectoryTool,
	writeFileTool,
	editFileTool,
	grepTool,
	globTool,
];
