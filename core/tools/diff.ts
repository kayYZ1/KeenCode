/**
 * Generate a unified diff between two strings using `git diff --no-index --no-ext-diff`.
 * Bypasses any user-configured external diff tools (e.g. tree-sitter diffing).
 */
export async function generateDiff(
	oldText: string,
	newText: string,
): Promise<string | undefined> {
	const tmpDir = await Deno.makeTempDir();
	const oldPath = `${tmpDir}/old`;
	const newPath = `${tmpDir}/new`;

	try {
		await Deno.writeTextFile(oldPath, oldText);
		await Deno.writeTextFile(newPath, newText);

		const result = await new Deno.Command("git", {
			args: [
				"diff",
				"--no-index",
				"--no-ext-diff",
				"--no-color",
				"-U3",
				"--",
				oldPath,
				newPath,
			],
			stdout: "piped",
			stderr: "null",
		}).output();

		const raw = new TextDecoder().decode(result.stdout).trim();
		return raw || undefined;
	} catch {
		return undefined;
	} finally {
		await Deno.remove(tmpDir, { recursive: true }).catch(() => {});
	}
}
