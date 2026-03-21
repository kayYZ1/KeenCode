import type { CommandPaletteItem } from "@/tui/render/hooks/command-palette.ts";
import { useSignal } from "@/tui/render/hooks/signals.ts";

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "out", "build", "coverage", ".next", "target", ".cache"]);
const MAX_FILES = 10_000;

async function listFilesGit(root: string): Promise<string[]> {
	const result = await new Deno.Command("git", {
		args: ["ls-files", "--cached", "--others", "--exclude-standard"],
		cwd: root,
		stdout: "piped",
		stderr: "piped",
	}).output();
	if (!result.success) throw new Error("git ls-files failed");
	const files = new TextDecoder().decode(result.stdout).trim().split("\n").filter(Boolean);

	const dirs = new Set<string>();
	for (const f of files) {
		let idx = f.indexOf("/");
		while (idx !== -1) {
			dirs.add(f.slice(0, idx) + "/");
			idx = f.indexOf("/", idx + 1);
		}
	}

	return [...dirs, ...files].slice(0, MAX_FILES);
}

async function listFilesWalk(root: string): Promise<string[]> {
	const files: string[] = [];

	async function walk(dir: string, prefix: string) {
		if (files.length >= MAX_FILES) return;
		for await (const entry of Deno.readDir(dir)) {
			if (files.length >= MAX_FILES) return;
			if (entry.isDirectory) {
				if (IGNORE_DIRS.has(entry.name)) continue;
				const dirPath = prefix ? `${prefix}/${entry.name}` : entry.name;
				files.push(dirPath + "/");
				await walk(`${dir}/${entry.name}`, dirPath);
			} else if (entry.isFile) {
				files.push(prefix ? `${prefix}/${entry.name}` : entry.name);
			}
		}
	}

	await walk(root, "");
	return files;
}

async function isGitRepo(root: string): Promise<boolean> {
	try {
		const stat = await Deno.stat(`${root}/.git`);
		return stat.isDirectory;
	} catch {
		return false;
	}
}

export function useProjectFiles(root: string = Deno.cwd()) {
	const files = useSignal<CommandPaletteItem[]>([]);
	const status = useSignal<"idle" | "indexing" | "ready" | "error">("idle");

	const startIndexing = () => {
		if (status.value === "indexing" || status.value === "ready") return;
		status.value = "indexing";

		(async () => {
			try {
				const paths = await isGitRepo(root) ? await listFilesGit(root) : await listFilesWalk(root);
				files.value = paths.map((p) => ({ id: p, title: p }));
				status.value = "ready";
			} catch {
				try {
					const paths = await listFilesWalk(root);
					files.value = paths.map((p) => ({ id: p, title: p }));
					status.value = "ready";
				} catch {
					status.value = "error";
				}
			}
		})();
	};

	return { files, status, startIndexing };
}
