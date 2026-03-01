import { defineTool } from "./types.ts";

interface EditInput {
	path: string;
	old_str: string;
	new_str: string;
	replace_all?: boolean;
}

export const editFileTool = defineTool({
	name: "edit_file",
	description:
		"Edit a file by replacing an exact string match with new content. " +
		"The old_str must match exactly one location in the file (unless replace_all is true). " +
		"Returns a unified diff of the change. Always read the file first to get the exact text to replace.",
	parameters: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "The path to the file to edit.",
			},
			old_str: {
				type: "string",
				description: "The exact string to find in the file. Must match exactly (including whitespace and indentation).",
			},
			new_str: {
				type: "string",
				description: "The replacement string.",
			},
			replace_all: {
				type: "boolean",
				description: "If true, replace all occurrences. Otherwise old_str must match exactly once.",
			},
		},
		required: ["path", "old_str", "new_str"],
	},
	async execute(input) {
		const { path, old_str, new_str, replace_all } = input as EditInput;

		if (old_str === new_str) {
			return { content: "old_str and new_str are identical. No changes needed.", isError: true };
		}

		try {
			const original = await Deno.readTextFile(path);

			const count = countOccurrences(original, old_str);
			if (count === 0) {
				const hint = suggestHint(original, old_str);
				return {
					content: `No match found for old_str in ${path}.${hint}\n\nRead the file first to get the exact text.`,
					isError: true,
				};
			}
			if (count > 1 && !replace_all) {
				return {
					content: `Found ${count} matches for old_str in ${path}. ` +
						`Add more surrounding context to make the match unique, or set replace_all: true.`,
					isError: true,
				};
			}

			const updated = replace_all ? replaceAll(original, old_str, new_str) : replaceFirst(original, old_str, new_str);

			await Deno.writeTextFile(path, updated);

			const diff = unifiedDiff(original, updated, path);
			const replaced = replace_all ? `${count} occurrence${count > 1 ? "s" : ""}` : "1 occurrence";
			return { content: `Replaced ${replaced} in ${path}\n\n${diff}` };
		} catch (err) {
			return {
				content: `Failed to edit file: ${err instanceof Error ? err.message : String(err)}`,
				isError: true,
			};
		}
	},
});

function countOccurrences(text: string, search: string): number {
	let count = 0;
	let pos = 0;
	while ((pos = text.indexOf(search, pos)) !== -1) {
		count++;
		pos += search.length;
	}
	return count;
}

function replaceFirst(text: string, search: string, replacement: string): string {
	const idx = text.indexOf(search);
	if (idx === -1) return text;
	return text.slice(0, idx) + replacement + text.slice(idx + search.length);
}

function replaceAll(text: string, search: string, replacement: string): string {
	let result = text;
	let pos = 0;
	while ((pos = result.indexOf(search, pos)) !== -1) {
		result = result.slice(0, pos) + replacement + result.slice(pos + search.length);
		pos += replacement.length;
	}
	return result;
}

function suggestHint(content: string, search: string): string {
	const trimmed = search.trim();
	if (trimmed !== search && content.includes(trimmed)) {
		return " The text exists but with different leading/trailing whitespace. Check indentation.";
	}
	const firstLine = search.split("\n")[0];
	if (firstLine && content.includes(firstLine)) {
		return " The first line of old_str was found, but the full match failed. Check subsequent lines.";
	}
	return "";
}

/** Generate a compact unified diff between two strings. */
function unifiedDiff(a: string, b: string, path: string): string {
	const aLines = a.split("\n");
	const bLines = b.split("\n");

	// Find first and last differing lines
	let start = 0;
	while (start < aLines.length && start < bLines.length && aLines[start] === bLines[start]) {
		start++;
	}

	let aEnd = aLines.length - 1;
	let bEnd = bLines.length - 1;
	while (aEnd > start && bEnd > start && aLines[aEnd] === bLines[bEnd]) {
		aEnd--;
		bEnd--;
	}

	const CONTEXT = 3;
	const ctxStart = Math.max(0, start - CONTEXT);
	const ctxAEnd = Math.min(aLines.length - 1, aEnd + CONTEXT);
	const ctxBEnd = Math.min(bLines.length - 1, bEnd + CONTEXT);

	const lines: string[] = [];
	lines.push(`--- ${path}`);
	lines.push(`+++ ${path}`);
	lines.push(`@@ -${ctxStart + 1},${ctxAEnd - ctxStart + 1} +${ctxStart + 1},${ctxBEnd - ctxStart + 1} @@`);

	for (let i = ctxStart; i < start; i++) {
		lines.push(` ${aLines[i]}`);
	}
	for (let i = start; i <= aEnd; i++) {
		lines.push(`-${aLines[i]}`);
	}
	for (let i = start; i <= bEnd; i++) {
		lines.push(`+${bLines[i]}`);
	}
	for (let i = aEnd + 1; i <= ctxAEnd; i++) {
		lines.push(` ${aLines[i]}`);
	}

	return lines.join("\n");
}
