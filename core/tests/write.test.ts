import { assertEquals } from "@std/assert";
import { writeFileTool } from "../tools/write.ts";

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

Deno.test("write_file - creates a new file", async () => {
	const path = `${TMP_DIR}/new-${crypto.randomUUID()}.txt`;
	try {
		const result = await writeFileTool.execute({ path, content: "new content\n" });
		assertEquals(result.isError, undefined);
		assertEquals(result.content.includes("Created"), true);
		assertEquals(await Deno.readTextFile(path), "new content\n");
	} finally {
		await Deno.remove(path).catch(() => {});
	}
});

Deno.test("write_file - overwrites existing file", async () => {
	await withFile("original\n", async (path) => {
		const result = await writeFileTool.execute({ path, content: "updated\n" });
		assertEquals(result.isError, undefined);
		assertEquals(result.content.includes("Wrote"), true);
		assertEquals(await Deno.readTextFile(path), "updated\n");
	});
});

Deno.test("write_file - returns diff output in content", async () => {
	await withFile("old line\n", async (path) => {
		const result = await writeFileTool.execute({ path, content: "new line\n" });
		assertEquals(result.content.includes("-old line"), true);
		assertEquals(result.content.includes("+new line"), true);
	});
});

Deno.test("write_file - returns diff in meta", async () => {
	await withFile("before\n", async (path) => {
		const result = await writeFileTool.execute({ path, content: "after\n" });
		assertEquals(typeof result.meta?.diff, "string");
		assertEquals((result.meta!.diff as string).includes("-before"), true);
		assertEquals((result.meta!.diff as string).includes("+after"), true);
	});
});

Deno.test("write_file - handles writing empty content", async () => {
	const path = `${TMP_DIR}/empty-${crypto.randomUUID()}.txt`;
	try {
		const result = await writeFileTool.execute({ path, content: "" });
		assertEquals(result.isError, undefined);
		assertEquals(await Deno.readTextFile(path), "");
	} finally {
		await Deno.remove(path).catch(() => {});
	}
});

Deno.test("write_file - errors on invalid path", async () => {
	const result = await writeFileTool.execute({ path: "/nonexistent_dir_xxx/file.txt", content: "data" });
	assertEquals(result.isError, true);
	assertEquals(result.content.includes("Failed to write file"), true);
});
