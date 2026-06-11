# AGENTS.md - Agent

The CLI application entry point: ties together the TUI, the relay agent library, and session management.

## Architecture

```
agent/
├── index.ts              # Application entry point (imports app.tsx)
├── app.tsx               # App component, signals, runSubmission, command palettes
├── config.ts             # Default provider config (baseURL, model)
├── auth.ts               # API key loading from ~/.relay/auth.json
├── system-prompt.md      # System prompt for the LLM agent
├── mention.ts            # @mention expansion (file/directory reading)
├── components/
│   ├── chat.tsx          # MessageView, ToolCallView, DiffView, UIMessage type
│   └── status-bar.tsx    # StatusBar, TokenBar
└── hooks/
    └── project-files.ts  # useProjectFiles hook (git ls-files / directory walk)
```

## Key Concepts

### Application Structure

`app.tsx` is a thin shell (~490 lines) that wires together:

- **Relay library** (`@vvtxn/relay`) — agent loop, tools, sessions, display utilities
- **TUI framework** (`@/tui`) — terminal rendering, components, hooks, input handling
- **Local modules** — config, auth, mention expansion, UI components

```typescript
import { runAgentLoop } from "@vvtxn/relay/core/runner.ts";
import { CompletionsProvider } from "@vvtxn/relay/api/providers/completions.ts";
import { createToolRegistry, defaultTools } from "@vvtxn/relay/core/tools/index.ts";
import { StatusBar } from "./components/status-bar.tsx";
import { MessageView } from "./components/chat.tsx";
```

### How the Agent Runs

```typescript
await runAgentLoop(messages, config, {
    onTextDelta(delta)        { /* accumulate text, sync signals */ },
    onToolCallEnd(id, ...)    { /* create UIToolCall, sync signals */ },
    onToolResult(id, result)  { /* update output/diff, sync signals */ },
    onMessageComplete(...)    { /* track tokens/cost */ },
    onTurnComplete(...)       { /* persist to session, clear draft */ },
    onError(error)            { /* display error */ },
});
```

### UI Components

- `App` — Main component with signals, command palettes, input handling
- `StatusBar` (components/status-bar.tsx) — Branch name, token usage bar, cost display
- `MessageView` (components/chat.tsx) — Renders user and agent messages with markdown
- `ToolCallView` (components/chat.tsx) — Displays tool calls with display names, input, output, diffs
- `DiffView` (components/chat.tsx) — Renders colored unified diffs with line numbers

### Configuration

- `LLM_API_KEY` (required) — API key for the LLM provider

Defaults in `config.ts`:

- `baseURL` — defaults to `https://openrouter.ai/api/v1`
- `model` — defaults to `moonshotai/kimi-k2.6`

### Features

- Reactive state via `useSignal`
- Vim-style input via `useTextInput`
- Command palette (new chat, threads, quit) via `useCommandPalette`
- File mentions via `@` with project file indexing
- Double Esc to cancel in-progress generation
- Token usage and cost tracking (including OpenRouter generation stats)
- Session persistence with thread switching

## Dependencies

- `@vvtxn/relay` — Agent loop, runner, tools, sessions, display utilities
- `@/tui` — Terminal UI framework (components, hooks, input manager)

## Running

```bash
deno task agent
```

## Task Completion Checklist

After concluding that a task is complete, always run these commands from the repo root:

1. `deno task fmt` — auto-format all code
2. `deno task lint` — check for lint errors
3. `deno task test` — run the test suite

If any command fails, fix the issues and re-run until all pass cleanly.

## Code Patterns

- UI components are split into `agent/components/` — not all in `app.tsx`
- Business logic delegates to `@vvtxn/relay`
- Use signals for reactive UI updates
- Handle errors gracefully with user feedback
- `@mention` expansion is in `mention.ts`, separate from the main app logic
