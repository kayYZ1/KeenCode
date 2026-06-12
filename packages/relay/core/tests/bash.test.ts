import { assertEquals } from "@std/assert";
import { bashTool } from "../tools/bash.ts";

Deno.test("bash - runs a simple command", async () => {
	const result = await bashTool.execute({ command: "echo hello" });
	assertEquals(result.isError, false);
	assertEquals(result.content.includes("hello"), true);
});

Deno.test("bash - returns stderr content", async () => {
	const result = await bashTool.execute({ command: "echo oops >&2" });
	assertEquals(result.isError, false);
	assertEquals(result.content.includes("stderr:"), true);
	assertEquals(result.content.includes("oops"), true);
});

Deno.test("bash - returns isError and exit code for failing command", async () => {
	const result = await bashTool.execute({ command: "exit 1" });
	assertEquals(result.isError, true);
	assertEquals(result.content.includes("exit code 1"), true);
});

Deno.test("bash - returns no output for silent command", async () => {
	const result = await bashTool.execute({ command: "true" });
	assertEquals(result.isError, false);
	assertEquals(result.content, "(no output)");
});

Deno.test("bash - truncates long output", async () => {
	const result = await bashTool.execute({ command: "python3 -c \"print('x' * 15000)\"" });
	assertEquals(result.isError, false);
	assertEquals(result.meta?.truncated, true);
	assertEquals(result.content.endsWith("...(truncated)"), true);
});

Deno.test("bash - includes durationMs in meta", async () => {
	const result = await bashTool.execute({ command: "echo hi" });
	assertEquals(typeof result.meta?.durationMs, "number");
});
