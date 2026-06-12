import { theme } from "@/tui/theme.ts";

/** Represents a parsed markdown segment with styling */
export interface MarkdownSegment {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	code?: boolean;
	color?: string;
}

/** Represents a parsed markdown line */
export interface MarkdownLine {
	segments: MarkdownSegment[];
	type: "paragraph" | "heading1" | "heading2" | "heading3" | "code" | "blockquote" | "listItem" | "hr";
	indent?: number;
	/** Language tag from fenced code blocks (e.g. "diff", "ts", "python") */
	language?: string;
}

/** Parse inline markdown formatting (bold, italic, code, strikethrough) */
function parseInlineFormatting(text: string): MarkdownSegment[] {
	const segments: MarkdownSegment[] = [];

	// Regex patterns for inline formatting
	const patterns = [
		{ regex: /\*\*\*(.+?)\*\*\*/g, bold: true, italic: true },
		{ regex: /\*\*(.+?)\*\*/g, bold: true },
		{ regex: /\*(.+?)\*/g, italic: true },
		{ regex: /__(.+?)__/g, bold: true },
		{ regex: /_(.+?)_/g, italic: true },
		{ regex: /~~(.+?)~~/g, strikethrough: true },
		{ regex: /`(.+?)`/g, code: true },
		{ regex: /\[([^\]]+)\]\(([^)]+)\)/g, underline: true, link: true },
	];

	// Find all matches and their positions
	interface Match {
		start: number;
		end: number;
		text: string;
		bold?: boolean;
		italic?: boolean;
		underline?: boolean;
		strikethrough?: boolean;
		code?: boolean;
		url?: string;
	}

	const matches: Match[] = [];

	for (const pattern of patterns) {
		let match;
		const regex = new RegExp(pattern.regex.source, "g");
		while ((match = regex.exec(text)) !== null) {
			// Check if this range overlaps with existing matches
			const overlaps = matches.some(
				(m) =>
					(match!.index >= m.start && match!.index < m.end) ||
					(match!.index + match![0].length > m.start && match!.index + match![0].length <= m.end),
			);
			if (!overlaps) {
				const isLink = "link" in pattern && pattern.link;
				matches.push({
					start: match.index,
					end: match.index + match[0].length,
					text: match[1],
					bold: pattern.bold,
					italic: pattern.italic,
					underline: pattern.underline,
					strikethrough: pattern.strikethrough,
					code: pattern.code,
					url: isLink ? match[2] : undefined,
				});
			}
		}
	}

	// Sort by position
	matches.sort((a, b) => a.start - b.start);

	// Build segments
	let pos = 0;
	for (const match of matches) {
		if (match.start > pos) {
			segments.push({ text: text.slice(pos, match.start) });
		}
		segments.push({
			text: match.text,
			bold: match.bold,
			italic: match.italic,
			underline: match.underline,
			strikethrough: match.strikethrough,
			code: match.code,
			color: match.code ? theme.codeInline : match.url ? theme.link : undefined,
		});
		if (match.url) {
			segments.push({ text: ` (${match.url})`, color: theme.linkUrl });
		}
		pos = match.end;
	}

	if (pos < text.length) {
		segments.push({ text: text.slice(pos) });
	}

	return segments.length > 0 ? segments : [{ text }];
}

/** Colorize a code block line based on its language */
function colorizeCodeLine(line: string, language: string | undefined): MarkdownSegment[] {
	if (language === "diff") {
		if (line.startsWith("+++") || line.startsWith("---")) {
			return [{ text: line, code: true, bold: true, color: theme.text }];
		}
		if (line.startsWith("@@")) {
			return [{ text: line, code: true, color: theme.accent }];
		}
		if (line.startsWith("+")) {
			return [{ text: line, code: true, color: theme.success }];
		}
		if (line.startsWith("-")) {
			return [{ text: line, code: true, color: theme.error }];
		}
		return [{ text: line, code: true, color: theme.codeBlock }];
	}
	return [{ text: line, code: true, color: theme.codeBlock }];
}

/** Parse markdown text into structured lines */
export function parseMarkdown(content: string): MarkdownLine[] {
	const lines = content.split("\n");
	const result: MarkdownLine[] = [];
	let inCodeBlock = false;
	let codeLanguage: string | undefined;

	for (const line of lines) {
		// Code block toggle
		if (line.trim().startsWith("```")) {
			if (!inCodeBlock) {
				codeLanguage = line.trim().slice(3).trim() || undefined;
			} else {
				codeLanguage = undefined;
			}
			inCodeBlock = !inCodeBlock;
			continue;
		}

		// Inside code block
		if (inCodeBlock) {
			result.push({
				type: "code",
				segments: colorizeCodeLine(line, codeLanguage),
				language: codeLanguage,
			});
			continue;
		}

		const trimmed = line.trim();

		// Empty line
		if (!trimmed) {
			result.push({ type: "paragraph", segments: [{ text: "" }] });
			continue;
		}

		// Horizontal rule
		if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
			result.push({
				type: "hr",
				segments: [{ text: "─".repeat(40), color: theme.hr }],
			});
			continue;
		}

		// Headings
		const h3Match = trimmed.match(/^###\s+(.+)$/);
		if (h3Match) {
			result.push({
				type: "heading3",
				segments: [{ text: h3Match[1], bold: true, color: theme.heading3 }],
			});
			continue;
		}

		const h2Match = trimmed.match(/^##\s+(.+)$/);
		if (h2Match) {
			result.push({
				type: "heading2",
				segments: [{ text: h2Match[1], bold: true, color: theme.heading2 }],
			});
			continue;
		}

		const h1Match = trimmed.match(/^#\s+(.+)$/);
		if (h1Match) {
			result.push({
				type: "heading1",
				segments: [{ text: h1Match[1], bold: true, color: theme.heading1 }],
			});
			continue;
		}

		// Blockquote
		const quoteMatch = trimmed.match(/^>\s*(.*)$/);
		if (quoteMatch) {
			result.push({
				type: "blockquote",
				segments: [
					{ text: "│ ", color: theme.blockquote },
					...parseInlineFormatting(quoteMatch[1]).map((s) => ({ ...s, italic: true })),
				],
			});
			continue;
		}

		// List items (with indentation support)
		const indentedListMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
		if (indentedListMatch) {
			const indent = Math.floor(indentedListMatch[1].length / 2);
			const bullet = indent === 0 ? "• " : indent === 1 ? "◦ " : "▪ ";
			const padding = "  ".repeat(indent);
			result.push({
				type: "listItem",
				segments: [
					{ text: `${padding}${bullet}`, color: theme.listBullet },
					...parseInlineFormatting(indentedListMatch[3]),
				],
				indent,
			});
			continue;
		}

		// Numbered list (with indentation support)
		const numListMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
		if (numListMatch) {
			const indent = Math.floor(numListMatch[1].length / 2);
			const padding = "  ".repeat(indent);
			result.push({
				type: "listItem",
				segments: [
					{ text: `${padding}${numListMatch[2]}. `, color: theme.listBullet },
					...parseInlineFormatting(numListMatch[3]),
				],
				indent,
			});
			continue;
		}

		// Regular paragraph with inline formatting
		result.push({
			type: "paragraph",
			segments: parseInlineFormatting(trimmed),
		});
	}

	return result;
}
