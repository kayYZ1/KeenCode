/**
 * Centralized color theme for the KeenCode UI.
 *
 * Uses 24-bit hex colors for a modern, expressive look.
 * All UI components should reference these values instead of
 * hardcoding color names or hex codes.
 */
export const theme = {
	// Brand / accent
	brand: "#6c63ff", // vibrant indigo — primary brand identity
	accent: "#22d3ee", // vivid cyan — highlights, selections, active states
	accentSoft: "#67e8f9", // softer cyan — secondary accent

	// Semantic
	success: "#34d399", // emerald green — success states, user prompts, cost
	warning: "#fbbf24", // warm amber — warnings, branch name, permissions
	error: "#f87171", // coral red — errors, deletions, high token usage
	info: "#818cf8", // soft indigo — informational, headings

	// Text
	text: "#e2e8f0", // light slate — primary text on dark backgrounds
	textMuted: "#94a3b8", // slate gray — secondary text, descriptions, placeholders
	textDim: "#64748b", // dim slate — disabled, line numbers, hints

	// Diff
	diffAdd: "#4ade80", // bright green
	diffRemove: "#fb7185", // rose pink
	diffContext: "#64748b", // dim slate

	// UI chrome
	border: "#a78bfa", // soft violet — borders, frames
	borderLabel: "#c4b5fd", // light violet — border labels
	tokenLow: "#34d399", // emerald — token bar < 50%
	tokenMid: "#fbbf24", // amber — token bar 50-80%
	tokenHigh: "#f87171", // coral — token bar > 80%

	// Markdown
	heading1: "#c084fc", // purple — h1
	heading2: "#818cf8", // indigo — h2
	heading3: "#22d3ee", // cyan — h3
	codeInline: "#94a3b8", // slate — inline code
	codeBlock: "#94a3b8", // slate — code blocks
	link: "#22d3ee", // cyan — links
	linkUrl: "#64748b", // dim — link URLs
	blockquote: "#64748b", // dim — blockquote bar
	listBullet: "#64748b", // dim — list markers
	hr: "#64748b", // dim — horizontal rules
} as const;
