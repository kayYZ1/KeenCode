import { assertEquals } from "@std/assert";
import { calculateCursorPosition } from "../render/elements/text-input.ts";

// --- Split mode (useWordWrap = false) ---

Deno.test("cursor split mode - cursor at start", () => {
	const { line, col } = calculateCursorPosition(0, 20, [], false);
	assertEquals(line, 0);
	assertEquals(col, 0);
});

Deno.test("cursor split mode - cursor in middle of first line", () => {
	const { line, col } = calculateCursorPosition(10, 20, [], false);
	assertEquals(line, 0);
	assertEquals(col, 10);
});

Deno.test("cursor split mode - cursor at end of first line", () => {
	const { line, col } = calculateCursorPosition(19, 20, [], false);
	assertEquals(line, 0);
	assertEquals(col, 19);
});

Deno.test("cursor split mode - cursor wraps to second line", () => {
	const { line, col } = calculateCursorPosition(20, 20, [], false);
	assertEquals(line, 1);
	assertEquals(col, 0);
});

Deno.test("cursor split mode - cursor in middle of second line", () => {
	const { line, col } = calculateCursorPosition(25, 20, [], false);
	assertEquals(line, 1);
	assertEquals(col, 5);
});

Deno.test("cursor split mode - cursor on third line", () => {
	const { line, col } = calculateCursorPosition(45, 20, [], false);
	assertEquals(line, 2);
	assertEquals(col, 5);
});

Deno.test("cursor split mode - narrow width", () => {
	const { line, col } = calculateCursorPosition(7, 3, [], false);
	assertEquals(line, 2);
	assertEquals(col, 1);
});

// --- Word-wrap mode (useWordWrap = true) ---

Deno.test("cursor word-wrap - cursor at start of first line", () => {
	const lines = ["hello world", "foo bar"];
	const { line, col } = calculateCursorPosition(0, 20, lines, true);
	assertEquals(line, 0);
	assertEquals(col, 0);
});

Deno.test("cursor word-wrap - cursor in middle of first line", () => {
	const lines = ["hello world", "foo bar"];
	const { line, col } = calculateCursorPosition(5, 20, lines, true);
	assertEquals(line, 0);
	assertEquals(col, 5);
});

Deno.test("cursor word-wrap - cursor at end of first line", () => {
	const lines = ["hello world", "foo bar"];
	const { line, col } = calculateCursorPosition(11, 20, lines, true);
	assertEquals(line, 0);
	assertEquals(col, 11);
});

Deno.test("cursor word-wrap - cursor at start of second line", () => {
	const lines = ["hello world", "foo bar"];
	// charCount after first line = 11 + 1 (space) = 12
	const { line, col } = calculateCursorPosition(12, 20, lines, true);
	assertEquals(line, 1);
	assertEquals(col, 0);
});

Deno.test("cursor word-wrap - cursor in middle of second line", () => {
	const lines = ["hello world", "foo bar"];
	const { line, col } = calculateCursorPosition(15, 20, lines, true);
	assertEquals(line, 1);
	assertEquals(col, 3);
});

Deno.test("cursor word-wrap - cursor at end of last line", () => {
	const lines = ["hello world", "foo bar"];
	// charCount after first line = 12, second line len = 7, cursor = 12+7 = 19
	const { line, col } = calculateCursorPosition(19, 20, lines, true);
	assertEquals(line, 1);
	assertEquals(col, 7);
});

Deno.test("cursor word-wrap - single line", () => {
	const lines = ["hello"];
	const { line, col } = calculateCursorPosition(3, 20, lines, true);
	assertEquals(line, 0);
	assertEquals(col, 3);
});

Deno.test("cursor word-wrap - empty lines array", () => {
	const { line, col } = calculateCursorPosition(0, 20, [], true);
	assertEquals(line, 0);
	assertEquals(col, 0);
});

Deno.test("cursor word-wrap - three lines", () => {
	const lines = ["aaa", "bbb", "ccc"];
	// After "aaa" = 3+1=4, after "bbb" = 4+3+1=8
	const { line, col } = calculateCursorPosition(9, 10, lines, true);
	assertEquals(line, 2);
	assertEquals(col, 1);
});
