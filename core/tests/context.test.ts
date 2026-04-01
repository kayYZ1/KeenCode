import { assertEquals } from "@std/assert";
import { estimateMessageTokens, estimateTokens, trimContext } from "@/core/context.ts";
import type { Message } from "@/api/types.ts";

// ---------------------------------------------------------------------------
// estimateTokens
// ---------------------------------------------------------------------------

Deno.test("estimateTokens - basic string", () => {
	assertEquals(estimateTokens("hello"), 2); // ceil(5/3) = 2
});

Deno.test("estimateTokens - empty string", () => {
	assertEquals(estimateTokens(""), 0);
});

// ---------------------------------------------------------------------------
// estimateMessageTokens
// ---------------------------------------------------------------------------

Deno.test("estimateMessageTokens - message with content only", () => {
	const msg: Message = { role: "user", content: "hello" };
	// overhead 8 + estimateTokens("hello") = 8 + 2 = 10
	assertEquals(estimateMessageTokens(msg), 10);
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
	// overhead 8 + estimateTokens("read_file") [ceil(9/3)=3] + estimateTokens('{"path":"/tmp"}') [ceil(15/3)=5] = 16
	assertEquals(estimateMessageTokens(msg), 16);
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
	// Add COMPLETION_HEADROOM (16_000) since trimContext subtracts it from maxTokens
	const totalBefore = messages.reduce((s, m) => s + estimateMessageTokens(m), 0);
	const result = trimContext(messages, { maxTokens: totalBefore + 16_000 - 10, preserveRecentTurns: 2 });

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

	// sys=9, old question=12, old answer=12, new question=12, new answer=12 = 57
	// Budget = maxTokens - 16_000, so set maxTokens = 33 + 16_000 = 16_033
	// Budget of 33 = sys(9) + new question(12) + new answer(12) = 33
	// Note: first user ("old question") is non-droppable, but old answer is droppable
	const result = trimContext(messages, { maxTokens: 16_033, preserveRecentTurns: 2 });

	// System is always kept
	assertEquals(result[0].role, "system");
	// Old assistant should be dropped (old user is non-droppable as first user msg)
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

	// Budget = maxTokens - 16_000; need system to survive even at very tight budget
	const result = trimContext(messages, { maxTokens: 16_020, preserveRecentTurns: 1 });

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

	// sys=9, old=9, old reply=11, recent1=11, recent reply1=13, recent2=11, recent reply2=13
	// Budget = maxTokens - 16_000. Need recent 4 turns + sys = 9+11+13+11+13=57
	// "old" (first user) is non-droppable, so it survives too; "old reply" should be dropped
	const result = trimContext(messages, { maxTokens: 57 + 16_000, preserveRecentTurns: 4 });

	// Last 4 turns should survive
	assertEquals(result.some((m) => m.content === "recent2"), true);
	assertEquals(result.some((m) => m.content === "recent reply2"), true);
	assertEquals(result.some((m) => m.content === "recent1"), true);
	assertEquals(result.some((m) => m.content === "recent reply1"), true);
	// Old assistant reply should be dropped
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

	const result = trimContext(messages, { maxTokens: 20 + 16_000, preserveRecentTurns: 2 });

	// The assistant+tool group should be dropped together
	assertEquals(result.some((m) => m.role === "tool" && m.tool_call_id === "c1"), false);
	assertEquals(result.some((m) => m.tool_calls?.some((tc) => tc.id === "c1")), false);
	// Recent turns kept
	assertEquals(result.some((m) => m.content === "latest"), true);
	assertEquals(result.some((m) => m.content === "final"), true);
});
