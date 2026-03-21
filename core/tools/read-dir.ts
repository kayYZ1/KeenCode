import { defineTool } from "./types.ts";

const MAX_OUTPUT = 10_000;
const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "out", "build", "coverage", ".next", "target", ".cache"]);

export const readDirectoryTool = defineTool({
	name: "read_directory",
	description:
		"Read the contents of all files in a directory recursively. Returns the content of each file prefixed with its path. Useful when mentioning a folder with @ to provide full context.",
	readonly: true,
	parameters: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "The path to the directory to read.",
			},
		},
		required: ["path"],
	},
	async execute(input) {
		const { path } = input as { path: string };

		try {
			const stat = await Deno.stat(path);
			if (!stat.isDirectory) {
				return { content: `Not a directory: ${path}`, isError: true };
			}
		} catch (err) {
			return {
				content: `Failed to stat path: ${err instanceof Error ? err.message : String(err)}`,
				isError: true,
			};
		}

		const parts: string[] = [];
		let totalLen = 0;
		let truncated = false;

		async function walk(dir: string) {
			if (truncated) return;
			let entries: Deno.DirEntry[];
			try {
				entries = await Array.fromAsync(Deno.readDir(dir));
			} catch {
				return;
			}
			entries.sort((a, b) => a.name.localeCompare(b.name));

			for (const entry of entries) {
				if (truncated) return;
				const fullPath = `${dir}/${entry.name}`;

				if (entry.isDirectory) {
					if (IGNORE_DIRS.has(entry.name)) continue;
					await walk(fullPath);
				} else if (entry.isFile) {
					try {
						const content = await Deno.readTextFile(fullPath);
						const header = `--- ${fullPath} ---\n`;
						const section = header + content + "\n\n";

						if (totalLen + section.length > MAX_OUTPUT) {
							const remaining = MAX_OUTPUT - totalLen;
							if (remaining > header.length) {
								parts.push(header + content.slice(0, remaining - header.length));
							}
							truncated = true;
							return;
						}

						parts.push(section);
						totalLen += section.length;
					} catch {
						// skip binary / unreadable files
					}
				}
			}
		}

		await walk(path.replace(/\/+$/, ""));

		let content = parts.join("");
		if (truncated) content += "\n...(truncated)";

		if (!content.trim()) {
			return { content: "Directory is empty or contains no readable files." };
		}

		return { content, meta: { truncated } };
	},
});
