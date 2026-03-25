# 🤖 AI Development Context

This directory contains unified configuration, instructions, and tools for various AI assistants (Claude Code, Cursor, GitHub Copilot, Antigravity, etc.).

## 📂 Directory Structure

| Directory | Purpose |
| :--- | :--- |
| `commands/` | Custom slash commands and workflows (synced to `.claude/commands` and `.agent/workflows`). |
| `mcp/` | Model Context Protocol configurations (JSON) with dynamic project root injection. |
| `rules/` | Global linting and architectural rules for the AI to follow. |
| `project/` | High-level project context, architecture diagrams, and roadmap. |
| `prompts/` | Reusable prompt templates and persona definitions. |

## 🚀 Getting Started

To sync these configurations to your preferred AI tool, use the setup script in the root directory:

```bash
# Run interactive setup
./setup-ai-context.sh
```

The script will:
1.  **Create symlinks** for `AGENTS.md` (master instructions).
2.  **Sync commands and rules** to tool-specific hidden folders.
3.  **Generate MCP configurations** with correct absolute paths for your local environment.

## 🛠 Adding New Context

1.  **Commands**: Add `.md` files to `commands/`. They will be available as `/filename` in supported tools.
2.  **Rules**: Add specific guidelines to `rules/` to improve code quality and consistency.
3.  **MCP**: Define new MCP servers in `mcp/*.json`. Use `__PROJECT_ROOT__` as a placeholder for the absolute path to the project root.

---
*Maintained by the Mealvy team.*
