/**
 * @mention expansion — reads file/directory contents when the user types `@path`.
 * CLI-specific (filesystem access).
 */

const MENTION_RE = /@([\w./_-]+\/?)/g;
const MAX_MENTION_OUTPUT = 10_000;
const MENTION_IGNORE_DIRS = new Set([
	".git",
	"node_modules",
	"dist",
	"out",
	"build",
	"coverage",
	".next",
	"target",
	".cache",
]);

async function readDirRecursive(absDir: string, relDir: string): Promise<string> {
	const parts: string[] = [];
	let totalLen = 0;
	let truncated = false;

	async function walk(abs: string, rel: string) {
		if (truncated) return;
		let entries: Deno.DirEntry[];
		try {
			entries = await Array.fromAsync(Deno.readDir(abs));
		} catch {
			return;
		}
		entries.sort((a, b) => a.name.localeCompare(b.name));
		for (const entry of entries) {
			if (truncated) return;
			const absPath = `${abs}/${entry.name}`;
			const relPath = `${rel}/${entry.name}`;
			if (entry.isDirectory) {
				if (MENTION_IGNORE_DIRS.has(entry.name)) continue;
				await walk(absPath, relPath);
			} else if (entry.isFile) {
				try {
					const content = await Deno.readTextFile(absPath);
					const header = `--- ${relPath} ---\n`;
					const section = header + content + "\n\n";
					if (totalLen + section.length > MAX_MENTION_OUTPUT) {
						const remaining = MAX_MENTION_OUTPUT - totalLen;
						if (remaining > header.length) parts.push(header + content.slice(0, remaining - header.length));
						truncated = true;
						return;
					}
					parts.push(section);
					totalLen += section.length;
				} catch {
					// skip binary / unreadable
				}
			}
		}
	}

	await walk(absDir.replace(/\/+$/, ""), relDir.replace(/\/+$/, ""));
	let result = parts.join("");
	if (truncated) result += "\n...(truncated)";
	return result || "(empty directory)";
}

export async function expandMentions(text: string): Promise<string> {
	const cwd = Deno.cwd();
	const contextBlocks: string[] = [];
	const seen = new Set<string>();

	for (const match of text.matchAll(MENTION_RE)) {
		const relPath = match[1];
		if (seen.has(relPath)) continue;
		seen.add(relPath);

		const absPath = `${cwd}/${relPath}`;
		try {
			const stat = await Deno.stat(absPath);
			if (stat.isDirectory) {
				contextBlocks.push(await readDirRecursive(absPath, relPath));
			} else if (stat.isFile) {
				const raw = await Deno.readTextFile(absPath);
				const content = raw.length > MAX_MENTION_OUTPUT
					? raw.slice(0, MAX_MENTION_OUTPUT) + "\n...(truncated)"
					: raw;
				contextBlocks.push(`--- ${relPath} ---\n${content}`);
			}
		} catch {
			// path doesn't exist or can't be read — leave mention as-is
		}
	}

	if (contextBlocks.length === 0) return text;

	return `${text}\n\n<attached_context>\n${contextBlocks.join("\n\n")}\n</attached_context>`;
}
