import { assertEquals } from "@std/assert";
import { splitText, wrapText } from "../core/primitives/wrap-text.ts";

Deno.test("wrapText - wraps long text at word boundaries", () => {
	const result = wrapText("hello world foo", 10);
	assertEquals(result, ["hello", "world foo"]);
});

Deno.test("wrapText - breaks words longer than width", () => {
	const result = wrapText("abcdefghij", 4);
	assertEquals(result, ["abcd", "efgh", "ij"]);
});

Deno.test("wrapText - handles empty string", () => {
	const result = wrapText("", 10);
	assertEquals(result, [""]);
});

Deno.test("wrapText - handles width of 0", () => {
	const result = wrapText("hello", 0);
	assertEquals(result, []);
});

Deno.test("wrapText - preserves single words shorter than width", () => {
	const result = wrapText("hi", 10);
	assertEquals(result, ["hi"]);
});

Deno.test("splitText - splits text at exact character boundaries", () => {
	const result = splitText("abcdefghij", 4);
	assertEquals(result, ["abcd", "efgh", "ij"]);
});

Deno.test("splitText - handles text shorter than width", () => {
	const result = splitText("abc", 10);
	assertEquals(result, ["abc"]);
});

Deno.test("splitText - handles empty string", () => {
	const result = splitText("", 10);
	assertEquals(result, [""]);
});

Deno.test("splitText - handles exact width match", () => {
	const result = splitText("abcd", 4);
	assertEquals(result, ["abcd"]);
});
