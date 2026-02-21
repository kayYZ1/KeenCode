# AGENTS.md - Root (Monorepo)

Terminal-based coding agent with custom TUI framework.

## Repository Structure

```
├── api/          # LLM provider integrations (see api/AGENTS.md)
├── core/         # Agent logic and tool execution (see core/AGENTS.md)
├── agent/        # Application entry point and UI (see agent/AGENTS.md)
├── tui/          # Terminal UI framework (see tui/AGENTS.md)
├── dev/          # Development tools (logs, snapshots)
├── deno.json     # Deno configuration with tasks and import maps
```

## Package Dependencies

```
api/      (leaf - no internal deps)
  ↑
core/     (depends on api/)
  ↑
agent/    (depends on core/, api/, tui/)
  ↑
tui/      (leaf - no internal deps)
```

## Build/Run Commands

- **Format code**: `deno task fmt`
- **Check formatting**: `deno task fmt:check`
- **Lint**: `deno task lint`
- **Run tests**: `deno task test`
- **Run agent**: `deno task agent`

### Development (Playgrounds)

- `deno task playground:agent` - Full agent demo (all features)
- `deno task playground:command-palette` - Command palette demo
- `deno task playground:layout` - Box layout and borders demo
- `deno task playground:markdown` - Markdown rendering demo
- `deno task playground:scroll-area` - Scroll area demo
- `deno task playground:spinner` - Spinner animations demo
- `deno task playground:text-input` - Text input with vim mode demo
- `deno task playground:text-styling` - Text styling demo

## Import Aliases

Use path aliases for cross-package imports:

```typescript
import { Anthropic } from "@/api/providers/anthropic.ts";
import { Agent } from "@/core/agent.ts";
import { Box, Text } from "@/tui/render/components.tsx";
```

## Code Style Guidelines

- **Language**: TypeScript with strict mode
- **Runtime**: Deno
- **Formatting**: deno fmt (tabs, 120 line width, double quotes)
- **Imports**: ES modules with `.ts` extensions and `@/` path alias
- **Naming**: camelCase for variables/functions, PascalCase for types/classes, UPPER_CASE for constants

## Sub-package Guidelines

Each sub-package has its own AGENTS.md with package-specific details:

- `api/AGENTS.md` - LLM providers and API types
- `core/AGENTS.md` - Agent loop, tools, context
- `agent/AGENTS.md` - Application and UI
- `tui/AGENTS.md` - Terminal UI framework
