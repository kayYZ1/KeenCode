import { assertEquals } from "@std/assert";
import { signal } from "@preact/signals-core";
import {
	deleteBackward,
	deleteForward,
	insertChar,
	moveCursor,
	setCursor,
	type TextState,
} from "../render/hooks/text-utils.ts";

function createState(value = "", cursor = 0): TextState {
	return {
		value: signal(value),
		cursorPosition: signal(cursor),
	};
}

Deno.test("insertChar - inserts at cursor position", () => {
	const state = createState("ac", 1);
	insertChar(state, "b");
	assertEquals(state.value.value, "abc");
	assertEquals(state.cursorPosition.value, 2);
});

Deno.test("insertChar - inserts at start", () => {
	const state = createState("bc", 0);
	insertChar(state, "a");
	assertEquals(state.value.value, "abc");
	assertEquals(state.cursorPosition.value, 1);
});

Deno.test("insertChar - inserts at end", () => {
	const state = createState("ab", 2);
	insertChar(state, "c");
	assertEquals(state.value.value, "abc");
	assertEquals(state.cursorPosition.value, 3);
});

Deno.test("deleteBackward - deletes character before cursor", () => {
	const state = createState("abc", 2);
	const result = deleteBackward(state);
	assertEquals(result, "ac");
	assertEquals(state.value.value, "ac");
	assertEquals(state.cursorPosition.value, 1);
});

Deno.test("deleteBackward - returns null at start of string", () => {
	const state = createState("abc", 0);
	const result = deleteBackward(state);
	assertEquals(result, null);
	assertEquals(state.value.value, "abc");
});

Deno.test("deleteForward - deletes character at cursor", () => {
	const state = createState("abc", 1);
	const result = deleteForward(state);
	assertEquals(result, "ac");
	assertEquals(state.value.value, "ac");
	assertEquals(state.cursorPosition.value, 1);
});

Deno.test("deleteForward - returns null at end of string", () => {
	const state = createState("abc", 3);
	const result = deleteForward(state);
	assertEquals(result, null);
	assertEquals(state.value.value, "abc");
});

Deno.test("moveCursor - moves cursor forward", () => {
	const state = createState("abc", 0);
	moveCursor(state, 2);
	assertEquals(state.cursorPosition.value, 2);
});

Deno.test("moveCursor - moves cursor backward", () => {
	const state = createState("abc", 2);
	moveCursor(state, -1);
	assertEquals(state.cursorPosition.value, 1);
});

Deno.test("moveCursor - clamps to start", () => {
	const state = createState("abc", 1);
	moveCursor(state, -5);
	assertEquals(state.cursorPosition.value, 0);
});

Deno.test("moveCursor - clamps to end", () => {
	const state = createState("abc", 1);
	moveCursor(state, 10);
	assertEquals(state.cursorPosition.value, 3);
});

Deno.test("setCursor - sets cursor to position", () => {
	const state = createState("abc", 0);
	setCursor(state, 2);
	assertEquals(state.cursorPosition.value, 2);
});

Deno.test("setCursor - clamps to bounds", () => {
	const state = createState("abc", 0);
	setCursor(state, 100);
	assertEquals(state.cursorPosition.value, 3);

	setCursor(state, -5);
	assertEquals(state.cursorPosition.value, 0);
});
