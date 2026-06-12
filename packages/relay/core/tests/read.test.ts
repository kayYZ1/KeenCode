import { assertEquals } from "@std/assert";
import { readFileTool } from "../tools/read.ts";

const TMP_DIR = await Deno.makeTempDir();

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

Deno.test("read_file - reads a file successfully", async () => {
	await withFile("hello world\nsecond line\n", async (path) => {
		const result = await readFileTool.execute({ path });
		assertEquals(result.isError, undefined);
		assertEquals(result.content, "hello world\nsecond line\n");
		assertEquals(result.meta?.truncated, false);
	});
});

Deno.test("read_file - truncates content over 10000 chars", async () => {
	const longContent = "x".repeat(15_000);
	await withFile(longContent, async (path) => {
		const result = await readFileTool.execute({ path });
		assertEquals(result.isError, undefined);
		assertEquals(result.meta?.truncated, true);
		assertEquals(result.content.length, 10_000 + "\n...(truncated)".length);
		assertEquals(result.content.endsWith("...(truncated)"), true);
	});
});

Deno.test("read_file - returns error for nonexistent file", async () => {
	const result = await readFileTool.execute({ path: `${TMP_DIR}/nonexistent.txt` });
	assertEquals(result.isError, true);
	assertEquals(result.content.includes("Failed to read file"), true);
});

Deno.test("read_file - reads empty file successfully", async () => {
	await withFile("", async (path) => {
		const result = await readFileTool.execute({ path });
		assertEquals(result.isError, undefined);
		assertEquals(result.content, "");
		assertEquals(result.meta?.truncated, false);
	});
});
