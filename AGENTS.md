# Agent Instructions for `mealvy-backend`

You are an AI assistant working on `mealvy-backend`, a Node.js / Express / Apollo Server / Prisma application for a food-tracking and meal-planning platform.

## 🚨 CRITICAL: Context Files 🚨

Detailed project documentation and strict coding standards are extracted into separate files. **You MUST adhere to the instructions in these files.** Do not make assumptions without checking them.

1. **Rules & Coding Standards**: `.ai/rules/rules.md`
   *Defines guidelines for AI model selection, token optimization, TypeScript/Node best practices, performance, DataLoaders, Prisma usage, and security.*

2. **Project Overview & Architecture**: `.ai/project/overview.md`
   *Defines the domain-sliced folder structure, GraphQL architecture, resolvers, services, and script commands.*

3. **Code Examples**: `.ai/rules/examples.md`
   *Correct vs incorrect code patterns for every backend rule — check this before writing new resolvers, services, or DB queries.*

---

## Quick Reference: Most Used Commands

*Detailed information on architecture and environments is in the overview file. Here are the day-to-day commands:*

- **Dev Server:** `npm run dev` (uses tsx)
- **Production Build:** `npm run build`
- **GraphQL Codegen:** `npm run generate` — regenerate TypeScript types and hooks after `.graphql` changes
- **Prisma Push:** `npm run prisma:push` — pushes schema changes to DB
- **Prisma Studio:** `npm run prisma:studio` — opens DB viewer

---

## Workflows & Slash Commands

You have access to specialized workflows. When the user types one of these slash commands, use the corresponding workflow from `.ai/commands/`:

- `/review` or `/code-review` — Perform a Senior Backend Engineer code review
- `/investigate-error` — Debug Node / Prisma / Apollo runtime errors
- `/performance` — Run a backend performance audit (N+1 queries, memory leaks, slow resolvers)
- `/explain-code` — Explain code with analogies and diagrams
- `/coding` — General coding assistance with project backend conventions

---

**Note:** Do not add new project rules directly to this file. Update `.ai/rules/rules.md` or `.ai/project/overview.md` to maintain a single source of truth.
