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

const content = `export const VERSION = "${next}";\n`;
await Deno.writeTextFile("version.ts", content);
console.log(`${VERSION} → ${next}`);
