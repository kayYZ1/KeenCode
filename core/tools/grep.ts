import { defineTool } from "./types.ts";

const MAX_OUTPUT = 10_000;

export const grepTool = defineTool({
	name: "grep",
	description:
		"Search for a pattern in files using ripgrep (rg). Returns matching lines with file paths and line numbers. Falls back to grep if rg is not available.",
	parameters: {
		type: "object",
		properties: {
			pattern: {
				type: "string",
				description: "The search pattern (regex by default).",
			},
			path: {
				type: "string",
				description: "The directory or file to search in. Defaults to current directory.",
			},
			flags: {
				type: "string",
				description: "Additional flags to pass to the search command (e.g. '-i' for case-insensitive).",
			},
		},
		required: ["pattern"],
	},
	async execute(input) {
		const { pattern, path, flags } = input as { pattern: string; path?: string; flags?: string };
		const searchPath = path ?? ".";

		const args = ["--line-number", "--no-heading", "--color=never"];
		if (flags) args.push(...flags.split(/\s+/));
		args.push(pattern, searchPath);

		try {
			// Try ripgrep first, fall back to grep -rn
			let result: Deno.CommandOutput;
			try {
				result = await new Deno.Command("rg", { args, stdout: "piped", stderr: "piped" }).output();
			} catch {
				const grepArgs = ["-rn", "--color=never"];
				if (flags) grepArgs.push(...flags.split(/\s+/));
				grepArgs.push(pattern, searchPath);
				result = await new Deno.Command("grep", { args: grepArgs, stdout: "piped", stderr: "piped" }).output();
			}

			const stdout = new TextDecoder().decode(result.stdout);
			const stderr = new TextDecoder().decode(result.stderr);

			if (!stdout && result.code === 1) {
				return { content: "No matches found." };
			}

			if (!result.success && result.code !== 1) {
				return { content: `Search failed: ${stderr || `exit code ${result.code}`}`, isError: true };
			}

			const truncated = stdout.length > MAX_OUTPUT;
			return {
				content: truncated ? stdout.slice(0, MAX_OUTPUT) + "\n...(truncated)" : stdout,
				meta: { truncated },
			};
		} catch (err) {
			return {
				content: `Failed to search: ${err instanceof Error ? err.message : String(err)}`,
				isError: true,
			};
		}
	},
});
