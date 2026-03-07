/** Generate a compact unified diff between two strings. */
export function unifiedDiff(a: string, b: string, path: string): string {
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
