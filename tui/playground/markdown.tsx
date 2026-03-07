import { run } from "@/tui/render/index.ts";
import { Box, Markdown, Text } from "@/tui/render/components.tsx";

const DEMO_MARKDOWN = `# Markdown Component Demo

This is a **bold** statement and this is *italic* text.
You can also use ***bold and italic*** together.

## Features

- Headings with colors
- **Bold** and *italic* formatting
- ~~Strikethrough~~ text
- Inline \`code\` snippets
- [Links](https://example.com) with URL display

### Code Blocks

\`\`\`typescript
function hello() {
  console.log("Hello, world!");
}
\`\`\`

### Diff Blocks

\`\`\`diff
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,4 +1,4 @@
 import { run } from "./agent.ts";
-const port = 3000;
+const port = 8080;
 run({ port });
\`\`\`

> This is a blockquote.
> It can span multiple lines.

---

## Lists

1. First item
2. Second item
3. Third item

- Bullet point one
  - Nested item
  - Another nested item
    - Deeply nested
- Bullet point two
- Bullet point three

That's all for the demo!`;

function MarkdownDemo() {
	return (
		<Box flex flexDirection="column" padding={1} gap={1}>
			<Box padding={1} flex>
				<Markdown flex>{DEMO_MARKDOWN}</Markdown>
			</Box>
			<Box>
				<Text color="gray" italic>
					Press Ctrl+C to exit
				</Text>
			</Box>
		</Box>
	);
}

run(() => <MarkdownDemo />);
