/** A display-ready diff line with line numbers and stripped code content */
export interface DisplayDiffLine {
	type: "add" | "remove" | "context";
	/** Line number in the original file (null for added lines) */
	oldNum: number | null;
	/** Line number in the new file (null for removed lines) */
	newNum: number | null;
	/** The code content without the leading +/-/space prefix */
	code: string;
}

/** Parse a unified diff into display-ready lines with line numbers */
export function formatDiffForDisplay(diff: string): DisplayDiffLine[] {
	const rawLines = diff.split("\n");
	const result: DisplayDiffLine[] = [];

	let oldLine = 0;
	let newLine = 0;

	for (const line of rawLines) {
		// Skip file headers
		if (line.startsWith("---") || line.startsWith("+++")) continue;

		// Parse hunk header for starting line numbers
		const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
		if (hunkMatch) {
			oldLine = parseInt(hunkMatch[1], 10);
			newLine = parseInt(hunkMatch[2], 10);
			continue;
		}

		if (line.startsWith("+")) {
			result.push({ type: "add", oldNum: null, newNum: newLine, code: line.slice(1) });
			newLine++;
		} else if (line.startsWith("-")) {
			result.push({ type: "remove", oldNum: oldLine, newNum: null, code: line.slice(1) });
			oldLine++;
		} else {
			// Context line (leading space) or other
			const code = line.startsWith(" ") ? line.slice(1) : line;
			result.push({ type: "context", oldNum: oldLine, newNum: newLine, code });
			oldLine++;
			newLine++;
		}
	}

	return result;
}

const MAX_DIFF_CHANGED_LINES = 30;

/** Decide whether a diff is worth showing inline to the user */
export function shouldShowDiff(diff: string): boolean {
	const lines = diff.split("\n");
	const changedLines = lines.filter((l) => l.startsWith("+") || l.startsWith("-")).length;
	// Header lines (--- / +++) count as 2 changed lines, subtract them
	const headerLines = lines.filter((l) => l.startsWith("---") || l.startsWith("+++")).length;
	return (changedLines - headerLines) <= MAX_DIFF_CHANGED_LINES;
}

/** Produce a short summary for diffs that are too large to show inline */
export function summarizeDiff(diff: string): string {
	const lines = diff.split("\n");
	const added = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
	const removed = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
	const parts: string[] = [];
	if (added > 0) parts.push(`+${added}`);
	if (removed > 0) parts.push(`-${removed}`);
	return parts.join(", ") + " lines";
}
