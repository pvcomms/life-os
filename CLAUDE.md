# life-os

Param's autonomous life OS. Seven scheduled-tasks agents running 24/7.

## Architecture

Each agent in `agents/` documents its prompt, schedule, and integrations. The actual registered task prompts live in `~/.claude/scheduled-tasks/`. This repo is the source-of-truth for prompt versions — update here, then copy to the registered task.

## Essays pipeline

Monthly synthesis agent opens PRs to `monthly/YYYY-MM` branches. Review and merge when ready to publish.

## Key IDs

- Notion command center: 343b6913e6b8810d98b1f1f8c11f7ab9
- Notion Claude Sessions DB: 2a972407-306a-450d-9351-330f62e90d95
- Vercel team: pum268-2283s-projects
