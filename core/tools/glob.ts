import { defineTool } from "./types.ts";

const MAX_RESULTS = 200;

export const globTool = defineTool({
	name: "glob",
	description:
		"Find files matching a glob pattern. Returns a list of matching file paths. Useful for discovering project structure and finding files by name or extension.",
	readonly: true,
	parameters: {
		type: "object",
		properties: {
			pattern: {
				type: "string",
				description: "The glob pattern to match (e.g. '**/*.ts', 'src/**/*.tsx').",
			},
			path: {
				type: "string",
				description: "The base directory to search from. Defaults to current directory.",
			},
		},
		required: ["pattern"],
	},
	async execute(input) {
		const { pattern, path } = input as { pattern: string; path?: string };
		const basePath = path ?? ".";

		try {
			const fullPattern = basePath === "." ? pattern : `${basePath.replace(/\/+$/, "")}/${pattern}`;

			const result = await new Deno.Command("bash", {
				args: ["-c", `shopt -s globstar nullglob; printf '%s\\n' ${fullPattern}`],
				stdout: "piped",
				stderr: "piped",
			}).output();

			const stdout = new TextDecoder().decode(result.stdout).trim();

			if (!stdout) {
				return { content: "No files matched the pattern." };
			}

			const files = stdout.split("\n").filter(Boolean);
			const truncated = files.length > MAX_RESULTS;
			const displayed = truncated ? files.slice(0, MAX_RESULTS) : files;

			let content = displayed.join("\n");
			if (truncated) {
				content += `\n...(${files.length - MAX_RESULTS} more files)`;
			}

			return { content, meta: { truncated } };
		} catch (err) {
			return {
				content: `Failed to glob: ${err instanceof Error ? err.message : String(err)}`,
				isError: true,
			};
		}
	},
});
