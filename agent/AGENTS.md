# AGENTS.md - Agent

The application entry point: ties together the TUI, core agent logic, and API packages.

## Architecture

```
agent/
├── index.ts              # Application entry point
├── config.ts             # Agent configuration (model, tools, etc.)
├── ui/                   # TUI components
│   ├── app.tsx           # Main application component
│   ├── chat.tsx          # Chat/message display
│   ├── input.tsx         # User input handling
│   └── status.tsx        # Status bar, loading indicators
└── commands/             # User command handlers
    └── index.ts          # Command parsing and dispatch
```

## Key Concepts

### Application Structure

The agent ties together all packages:

```typescript
import { Anthropic } from "@/api/providers/anthropic.ts";
import { Agent, createContext } from "@/core/agent.ts";
import { Box, run, Text } from "@/tui/render/index.ts";
```

### UI Components

Built with the TUI framework:

- Reactive state via signals
- Vim-style input handling
- Streaming response display

### Configuration

Runtime configuration for:

- LLM provider and model selection
- Enabled tools
- System prompt customization

## Dependencies

- `@/api` - LLM provider clients
- `@/core` - Agent loop and tools
- `@/tui` - Terminal UI framework

## Running

```bash
deno task agent
```

## Code Patterns

- Keep UI components focused on presentation
- Delegate business logic to `@/core`
- Use signals for reactive UI updates
- Handle errors gracefully with user feedback
