# AGENTS.md - Core

Core agent logic: tool execution, context management, and the agent loop.

## Architecture

```
core/
├── index.ts              # Public exports
├── agent.ts              # Agent loop (async generator yielding AgentEvents)
├── context.ts            # Context trimming (token estimation, turn-based truncation)
├── tools/                # Tool system
│   ├── index.ts          # Tool exports and defaultTools registry
│   ├── types.ts          # Tool, ToolRegistry, ToolResult types; defineTool helper
│   ├── bash.ts           # Shell command execution
│   ├── read.ts           # File reading
│   ├── write.ts          # File writing
│   ├── edit.ts           # File editing (find-and-replace)
│   ├── diff.ts           # Unified diff generation (unifiedDiff utility)
│   ├── grep.ts           # Text search (ripgrep-style)
│   └── glob.ts           # File pattern matching
├── sessions/             # Session persistence
│   ├── index.ts          # Public exports
│   ├── manager.ts        # Session CRUD (create, list, load, save, delete)
│   ├── paths.ts          # Session storage paths (~/.keencode/sessions/)
│   └── types.ts          # Session types
└── tests/
    ├── agent.test.ts     # Agent loop tests
    ├── bash.test.ts      # Bash tool tests
    ├── context.test.ts   # Context trimming tests
    ├── edit.test.ts      # Edit tool tests
    ├── read.test.ts      # Read tool tests
    ├── session.test.ts   # Session management tests
    └── write.test.ts     # Write tool tests
```

## Key Concepts

### Agent Loop

The `run()` async generator in `agent.ts`:

1. Receive user input as messages
2. Build context (system prompt + history + tools)
3. Stream LLM response via `provider.stream()`
4. Parse response for tool calls
5. Execute tools: read-only tools in parallel, side-effect tools sequentially
6. Yield `AgentEvent`s for the UI to consume
7. Repeat until assistant responds without tool calls

Features: self-reflection every 3 rounds, loop detection (repeated tool calls), automatic retries with exponential
backoff, grounding nudges after side-effect tools.

### AgentEvent Types

```typescript
type AgentEvent =
	| { type: "text_delta"; content: string }
	| { type: "tool_call_start"; id: string; name: string }
	| { type: "tool_call_args_delta"; id: string; args: string }
	| { type: "tool_call_end"; id: string }
	| { type: "tool_result"; id: string; result: ToolResult }
	| { type: "message_complete"; usage?: Usage; generationId?: string }
	| { type: "turn_complete"; assistantMessage: Message; toolResults: Message[] }
	| { type: "error"; error: Error };
```

### Tool System

Tools are defined using `defineTool()`:

```typescript
interface Tool {
	definition: ToolDefinition;
	readonly?: boolean;
	execute(input: unknown): Promise<ToolResult>;
}
```

Built-in tools (`defaultTools`): `bash`, `read_file`, `write_file`, `edit_file`, `grep`, `glob`

### Context Management

`trimContext()` in `context.ts` trims messages to fit a token budget:

1. Group messages into turns (system, user, assistant+tool results)
2. If over budget: summarize old tool results (preview first 3 lines)
3. If still over: drop oldest droppable turns (preserving recent turns)

### Session Management

`sessions/manager.ts` provides persistent conversation storage:

- Sessions stored as JSON in `~/.keencode/sessions/`
- CRUD operations: create, list, load, save, delete
- Each session contains message history and metadata

## Dependencies

- `@/api` - LLM provider types and calls

## Code Patterns

- Tools use `defineTool()` helper for consistent structure
- Tools have a `readonly` flag for parallel execution optimization
- Use `ToolResult` with `isError` flag for error reporting
- Agent loop is an async generator for streaming updates
- Context trimming uses heuristic token estimation (~4 chars/token)
