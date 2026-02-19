import { defineTool } from "./types.ts";

export const writeFileTool = defineTool({
	name: "write_file",
	description: "Write content to a file. Creates the file if it does not exist, or overwrites it if it does.",
	parameters: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "The path to the file to write.",
			},
			content: {
				type: "string",
				description: "The content to write to the file.",
			},
		},
		required: ["path", "content"],
	},
	async execute(input) {
		const { path, content } = input as { path: string; content: string };

		try {
			await Deno.writeTextFile(path, content);
			return {
				content: `Successfully wrote ${content.length} bytes to ${path}`,
			};
		} catch (err) {
			return {
				content: `Failed to write file: ${err instanceof Error ? err.message : String(err)}`,
				isError: true,
			};
		}
	},
});
