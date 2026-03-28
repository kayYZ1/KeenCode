# AGENTS.md - Agent

The application entry point: ties together the TUI, core agent logic, and API packages.

## Architecture

```
agent/
├── index.ts              # Application entry point (imports app.tsx)
├── app.tsx               # Main application: config, UI components, agent loop integration
├── config.ts             # Default provider config (baseURL, model)
├── system-prompt.md      # System prompt for the LLM agent
└── hooks/
    └── project-files.ts  # useProjectFiles hook (git ls-files / directory walk for file indexing)
```

## Key Concepts

### Application Structure

Everything lives in `app.tsx` — configuration, UI components, and the agent loop integration:

```typescript
import { run as runAgent } from "@/core/agent.ts";
import { CompletionsProvider } from "@/api/providers/completions.ts";
import { createToolRegistry, defaultTools } from "@/core/tools/index.ts";
import { run } from "@/tui/render/index.ts";
import {
	Box,
	CommandPalette,
	Markdown,
	ScrollArea,
	Spinner,
	Text,
	TextInput,
	WelcomeScreen,
} from "@/tui/render/components.tsx";
```

### Configuration

- `LLM_API_KEY` (required) - API key for the LLM provider (set via environment variable)

Defaults in `config.ts`:

- `baseURL` - defaults to `https://openrouter.ai/api/v1`
- `model` - defaults to `moonshotai/kimi-k2.5`

### UI Components

Built with the TUI framework, all defined in `app.tsx`:

- `App` - Main application component with chat loop
- `StatusBar` - Branch name, token usage bar, cost display
- `TokenBar` - Color-coded progress bar for context window usage (200k)
- `PermissionDialog` - Tool permission approval dialog (once/chat/session/deny)
- `MessageView` - Renders user and agent messages with markdown
- `ToolCallView` - Displays tool calls with user-friendly names (Read, Write, Edit, Search, Grep, Run), input summary,
  output, and diffs
- `DiffView` - Renders unified diffs with syntax coloring
- Reactive state via `useSignal`
- Vim-style input via `useTextInput`
- Command palette (new chat, threads, quit) via `useCommandPalette`
- File mentions via `@` with project file indexing

### Agent Integration

- Uses `run()` async generator from `@/core/agent.ts` to stream agent events
- Handles `text_delta`, `tool_call_start/end`, `tool_result`, `turn_complete`, `message_complete`, `error` events
- Double Esc to cancel in-progress generation
- Tracks token usage and cost (including OpenRouter generation stats)
- Permission system for tool execution (allow once, per-chat, per-session, deny)
- Session persistence with thread switching

## Dependencies

- `@/api` - LLM provider (`CompletionsProvider`)
- `@/core` - Agent loop (`run`) and tools (`defaultTools`, `createToolRegistry`)
- `@/tui` - Terminal UI framework (components, hooks, input manager)

## Running

```bash
deno task agent
```

## Code Patterns

- All UI components are in a single file (`app.tsx`) for simplicity
- Delegate business logic to `@/core`
- Use signals for reactive UI updates
- Handle errors gracefully with user feedback
