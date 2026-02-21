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

### Code Blocks

\`\`\`
function hello() {
  console.log("Hello, world!");
}
\`\`\`

> This is a blockquote.
> It can span multiple lines.

---

## Lists

1. First item
2. Second item
3. Third item

- Bullet point one
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
