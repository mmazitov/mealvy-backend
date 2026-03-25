# Mealvy Backend – Project Review

## Overview

Mealvy Backend is a Node.js API built with Apollo Server (GraphQL), Express, Prisma ORM, and TypeScript. It serves as the data layer for the Mealvy Frontend, handling authentication, user management, and product/dish data for the food-tracking application.

---

## Architecture

### Layer breakdown

| Layer | Path | Responsibility |
|---|---|---|
| **Server/Config** | `server/index.ts`, `server/config/` | Application bootstrap, Apollo Server setup, Express middlewares |
| **Modules/Domains** | `server/modules/<domain>/` | Feature-specific logic (Resolvers, Services, TypeDefs) |
| **Data Access** | `prisma/` | Prisma schema, migrations, seed data |
| **Shared** | `server/shared/` | Common utilities, DataLoader configs, Types, Auth helpers |

### GraphQL Structure

```
ApolloServer
  ├── TypeDefs (Merged from all domains)
  ├── Resolvers (Merged from all domains)
  ├── Context (Authentication user, Prisma client, DataLoaders)
```

Schema uses string-based `.graphql` files or `gql` tag definitions merged together, with business logic completely abstracted into specific `Service` classes/functions.

---

## Technology Stack

| Category | Technology | Version |
|---|---|---|
| Runtime | Node.js | v20+ |
| Language | TypeScript | 5.9.x |
| Framework | Express | 4.x |
| GraphQL Server | Apollo Server | 5.x |
| ORM | Prisma | 6.x |
| Code Generator | GraphQL Codegen | 6.x |
| Authentication | Passport, JWT, bcrypt | various |
| Process Manager | TSX | 4.x |

---

## Core Principles

1. **Thin Resolvers:** Resolvers only extract arguments, authorize the request, and pass data to services.
2. **Context-Driven Security:** User context created from the JWT/Session gets passed to every resolver for authorization.
3. **DataLoaders:** Use `dataloader` pattern universally for nested graph relationships to avoid N+1 queries in Prisma.
4. **Generated Types:** Rely heavily on GraphQL Codegen and Prisma Client for end-to-end type safety instead of defining custom `.d.ts` where possible.

---

## Project Scripts

| Script | Command | Action |
|---|---|---|
| `dev` | `npm run dev` | Runs the server in watch mode via `tsx` |
| `build` | `npm run build` | Generates Prisma client and compiles TS to JS |
| `generate` | `npm run generate` | Runs GraphQL codegen |
| `prisma:push` | `npm run prisma:push` | Pushes schema changes directly to the DB |
| `prisma:studio` | `npm run prisma:studio` | Opens Prisma Studio to view DB entries |

---

## Known Issues & Improvement Areas

1. **Test Coverage** – Need to introduce a testing framework (e.g. Jest or Vitest) for Unit and Integration tests, especially for complex Services.
2. **Error Normalization** – Use centralized error classes that extend `GraphQLError` to maintain consistent error codes (`USER_NOT_FOUND`, `UNAUTHENTICATED`).
3. **Logging System** – Introduce a proper logging library like Winston or Pino instead of purely using `console.log`.
4. **Rate Limiting & Security** – Ensure proper ratelimiting rules and query-depth analysis exist in Apollo Server to prevent malicious attacks.
