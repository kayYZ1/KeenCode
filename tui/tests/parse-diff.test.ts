import { assertEquals } from "@std/assert";
import { formatDiffForDisplay, shouldShowDiff, summarizeDiff } from "../core/primitives/parse-diff.ts";

const SAMPLE_DIFF = `--- src/app.ts
+++ src/app.ts
@@ -1,4 +1,4 @@
 import { run } from "./agent.ts";
-const port = 3000;
+const port = 8080;
 run({ port });`;

Deno.test("shouldShowDiff - returns true for small diffs", () => {
	assertEquals(shouldShowDiff(SAMPLE_DIFF), true);
});

Deno.test("shouldShowDiff - returns false for large diffs", () => {
	const addLines = Array.from({ length: 35 }, (_, i) => `+line ${i}`).join("\n");
	const largeDiff = `--- a.ts\n+++ a.ts\n@@ -1,1 +1,35 @@\n${addLines}`;
	assertEquals(shouldShowDiff(largeDiff), false);
});

Deno.test("summarizeDiff - counts added and removed lines", () => {
	assertEquals(summarizeDiff(SAMPLE_DIFF), "+1, -1 lines");
});

Deno.test("summarizeDiff - handles add-only diff", () => {
	const diff = `--- a.ts\n+++ a.ts\n@@ -1,1 +1,3 @@\n context\n+new line 1\n+new line 2`;
	assertEquals(summarizeDiff(diff), "+2 lines");
});

Deno.test("summarizeDiff - handles remove-only diff", () => {
	const diff = `--- a.ts\n+++ a.ts\n@@ -1,3 +1,1 @@\n context\n-old line 1\n-old line 2`;
	assertEquals(summarizeDiff(diff), "-2 lines");
});

Deno.test("formatDiffForDisplay - produces lines with correct line numbers", () => {
	const lines = formatDiffForDisplay(SAMPLE_DIFF);
	assertEquals(lines.length, 4);
	assertEquals(lines[0], { type: "context", oldNum: 1, newNum: 1, code: 'import { run } from "./agent.ts";' });
	assertEquals(lines[1], { type: "remove", oldNum: 2, newNum: null, code: "const port = 3000;" });
	assertEquals(lines[2], { type: "add", oldNum: null, newNum: 2, code: "const port = 8080;" });
	assertEquals(lines[3], { type: "context", oldNum: 3, newNum: 3, code: "run({ port });" });
});

Deno.test("formatDiffForDisplay - skips header and hunk lines", () => {
	const lines = formatDiffForDisplay(SAMPLE_DIFF);
	const types = lines.map((l) => l.type);
	assertEquals(types.includes("header" as typeof types[number]), false);
	assertEquals(types.includes("hunk" as typeof types[number]), false);
});
