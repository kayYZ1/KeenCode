import { assertEquals } from "@std/assert";
import { editFileTool } from "../tools/edit.ts";

const TMP_DIR = await Deno.makeTempDir();

// Clean up the temp directory after all tests
globalThis.addEventListener("unload", () => {
	Deno.removeSync(TMP_DIR, { recursive: true });
});

async function withFile(content: string, fn: (path: string) => Promise<void>) {
	const path = `${TMP_DIR}/test-${crypto.randomUUID()}.txt`;
	await Deno.writeTextFile(path, content);
	try {
		await fn(path);
	} finally {
		await Deno.remove(path).catch(() => {});
	}
}

async function readFile(path: string): Promise<string> {
	return await Deno.readTextFile(path);
}

Deno.test("edit_file - replaces a unique match", async () => {
	await withFile("hello world\ngoodbye world\n", async (path) => {
		const result = await editFileTool.execute({ path, old_str: "hello world", new_str: "hi world" });
		assertEquals(result.isError, undefined);
		assertEquals(await readFile(path), "hi world\ngoodbye world\n");
		assertEquals(result.content.includes("Replaced 1 occurrence"), true);
	});
});

Deno.test("edit_file - errors on no match", async () => {
	await withFile("hello world\n", async (path) => {
		const result = await editFileTool.execute({ path, old_str: "not here", new_str: "x" });
		assertEquals(result.isError, true);
		assertEquals(result.content.includes("No match found"), true);
	});
});

Deno.test("edit_file - errors on multiple matches without replace_all", async () => {
	await withFile("foo bar foo\n", async (path) => {
		const result = await editFileTool.execute({ path, old_str: "foo", new_str: "baz" });
		assertEquals(result.isError, true);
		assertEquals(result.content.includes("Found 2 matches"), true);
	});
});

Deno.test("edit_file - replace_all replaces all occurrences", async () => {
	await withFile("foo bar foo baz foo\n", async (path) => {
		const result = await editFileTool.execute({
			path,
			old_str: "foo",
			new_str: "qux",
			replace_all: true,
		});
		assertEquals(result.isError, undefined);
		assertEquals(await readFile(path), "qux bar qux baz qux\n");
		assertEquals(result.content.includes("3 occurrences"), true);
	});
});

Deno.test("edit_file - errors when old_str equals new_str", async () => {
	await withFile("hello\n", async (path) => {
		const result = await editFileTool.execute({ path, old_str: "hello", new_str: "hello" });
		assertEquals(result.isError, true);
		assertEquals(result.content.includes("identical"), true);
	});
});

Deno.test("edit_file - handles multi-line replacements", async () => {
	const content = "function greet() {\n\treturn 'hello';\n}\n";
	await withFile(content, async (path) => {
		const result = await editFileTool.execute({
			path,
			old_str: "function greet() {\n\treturn 'hello';\n}",
			new_str: "function greet() {\n\treturn 'hi';\n}",
		});
		assertEquals(result.isError, undefined);
		assertEquals(await readFile(path), "function greet() {\n\treturn 'hi';\n}\n");
	});
});

Deno.test("edit_file - hints about whitespace mismatch", async () => {
	await withFile("  indented line\n", async (path) => {
		const result = await editFileTool.execute({ path, old_str: "\tindented line", new_str: "x" });
		// Trimmed versions match but exact string differs — hint about whitespace
		assertEquals(result.isError, true);
		assertEquals(result.content.includes("whitespace"), true);
	});
});

Deno.test("edit_file - hints about partial first-line match", async () => {
	await withFile("first line here\nsecond line\n", async (path) => {
		const result = await editFileTool.execute({
			path,
			old_str: "first line here\nwrong second line",
			new_str: "x",
		});
		assertEquals(result.isError, true);
		assertEquals(result.content.includes("first line"), true);
	});
});

Deno.test("edit_file - errors on nonexistent file", async () => {
	const result = await editFileTool.execute({
		path: `${TMP_DIR}/nonexistent.txt`,
		old_str: "x",
		new_str: "y",
	});
	assertEquals(result.isError, true);
	assertEquals(result.content.includes("Failed to edit file"), true);
});
