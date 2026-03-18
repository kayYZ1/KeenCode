# AGENTS.md - Root (Monorepo)

Terminal-based coding agent with custom TUI framework.

## Repository Structure

```
├── api/          # LLM provider integrations (see api/AGENTS.md)
├── core/         # Agent logic and tool execution (see core/AGENTS.md)
├── agent/        # Application entry point and UI (see agent/AGENTS.md)
├── tui/          # Terminal UI framework (see tui/AGENTS.md)
├── scripts/      # Build and version bump scripts
├── dist/         # Compiled binary output
├── version.ts    # Version constant (e.g., "0.3.3")
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
- **Run tests**: `deno task test` (requires `--allow-read --allow-write --allow-env --allow-run`)
- **Run agent**: `deno task agent` (requires `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL_URL` in `.env`)

### Build & Version

- **Build binary**: `deno task build` (compiles to `dist/keencode`)
- **Show version**: `deno task version`
- **Bump version**: `deno task version:bump <patch|minor|major>`

### Releasing

Tag-based releases via GitHub Actions (`.github/workflows/release.yml`):

1. `deno task version:bump <patch|minor|major>`
2. Commit and push to `main`
3. `git tag v<version> && git push --tags`
4. CI builds Linux binary and creates GitHub Release

### Development (Playgrounds)

- `deno task playground:agent` - Full agent demo (all features)
- `deno task playground:command-palette` - Command palette demo
- `deno task playground:diff` - Diff rendering demo
- `deno task playground:layout` - Box layout and borders demo
- `deno task playground:markdown` - Markdown rendering demo
- `deno task playground:scroll-area` - Scroll area demo
- `deno task playground:spinner` - Spinner animations demo
- `deno task playground:text-input` - Text input with vim mode demo
- `deno task playground:text-styling` - Text styling demo

## Import Aliases

Use path aliases for cross-package imports:

```typescript
import { CompletionsProvider } from "@/api/providers/completions.ts";
import { run } from "@/core/agent.ts";
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
