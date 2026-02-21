# AGENTS.md - API

LLM provider integrations and API abstractions.

## Architecture

```
api/
├── index.ts              # Public exports
├── types.ts              # Shared types (Message, CompletionRequest, etc.)
├── providers/            # LLM provider implementations
│   ├── index.ts          # Provider registry
│   ├── openai.ts         # OpenAI API client
│   └── anthropic.ts      # Anthropic API client
└── streaming/            # Streaming response handling
    └── stream.ts         # SSE/streaming utilities
```

## Key Concepts

### Provider Interface

All LLM providers should implement a common interface:

```typescript
interface LLMProvider {
	complete(request: CompletionRequest): Promise<CompletionResponse>;
	stream(request: CompletionRequest): AsyncIterable<StreamChunk>;
}
```

### Message Types

Standardized message format across providers:

```typescript
interface Message {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
	toolCalls?: ToolCall[];
	toolCallId?: string;
}
```

## Dependencies

- No internal dependencies (leaf package)
- External: provider SDKs or fetch-based HTTP clients

## Code Patterns

- Providers are stateless; configuration passed at construction
- Use async iterables for streaming responses
- Normalize provider-specific errors to common error types
- Keep provider implementations isolated (no cross-provider imports)
