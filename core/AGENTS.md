# AGENTS.md - Core

Core agent logic: tool execution, context management, and the agent loop.

## Architecture

```
core/
├── index.ts              # Public exports
├── agent.ts              # Agent loop and orchestration
├── context.ts            # Conversation context/history management
├── tools/                # Tool system
│   ├── index.ts          # Tool registry and executor
│   ├── types.ts          # Tool interface definitions
│   ├── bash.ts           # Shell command execution
│   ├── read.ts           # File reading
│   └── write.ts          # File writing
└── parser.ts             # LLM response parsing (tool calls, content)
```

## Key Concepts

### Agent Loop

The core agent loop:

1. Receive user input
2. Build context (system prompt + history + tools)
3. Call LLM via `@/api`
4. Parse response for tool calls
5. Execute tools, append results to context
6. Repeat until assistant responds without tool calls

### Tool System

Tools should be defined with a schema and executor:

```typescript
interface Tool {
	name: string;
	description: string;
	parameters: JSONSchema;
	execute(params: unknown): Promise<ToolResult>;
}
```

### Context Management

- Manages conversation history
- Handles context window limits (truncation, summarization)
- Tracks token usage

## Dependencies

- `@/api` - LLM provider calls

## Code Patterns

- Tools are pure functions with side effects isolated to execute()
- Context is immutable; operations return new context
- Use Result types for tool execution (success/error)
- Agent loop is async generator for streaming updates
