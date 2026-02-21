# TinyAg2

A terminal-based coding agent with a custom TUI framework, built with Deno and TypeScript.

TinyAg2 is a monorepo containing a terminal UI framework powered by a custom JSX runtime and Yoga flexbox layout, an
OpenAI-compatible LLM API layer with streaming support, and an agentic loop with built-in tools — all wired together
into an interactive coding assistant that runs entirely in your terminal.

## Features

- **Custom JSX-based TUI framework** — Flexbox layout via Yoga, double-buffered rendering, reactive signals, vim-mode
  text input
- **OpenAI-compatible API layer** — Works with any provider exposing `/v1/chat/completions` (OpenRouter, OpenAI, local
  models, etc.)
- **Streaming agent loop** — Async generator that yields events for real-time UI updates as the LLM thinks and uses
  tools
- **Built-in tools** — Bash, file read/write, grep, and glob for filesystem interaction
- **Markdown rendering** — Inline markdown display in the terminal with syntax highlighting
- **Command palette** — Fuzzy-searchable command menu

## Quick Start

### Prerequisites

- [Deno](https://deno.com/) v2+

### Setup

```bash
git clone https://github.com/kayYZ1/TinyAG2.git
cd TinyAG2
```

Set your environment variables:

```bash
export LLM_API_KEY="your-api-key"
export LLM_BASE_URL="https://openrouter.ai/api/v1"  # optional, defaults to OpenRouter
export LLM_MODEL="moonshotai/kimi-k2.5"              # optional, defaults to kimi-k2.5
```

### Run

```bash
deno task agent
```

## Architecture

```
├── api/     # LLM provider integrations (OpenAI-compatible)
├── core/    # Agent loop, tool system, context management
├── agent/   # Application entry point and UI
├── tui/     # Custom terminal UI framework
└── dev/     # Development tools (logs, snapshots)
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

| Tool         | Description                      |
| ------------ | -------------------------------- |
| `bash`       | Execute shell commands           |
| `read_file`  | Read file contents               |
| `write_file` | Write/create files               |
| `grep`       | Search files with regex patterns |
| `glob`       | Find files by glob pattern       |

### `tui/` — Terminal UI Framework

A custom terminal UI framework with:

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

- Status bar with model name, token count, and cost tracking
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
```

### Playgrounds

Interactive demos for individual TUI components:

```bash
deno task playground:agent            # Full agent UI demo
deno task playground:command-palette  # Command palette
deno task playground:layout           # Flexbox layout and borders
deno task playground:markdown         # Markdown rendering
deno task playground:scroll-area      # Scroll area
deno task playground:spinner          # Spinner animations
deno task playground:text-input       # Text input with vim mode
deno task playground:text-styling     # Text styling
```

## License

MIT
