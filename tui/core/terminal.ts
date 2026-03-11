import process from "node:process";
import type { Cell, CursorStyle } from "../render/types/index.ts";

export class Terminal {
	stdout: typeof process.stdout;
	width: number;
	height: number;
	currentBuffer: Cell[][];
	previousBuffer: Cell[][];
	isFirstRender: boolean = true;
	cursorVisible: boolean = true;
	cursorX: number = -1;
	cursorY: number = -1;
	cursorStyle: CursorStyle = "bar";
	private resizeHandler: (() => void) | null = null;
	private disposed: boolean = false;

	constructor(stdout: typeof process.stdout = process.stdout) {
		this.stdout = stdout;
		this.width = this.stdout.columns || 80;
		this.height = this.stdout.rows || 24;
		this.currentBuffer = this.createEmptyBuffer();
		this.previousBuffer = this.createEmptyBuffer();

		this.setupResizeHandler();
		this.enterAlternateScreen();
		this.hideCursor();
		this.clearScreen();
	}

	private isTTY(): boolean {
		return this.stdout.isTTY ?? false;
	}

	private setupResizeHandler() {
		if (!this.isTTY()) return;

		this.resizeHandler = () => {
			this.width = this.stdout.columns || 80;
			this.height = this.stdout.rows || 24;
			this.currentBuffer = this.createEmptyBuffer();
			this.previousBuffer = this.createEmptyBuffer();
			this.isFirstRender = true;
			this.clearScreen();
		};

		this.stdout.on("resize", this.resizeHandler);
	}

	private createEmptyBuffer(): Cell[][] {
		return Array.from(
			{ length: this.height },
			() => Array.from({ length: this.width }, () => ({ char: " ", style: "" })),
		);
	}

	private clearScreen() {
		if (!this.isTTY()) return;
		this.stdout.write("\x1b[2J\x1b[H");
	}

	enterAlternateScreen() {
		if (!this.isTTY()) return;
		this.stdout.write("\x1b[?1049h");
	}

	exitAlternateScreen() {
		if (!this.isTTY()) return;
		this.stdout.write("\x1b[?1049l");
	}

	hideCursor() {
		if (!this.isTTY()) return;
		if (this.cursorVisible) {
			this.stdout.write("\x1b[?25l");
			this.cursorVisible = false;
		}
	}

	showCursor() {
		if (!this.isTTY()) return;
		if (!this.cursorVisible) {
			this.stdout.write("\x1b[?25h");
			this.cursorVisible = true;
		}
	}

	setCursorStyle(style: CursorStyle) {
		if (!this.isTTY()) return;
		if (this.cursorStyle !== style) {
			const code = style === "block" ? 2 : 6;
			this.stdout.write(`\x1b[${code} q`);
			this.cursorStyle = style;
		}
	}

	setCursorPosition(x: number, y: number) {
		if (!this.isTTY()) return;
		if (this.cursorX !== x || this.cursorY !== y) {
			this.stdout.write(`\x1b[${y + 1};${x + 1}H`);
			this.cursorX = x;
			this.cursorY = y;
		}
	}

	private extractStyle(str: string): { chars: string[]; styles: string[] } {
		const chars: string[] = [];
		const styles: string[] = [];

		let currentStyle = "";
		let i = 0;

		while (i < str.length) {
			const char = str[i];
			const nextChar = str[i + 1];
			if (char === "\x1b" && nextChar === "[") {
				let j = i + 2;
				while (j < str.length && str[j] !== "m") j++;
				const sequence = str.slice(i, j + 1);
				if (sequence === "\x1b[0m") {
					currentStyle = "";
				} else {
					currentStyle += sequence;
				}
				i = j + 1;
			} else if (char !== undefined) {
				const sanitized = char === "\n" || char === "\r" || char === "\t" ? " " : char;
				chars.push(sanitized);
				styles.push(currentStyle);
				i++;
			} else {
				i++;
			}
		}

		return { chars, styles };
	}

	private writeToBuffer(x: number, y: number, text: string) {
		if (y < 0 || y >= this.height) return;

		const { chars, styles } = this.extractStyle(text);
		const row = this.currentBuffer[y];
		if (!row) return;

		for (let i = 0; i < chars.length; i++) {
			const col = x + i;
			const char = chars[i];
			const style = styles[i];
			if (col >= 0 && col < this.width && char !== undefined && style !== undefined) {
				row[col] = { char, style };
			}
		}
	}

	render(positions: Array<{ x: number; y: number; text: string }>) {
		this.clearBuffer(this.currentBuffer);

		for (const { x, y, text } of positions) {
			this.writeToBuffer(Math.round(x), Math.round(y), text);
		}

		this.flush();
	}

	private clearBuffer(buffer: Cell[][]) {
		for (let y = 0; y < this.height; y++) {
			const row = buffer[y];
			if (!row) continue;
			for (let x = 0; x < this.width; x++) {
				const cell = row[x];
				if (cell) {
					cell.char = " ";
					cell.style = "";
				}
			}
		}
	}

	private flush() {
		if (!this.isTTY()) return;

		let output = "";

		for (let y = 0; y < this.height; y++) {
			const currentRow = this.currentBuffer[y];
			const previousRow = this.previousBuffer[y];
			if (!currentRow || !previousRow) continue;

			for (let x = 0; x < this.width; x++) {
				const current = currentRow[x];
				const previous = previousRow[x];
				if (!current || !previous) continue;

				if (this.isFirstRender || current.char !== previous.char || current.style !== previous.style) {
					output += `\x1b[${y + 1};${x + 1}H`;
					output += `${current.style + current.char}\x1b[0m`;
				}
			}
		}

		if (output) {
			this.stdout.write(output);
			this.cursorX = -1;
			this.cursorY = -1;
		}

		[this.previousBuffer, this.currentBuffer] = [this.currentBuffer, this.previousBuffer];
		this.isFirstRender = false;
	}

	dispose() {
		if (this.disposed) return;
		this.disposed = true;

		if (this.resizeHandler) {
			this.stdout.off("resize", this.resizeHandler);
			this.resizeHandler = null;
		}

		this.currentBuffer = this.createEmptyBuffer();
		this.previousBuffer = this.createEmptyBuffer();
		this.isFirstRender = true;
		this.showCursor();
		this.exitAlternateScreen();
	}

	/** @deprecated Use dispose() instead */
	clear() {
		this.dispose();
	}
}
