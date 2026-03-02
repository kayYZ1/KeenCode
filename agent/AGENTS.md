# AGENTS.md - Agent

The application entry point: ties together the TUI, core agent logic, and API packages.

## Architecture

```
agent/
├── index.ts              # Application entry point (imports app.tsx)
└── app.tsx               # Main application: config, UI components, agent loop integration
```

## Key Concepts

### Application Structure

Everything lives in `app.tsx` — configuration, UI components, and the agent loop integration:

```typescript
import { run as runAgent } from "@/core/agent.ts";
import { CompletionsProvider } from "@/api/providers/completions.ts";
import { createToolRegistry, defaultTools } from "@/core/tools/index.ts";
import { run } from "@/tui/render/index.ts";
import { Box, CommandPalette, Markdown, ScrollArea, Spinner, Text, TextInput } from "@/tui/render/components.tsx";
```

### Configuration

Environment variables (via `@std/dotenv`):

- `LLM_API_KEY` - API key for the LLM provider
- `LLM_BASE_URL` - Base URL for the OpenAI-compatible API
- `LLM_MODEL_URL` - Model identifier

### UI Components

Built with the TUI framework, all defined in `app.tsx`:

- `App` - Main application component with chat loop
- `StatusBar` - Model name, token count, cost display
- `MessageView` - Renders user and agent messages
- `ToolCallView` - Displays tool call name, input, and output
- Reactive state via `useSignal`
- Vim-style input via `useTextInput`
- Command palette (new chat, quit) via `useCommandPalette`

### Agent Integration

- Uses `run()` async generator from `@/core/agent.ts` to stream agent events
- Handles `text_delta`, `tool_call_start/end`, `tool_result`, `message_complete`, `error` events
- Double Ctrl+C to cancel in-progress generation
- Tracks token usage and cost (including OpenRouter generation stats)

## Dependencies

- `@/api` - LLM provider (`CompletionsProvider`)
- `@/core` - Agent loop (`run`) and tools (`defaultTools`, `createToolRegistry`)
- `@/tui` - Terminal UI framework (components, hooks, input manager)
- `@std/dotenv` - Environment variable loading

## Running

```bash
deno task agent
```

## Code Patterns

- All UI components are in a single file (`app.tsx`) for simplicity
- Delegate business logic to `@/core`
- Use signals for reactive UI updates
- Handle errors gracefully with user feedback
