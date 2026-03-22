import { VERSION } from "../version.ts";

const part = Deno.args[0] as "patch" | "minor" | "major" | undefined;

if (!part || !["patch", "minor", "major"].includes(part)) {
	console.error("Usage: deno task version:bump <patch|minor|major>");
	Deno.exit(1);
}

const [major, minor, patch] = VERSION.split(".").map(Number);

let next: string;
switch (part) {
	case "major":
		next = `${major + 1}.0.0`;
		break;
	case "minor":
		next = `${major}.${minor + 1}.0`;
		break;
	case "patch":
		next = `${major}.${minor}.${patch + 1}`;
		break;
}

// Update version.ts
const content = `export const VERSION = "${next}";\n`;
await Deno.writeTextFile("version.ts", content);

// Update README.md
const readme = await Deno.readTextFile("README.md");
const updatedReadme = readme.replace(
	/KeenCode v\d+\.\d+\.\d+/,
	`KeenCode v${next}`,
);
await Deno.writeTextFile("README.md", updatedReadme);

console.log(`${VERSION} → ${next}`);
