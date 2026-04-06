# KeenCode v0.6.0

A terminal-based coding agent with a custom TUI framework, built with Deno and TypeScript.

KeenCode is a monorepo containing a terminal UI framework powered by a custom JSX runtime and Yoga flexbox layout, an
OpenAI-compatible LLM API layer with streaming support, and an agentic loop with built-in tools — all wired together
into an interactive coding assistant that runs entirely in your terminal.

## Features

- **Custom JSX-based TUI framework** — Flexbox layout via Yoga, double-buffered rendering, reactive signals, vim-mode
  text input
- **OpenAI-compatible API layer** — Works with any provider exposing `/v1/chat/completions` (OpenRouter, OpenAI, local
  models, etc.)
- **Streaming agent loop** — Async generator that yields events for real-time UI updates as the LLM thinks and uses
  tools
- **Built-in tools** — Bash, file read/write/edit, grep, and glob for filesystem interaction
- **Inline diffs** — File write and edit operations display colored unified diffs with line numbers
- **Markdown rendering** — Inline markdown display in the terminal with syntax highlighting
- **Command palette** — Fuzzy-searchable command menu

## Install

Download the latest Linux binary from [GitHub Releases](https://github.com/kayYZ1/KeenCode/releases/latest):

```bash
curl -L https://github.com/kayYZ1/KeenCode/releases/latest/download/keencode -o keencode
chmod +x keencode
sudo mv keencode /usr/local/bin/
```

On first run, KeenCode will prompt you for an API key and save it to `~/.keencode/auth.json`.

Model and provider settings are configured in `agent/config.ts`.

## Quick Start

### Prerequisites

- [Deno](https://deno.com/) v2+

### Setup

```bash
git clone https://github.com/kayYZ1/KeenCode.git
cd KeenCode
```

Set your API key:

```bash
export LLM_API_KEY="your-api-key"
```

### Run

```bash
deno task agent
```

## Architecture

```
├── api/        # LLM provider integrations (OpenAI-compatible)
├── core/       # Agent loop, tool system, session management
├── agent/      # Application entry point and UI
├── tui/        # Custom terminal UI framework
├── scripts/    # Build and version bump scripts
├── dist/       # Compiled binary output
├── version.ts  # Version constant
```

### Package Dependency Graph

```
tui/  (leaf)     api/  (leaf)
  ↑                ↑
  │              core/  (depends on api/)
  │                ↑
  └─── agent/ ─────┘
       (depends on tui/, core/, api/)
```

### `api/` — LLM Provider Layer

Provides an OpenAI-compatible API client with streaming SSE support. Any provider that exposes `/v1/chat/completions`
works out of the box.

- `types.ts` — Standardized types (`Message`, `CompletionRequest`, `ToolDefinition`, etc.)
- `providers/completions.ts` — Generic completions provider with streaming and cost tracking
- `streaming/stream.ts` — SSE stream parser

### `core/` — Agent Loop & Tools

The agent loop is an async generator (`run()`) that streams `AgentEvent`s:

1. Build context (system prompt + history + tool definitions)
2. Stream LLM response, yielding `text_delta`, `tool_call_start`, `tool_call_args_delta`, `tool_call_end` events
3. Execute tool calls, yield `tool_result` events
4. Repeat until the LLM responds without tool calls (up to configurable max rounds)

**Built-in tools:**

| Tool (internal) | Display Name | Description                      |
| --------------- | ------------ | -------------------------------- |
| `bash`          | Run          | Execute shell commands           |
| `read_file`     | Read         | Read file contents               |
| `write_file`    | Write        | Write/create files (with diff)   |
| `edit_file`     | Edit         | Edit files with diff output      |
| `grep`          | Grep         | Search files with regex patterns |
| `glob`          | Search       | Find files by glob pattern       |

**Session persistence** — Conversations are saved to `~/.keencode/sessions/` as JSONL files with automatic session
management:

- **Create** — New sessions with unique IDs and timestamps
- **Continue** — Resume the most recent session for a workspace
- **Open** — Load a specific session by file path
- **List** — Browse all sessions with summaries (first user message preview)
- **Cleanup** — Automatic retention of the 7 most recent sessions
- **Token tracking** — Per-session token counts persisted in headers

Sessions store a header (metadata) followed by entries: user/assistant messages and tool results.

### `tui/` — Terminal UI Framework

A custom terminal UI framework with:

- `theme.ts` — Centralized color theme
- **Custom JSX runtime** — Compiles JSX to VNodes, reconciles instance trees
- **Yoga layout** — Full flexbox support (direction, justify, align, wrap, gap, padding, absolute positioning)
- **Double-buffered rendering** — Flicker-free differential updates
- **Signals reactivity** — `@preact/signals-core` for automatic re-renders

**Components:**

| Component          | Description                                                 |
| ------------------ | ----------------------------------------------------------- |
| `<Box>`            | Flexbox container with borders, padding, background color   |
| `<Text>`           | Styled text (color, bold, italic, underline, strikethrough) |
| `<TextInput>`      | Text input with cursor and vim mode support                 |
| `<Spinner>`        | Animated spinner                                            |
| `<ScrollArea>`     | Scrollable container with scrollbar and auto-scroll         |
| `<Markdown>`       | Renders markdown as styled terminal text                    |
| `<CommandPalette>` | Fuzzy-searchable command menu overlay                       |

**Hooks:**

| Hook                      | Description                         |
| ------------------------- | ----------------------------------- |
| `useSignal(value)`        | Persistent reactive signal          |
| `useSignalEffect(fn)`     | Reactive side effect with cleanup   |
| `useTextInput(opts)`      | Text input state with vim mode      |
| `useScrollArea(opts)`     | Scroll state with keyboard control  |
| `useCommandPalette(opts)` | Command palette state and filtering |

### `agent/` — Application

Ties everything together into the interactive terminal agent:

- `system-prompt.md` — The system prompt for the agent
- Status bar with git branch, token usage progress bar, and cost tracking
- Scrollable chat history with markdown rendering
- Streaming tool call display
- Vim-mode text input
- Command palette (`/`) for actions like "New Chat" and "Quit"

## Development

```bash
deno task fmt          # Format code
deno task fmt:check    # Check formatting
deno task lint         # Lint
deno task test         # Run tests
deno task build        # Build binary (dist/keencode)
deno task version      # Show current version
deno task version:bump <patch|minor|major>  # Bump version
```

### Playgrounds

Interactive demos for individual TUI components:

```bash
deno task playground:agent            # Full agent UI demo
deno task playground:command-palette  # Command palette
deno task playground:diff            # Diff rendering
deno task playground:layout           # Flexbox layout and borders
deno task playground:markdown         # Markdown rendering
deno task playground:scroll-area      # Scroll area
deno task playground:spinner          # Spinner animations
deno task playground:text-input       # Text input with vim mode
deno task playground:text-styling     # Text styling
```

## Releasing

Releases are automated via GitHub Actions. To create a new release:

```bash
deno task version:bump patch   # or minor/major
git add version.ts
git commit -m "v$(deno task version 2>/dev/null)"
git tag "v$(deno task version 2>/dev/null)"
git push && git push --tags
```

This triggers CI to build the Linux binary and publish a GitHub Release.

## License

MIT
