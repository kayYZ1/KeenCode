import { assertEquals } from "@std/assert";
import { estimateTokens, estimateMessageTokens, trimContext } from "@/core/context.ts";
import type { Message } from "@/api/types.ts";

// ---------------------------------------------------------------------------
// estimateTokens
// ---------------------------------------------------------------------------

Deno.test("estimateTokens - basic string", () => {
	assertEquals(estimateTokens("hello"), 2); // ceil(5/4) = 2
});

Deno.test("estimateTokens - empty string", () => {
	assertEquals(estimateTokens(""), 0);
});

// ---------------------------------------------------------------------------
// estimateMessageTokens
// ---------------------------------------------------------------------------

Deno.test("estimateMessageTokens - message with content only", () => {
	const msg: Message = { role: "user", content: "hello" };
	// overhead 4 + estimateTokens("hello") = 4 + 2 = 6
	assertEquals(estimateMessageTokens(msg), 6);
});

Deno.test("estimateMessageTokens - message with tool_calls adds name + args tokens", () => {
	const msg: Message = {
		role: "assistant",
		content: null,
		tool_calls: [
			{
				id: "call_1",
				type: "function",
				function: { name: "read_file", arguments: '{"path":"/tmp"}' },
			},
		],
	};
	// overhead 4 + estimateTokens("read_file") [ceil(9/4)=3] + estimateTokens('{"path":"/tmp"}') [ceil(15/4)=4] = 11
	assertEquals(estimateMessageTokens(msg), 11);
});

// ---------------------------------------------------------------------------
// trimContext — under budget
// ---------------------------------------------------------------------------

Deno.test("trimContext - returns messages unchanged when under budget", () => {
	const messages: Message[] = [
		{ role: "system", content: "You are helpful." },
		{ role: "user", content: "Hi" },
	];
	const result = trimContext(messages, { maxTokens: 100_000 });
	assertEquals(result, messages);
});

// ---------------------------------------------------------------------------
// trimContext — summarization
// ---------------------------------------------------------------------------

Deno.test("trimContext - summarizes old tool results before dropping", () => {
	const longContent = "x\ny\nz\n" + "a".repeat(600);
	const messages: Message[] = [
		{ role: "system", content: "sys" },
		{
			role: "assistant",
			content: null,
			tool_calls: [{ id: "c1", type: "function", function: { name: "grep", arguments: "{}" } }],
		},
		{ role: "tool", content: longContent, tool_call_id: "c1", name: "grep" },
		{ role: "user", content: "thanks" },
		{ role: "assistant", content: "done" },
	];

	// Budget tight enough to trigger summarization but large enough to keep all turns
	const totalBefore = messages.reduce((s, m) => s + estimateMessageTokens(m), 0);
	const result = trimContext(messages, { maxTokens: totalBefore - 10, preserveRecentTurns: 2 });

	// The tool message content should be summarized
	const toolMsg = result.find((m) => m.role === "tool");
	assertEquals(toolMsg !== undefined, true);
	assertEquals(toolMsg!.content!.includes("trimmed to save context"), true);
});

// ---------------------------------------------------------------------------
// trimContext — dropping oldest droppable turns
// ---------------------------------------------------------------------------

Deno.test("trimContext - drops oldest droppable turns when still over budget", () => {
	const messages: Message[] = [
		{ role: "system", content: "sys" },
		{ role: "user", content: "old question" },
		{ role: "assistant", content: "old answer" },
		{ role: "user", content: "new question" },
		{ role: "assistant", content: "new answer" },
	];

	// Very tight budget — only room for system + last 2 turns (5+7+7=19)
	const result = trimContext(messages, { maxTokens: 19, preserveRecentTurns: 2 });

	// System is always kept
	assertEquals(result[0].role, "system");
	// Old user+assistant should be dropped
	assertEquals(result.some((m) => m.content === "old question"), false);
	assertEquals(result.some((m) => m.content === "old answer"), false);
	// Recent turns preserved
	assertEquals(result.some((m) => m.content === "new question"), true);
	assertEquals(result.some((m) => m.content === "new answer"), true);
});

// ---------------------------------------------------------------------------
// trimContext — system messages never dropped
// ---------------------------------------------------------------------------

Deno.test("trimContext - never drops system messages", () => {
	const messages: Message[] = [
		{ role: "system", content: "important system prompt" },
		{ role: "user", content: "q" },
		{ role: "assistant", content: "a" },
	];

	const result = trimContext(messages, { maxTokens: 15, preserveRecentTurns: 1 });

	assertEquals(result.some((m) => m.role === "system" && m.content === "important system prompt"), true);
});

// ---------------------------------------------------------------------------
// trimContext — preserveRecentTurns
// ---------------------------------------------------------------------------

Deno.test("trimContext - preserves recent turns", () => {
	const messages: Message[] = [
		{ role: "system", content: "sys" },
		{ role: "user", content: "old" },
		{ role: "assistant", content: "old reply" },
		{ role: "user", content: "recent1" },
		{ role: "assistant", content: "recent reply1" },
		{ role: "user", content: "recent2" },
		{ role: "assistant", content: "recent reply2" },
	];

	// sys(5) + recent1(6) + recent reply1(8) + recent2(6) + recent reply2(8) = 33
	const result = trimContext(messages, { maxTokens: 33, preserveRecentTurns: 4 });

	// Last 4 turns (recent1, recent reply1, recent2, recent reply2) should survive
	assertEquals(result.some((m) => m.content === "recent2"), true);
	assertEquals(result.some((m) => m.content === "recent reply2"), true);
	assertEquals(result.some((m) => m.content === "recent1"), true);
	assertEquals(result.some((m) => m.content === "recent reply1"), true);
	// Old turns should be dropped
	assertEquals(result.some((m) => m.content === "old"), false);
	assertEquals(result.some((m) => m.content === "old reply"), false);
});

// ---------------------------------------------------------------------------
// trimContext — assistant + tool messages grouped together
// ---------------------------------------------------------------------------

Deno.test("trimContext - groups assistant + tool messages together when dropping", () => {
	const messages: Message[] = [
		{ role: "system", content: "sys" },
		{
			role: "assistant",
			content: null,
			tool_calls: [{ id: "c1", type: "function", function: { name: "bash", arguments: '{"cmd":"ls"}' } }],
		},
		{ role: "tool", content: "file1\nfile2", tool_call_id: "c1", name: "bash" },
		{ role: "user", content: "latest" },
		{ role: "assistant", content: "final" },
	];

	const result = trimContext(messages, { maxTokens: 20, preserveRecentTurns: 2 });

	// The assistant+tool group should be dropped together
	assertEquals(result.some((m) => m.role === "tool" && m.tool_call_id === "c1"), false);
	assertEquals(result.some((m) => m.tool_calls?.some((tc) => tc.id === "c1")), false);
	// Recent turns kept
	assertEquals(result.some((m) => m.content === "latest"), true);
	assertEquals(result.some((m) => m.content === "final"), true);
});
