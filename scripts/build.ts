import { VERSION } from "../version.ts";

const decoder = new TextDecoder();

async function getGitHash(): Promise<string> {
	try {
		const cmd = new Deno.Command("git", {
			args: ["rev-parse", "--short", "HEAD"],
			stdout: "piped",
			stderr: "null",
		});
		const { stdout } = await cmd.output();
		return decoder.decode(stdout).trim();
	} catch {
		return "unknown";
	}
}

async function run(args: string[]) {
	const cmd = new Deno.Command(args[0], { args: args.slice(1), stdout: "inherit", stderr: "inherit" });
	const { code } = await cmd.output();
	if (code !== 0) {
		console.error(`Command failed with exit code ${code}: ${args.join(" ")}`);
		Deno.exit(1);
	}
}

async function build() {
	const hash = await getGitHash();
	const fullVersion = `${VERSION}+${hash}`;

	console.log(`Building tinyag v${fullVersion}`);

	await run([
		"deno",
		"compile",
		"--allow-all",
		"--output",
		"dist/tinyag",
		"agent/index.ts",
	]);

	const stat = await Deno.stat("dist/tinyag");
	const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
	console.log(`\n✓ Built dist/tinyag (${sizeMB} MB)`);
	console.log(`  Version: ${fullVersion}`);
}

build();
