import { run } from "@/tui/render/index.ts";
import { Box, Text } from "@/tui/render/components.tsx";
import { type DisplayDiffLine, formatDiffForDisplay } from "@/tui/core/primitives/parse-diff.ts";

// ---------------------------------------------------------------------------
// Sample diffs
// ---------------------------------------------------------------------------

const SMALL_DIFF = `--- src/config.ts
+++ src/config.ts
@@ -1,6 +1,7 @@
 import { loadEnv } from "./env.ts";
 
-const DEFAULT_PORT = 3000;
+const DEFAULT_PORT = 8080;
+const DEFAULT_HOST = "0.0.0.0";
 
 export function getConfig() {
   return { port: DEFAULT_PORT };
`;

const MULTI_HUNK_DIFF = `--- src/server.ts
+++ src/server.ts
@@ -5,7 +5,7 @@
 import { Router } from "./router.ts";
 import { Logger } from "./logger.ts";
 
-const logger = new Logger("info");
+const logger = new Logger("debug");
 
 export class Server {
   private router: Router;
@@ -18,9 +18,11 @@
   }
 
   async start() {
-    logger.info("Starting server...");
+    logger.debug("Initializing server...");
     await this.router.init();
-    this.listen(3000);
+    const port = this.config.port ?? 8080;
+    this.listen(port);
+    logger.info(\`Server listening on port \${port}\`);
   }
 }
`;

const ADD_ONLY_DIFF = `--- src/utils.ts
+++ src/utils.ts
@@ -10,6 +10,15 @@
   return str.trim().toLowerCase();
 }
 
+export function slugify(text: string): string {
+  return text
+    .toLowerCase()
+    .replace(/[^a-z0-9]+/g, "-")
+    .replace(/^-|-$/g, "");
+}
+
+export function capitalize(str: string): string {
+  return str.charAt(0).toUpperCase() + str.slice(1);
+}
+
 export function truncate(str: string, len: number): string {
   return str.length > len ? str.slice(0, len) + "..." : str;
 }
`;

// ---------------------------------------------------------------------------
// DiffView (same as agent/app.tsx)
// ---------------------------------------------------------------------------

const DIFF_INDICATOR: Record<DisplayDiffLine["type"], { symbol: string; color: string }> = {
	add: { symbol: "+", color: "green" },
	remove: { symbol: "-", color: "red" },
	context: { symbol: " ", color: "gray" },
};

function DiffView({ diff, label }: { diff: string; label: string }) {
	const lines = formatDiffForDisplay(diff);
	const maxNum = lines.reduce((m, l) => Math.max(m, l.newNum ?? 0, l.oldNum ?? 0), 0);
	const numWidth = String(maxNum).length;

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold color="cyan">
				{label}
			</Text>
			<Box flexDirection="column">
				{lines.map((line, i) => {
					const { symbol, color } = DIFF_INDICATOR[line.type];
					const num = line.newNum ?? line.oldNum;
					const lineNum = num !== null ? String(num).padStart(numWidth) : " ".repeat(numWidth);
					return (
						<Text key={i} color={color}>
							{`  ${lineNum} ${symbol} ${line.code}`}
						</Text>
					);
				})}
			</Box>
		</Box>
	);
}

// ---------------------------------------------------------------------------
// Playground
// ---------------------------------------------------------------------------

function DiffPlayground() {
	return (
		<Box flex flexDirection="column" padding={1} gap={2}>
			<Text bold color="magenta">
				Diff Rendering Playground
			</Text>

			<DiffView diff={SMALL_DIFF} label="Simple edit (1 removed, 2 added)" />
			<DiffView diff={MULTI_HUNK_DIFF} label="Multi-hunk diff (changes across two locations)" />
			<DiffView diff={ADD_ONLY_DIFF} label="Add-only diff (new functions)" />

			<Text color="gray" italic>
				Press Ctrl+C to exit
			</Text>
		</Box>
	);
}

run(() => <DiffPlayground />);
