import { defineTool } from "./types.ts";

const MAX_OUTPUT = 10_000;
const DEFAULT_TIMEOUT = 30_000;

export const bashTool = defineTool({
	name: "bash",
	description:
		"Execute a shell command and return its output. Use for running programs, installing packages, or any system operation. Commands run in the current working directory.",
	parameters: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description: "The shell command to execute.",
			},
			timeout: {
				type: "number",
				description: "Timeout in milliseconds. Defaults to 30000.",
			},
		},
		required: ["command"],
	},
	async execute(input) {
		const { command, timeout } = input as { command: string; timeout?: number };
		const start = performance.now();

		try {
			const process = new Deno.Command("bash", {
				args: ["-c", command],
				stdout: "piped",
				stderr: "piped",
			});

			const child = process.spawn();

			const timeoutMs = timeout ?? DEFAULT_TIMEOUT;
			const timer = setTimeout(() => {
				try {
					child.kill();
				} catch {
					// Process may have already exited
				}
			}, timeoutMs);

			const result = await child.output();
			clearTimeout(timer);

			const durationMs = Math.round(performance.now() - start);
			const stdout = new TextDecoder().decode(result.stdout);
			const stderr = new TextDecoder().decode(result.stderr);

			let output = "";
			if (stdout) output += stdout;
			if (stderr) output += (output ? "\n" : "") + `stderr:\n${stderr}`;
			if (!output) output = "(no output)";

			const truncated = output.length > MAX_OUTPUT;
			if (truncated) {
				output = output.slice(0, MAX_OUTPUT) + "\n...(truncated)";
			}

			return {
				content: result.success ? output : `exit code ${result.code}\n${output}`,
				isError: !result.success,
				meta: { truncated, durationMs },
			};
		} catch (err) {
			return {
				content: `Failed to execute command: ${err instanceof Error ? err.message : String(err)}`,
				isError: true,
				meta: { durationMs: Math.round(performance.now() - start) },
			};
		}
	},
});
