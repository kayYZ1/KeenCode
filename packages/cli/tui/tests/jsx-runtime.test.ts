import { assertEquals, assertExists } from "@std/assert";
import { Fragment, jsx, jsxs } from "../render/jsx-runtime.ts";

Deno.test("jsx - creates VNode with string type", () => {
	const node = jsx("box", { width: 10 });
	assertEquals(node.type, "box");
	assertEquals(node.props.width, 10);
});

Deno.test("jsx - creates VNode with function type", () => {
	const Component = (props: { name: string }) => jsx("text", { children: props.name });
	const node = jsx(Component, { name: "test" });
	assertEquals(typeof node.type, "function");
	assertEquals(node.props.name, "test");
});

Deno.test("jsx - handles children prop", () => {
	const node = jsx("box", { children: "hello" });
	assertEquals(node.props.children, "hello");
});

Deno.test("jsx - handles array children", () => {
	const children = [jsx("text", { children: "a" }), jsx("text", { children: "b" })];
	const node = jsxs("box", { children });
	assertEquals(Array.isArray(node.props.children), true);
	assertEquals(node.props.children.length, 2);
});

Deno.test("Fragment - creates fragment VNode", () => {
	const node = Fragment({ children: jsx("text", { children: "hi" }) });
	assertEquals(node.type, "fragment");
	assertExists(node.props.children);
});
