/**
 * Centralized color theme for the KeenCode UI.
 *
 * Uses 24-bit hex colors for a modern, expressive look.
 * All UI components should reference these values instead of
 * hardcoding color names or hex codes.
 *
 * Users can override any color by creating ~/.keencode/theme.json
 * with a partial set of keys from this object.
 */

import { join } from "@std/path/join";
import { keencodeDir } from "@/core/paths.ts";

export interface Theme {
	// Brand / accent
	brand: string;
	accent: string;

	// Semantic
	success: string;
	warning: string;
	error: string;
	info: string;

	// Text
	text: string;
	textMuted: string;
	textDim: string;

	// UI chrome
	border: string;
	borderLabel: string;

	// Markdown
	heading1: string;
	heading2: string;
	heading3: string;
	codeInline: string;
	codeBlock: string;
	link: string;
	linkUrl: string;
	blockquote: string;
	listBullet: string;
	hr: string;
}

const defaults: Theme = {
	// Brand / accent
	brand: "#6c63ff",
	accent: "#22d3ee",

	// Semantic
	success: "#34d399",
	warning: "#fbbf24",
	error: "#f87171",
	info: "#818cf8",

	// Text
	text: "#e2e8f0",
	textMuted: "#94a3b8",
	textDim: "#64748b",

	// UI chrome
	border: "#a78bfa",
	borderLabel: "#c4b5fd",

	// Markdown
	heading1: "#c084fc",
	heading2: "#818cf8",
	heading3: "#22d3ee",
	codeInline: "#94a3b8",
	codeBlock: "#94a3b8",
	link: "#22d3ee",
	linkUrl: "#64748b",
	blockquote: "#64748b",
	listBullet: "#64748b",
	hr: "#64748b",
};

function loadUserTheme(): Partial<Theme> {
	const path = join(keencodeDir(), "theme.json");
	try {
		const raw = Deno.readTextFileSync(path);
		return JSON.parse(raw) as Partial<Theme>;
	} catch {
		try {
			const dir = keencodeDir();
			Deno.mkdirSync(dir, { recursive: true });
			Deno.writeTextFileSync(path, JSON.stringify(defaults, null, "\t") + "\n");
		} catch { /* ignore — read-only fs or similar */ }
		return {};
	}
}

export const theme: Theme = { ...defaults, ...loadUserTheme() };
