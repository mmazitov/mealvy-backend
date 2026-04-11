# JWT httpOnly Cookies Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate JWT storage from localStorage/Authorization header to httpOnly cookies, eliminating XSS token theft.

**Architecture:** The Express context passes `res` to GraphQL resolvers so they can `Set-Cookie` from mutations. The `refreshToken` flow moves from a GraphQL mutation to a dedicated REST route `POST /auth/refresh` — the only path that receives the `Path=/auth/refresh` cookie. OAuth popup callbacks set cookies server-side and signal success without exposing tokens in `postMessage`.

**Tech Stack:** Express `cookie-parser`, `jsonwebtoken`, Apollo Server 5 / `@as-integrations/express4`, Passport OAuth strategies (already installed, no new deps required).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `server/context.ts` | Modify | Add `res` to `Context`; read token from `req.cookies.token` |
| `server/index.ts` | Modify | Register `cookieParser()` middleware; pass `res` to `createContext`; add `/auth/refresh` and `/auth/logout` REST routes |
| `server/oauth.ts` | Modify | Set cookies in OAuth callbacks; drop `postMessage` token; restrict `postMessage` to known origin |
| `server/schemas/user.ts` | Modify | Remove `token`/`refreshToken` fields from `AuthPayload`; remove `refreshToken` mutation; add `logout` mutation |
| `server/resolvers/user.ts` | Modify | `login`/`register`/`handleOAuthCallback` set cookies via `context.res`; add `logout` resolver; remove `refreshToken` resolver |

---

## Task 1 — Update Context: read token from cookie, expose `res`

**Files:**
- Modify: `server/context.ts`

- [ ] **Step 1: Update `Context` interface and `createContext` function**

Replace the entire file with:

```typescript
import { PrismaClient } from '@prisma/client';
import { Response } from 'express';
import jwt from 'jsonwebtoken';

export const prisma = new PrismaClient();

export interface Context {
  prisma: PrismaClient;
  userId?: string;
  res: Response;
}

export const createContext = async (contextArg?: any): Promise<Context> => {
  const req = contextArg?.req || contextArg;
  const res = contextArg?.res;
  const cookies = req?.cookies || {};

  const token: string = cookies.token || '';

  let userId: string | undefined;

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'supersecret-dev-only',
      ) as { userId: string };
      userId = decoded.userId;
    } catch {
      // Invalid or expired token — userId stays undefined
    }
  }

  return { prisma, userId, res };
};
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /Users/vornic/Desktop/pet/mealvy/mealvy-backend && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors only about callers that haven't been updated yet (they will be fixed in subsequent tasks). If errors mention `server/context.ts` itself, fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git add server/context.ts
git commit -m "refactor(auth): read JWT from cookie, expose res in GraphQL context"
```

---

## Task 2 — Update `server/index.ts`: register `cookieParser`, pass `res` to context, add REST auth routes

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Add `cookie-parser` import and register middleware**

At the top of `server/index.ts`, add the import after the existing imports:

```typescript
import cookieParser from 'cookie-parser';
```

Then, just **after** `app.use(json());` (line 66 in current file), add:

```typescript
app.use(cookieParser());
```

- [ ] **Step 2: Pass `res` to `createContext` in the Apollo middleware**

Find the `expressMiddleware` call (around line 111–114) and replace:

```typescript
app.use(
  '/graphql',
  expressMiddleware(server, {
    context: async ({ req }) => createContext({ req }),
  })
);
```

with:

```typescript
app.use(
  '/graphql',
  expressMiddleware(server, {
    context: async ({ req, res }) => createContext({ req, res }),
  })
);
```

- [ ] **Step 3: Add `/auth/refresh` REST route**

Add these routes **before** `app.use('/auth', oauthRouter)`:

```typescript
import { JWT_SECRET } from './resolvers/utils.js';
```

Wait — `JWT_SECRET` is in `server/resolvers/utils.ts`. Import it at the top of `index.ts`:

```typescript
// Add after existing imports
import { JWT_SECRET } from './resolvers/utils.js';
```

Then add the REST routes after `app.use(passport.session() as any)` and before `app.get('/', ...)`:

```typescript
// ─── Cookie auth helpers ───────────────────────────────────────────────────

const ACCESS_TOKEN_MAX_AGE  = 15 * 60;           // 15 min  (seconds)
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days (seconds)

const COOKIE_DEFAULTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

export const setAuthCookies = (
  res: import('express').Response,
  accessToken: string,
  refreshToken: string,
) => {
  res.cookie('token', accessToken, {
    ...COOKIE_DEFAULTS,
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE * 1000,
  });
  res.cookie('refreshToken', refreshToken, {
    ...COOKIE_DEFAULTS,
    path: '/auth/refresh',
    maxAge: REFRESH_TOKEN_MAX_AGE * 1000,
  });
};

export const clearAuthCookies = (res: import('express').Response) => {
  res.clearCookie('token',         { path: '/' });
  res.clearCookie('refreshToken',  { path: '/auth/refresh' });
};

// POST /auth/refresh
app.post('/auth/refresh', async (req, res) => {
  const refreshToken: string | undefined = req.cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
    const user = await prisma.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const newAccessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, {
      expiresIn: `${ACCESS_TOKEN_MAX_AGE}s`,
    });
    const newRefreshToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, {
      expiresIn: `${REFRESH_TOKEN_MAX_AGE}s`,
    });

    setAuthCookies(res, newAccessToken, newRefreshToken);
    res.json({ ok: true });
  } catch {
    clearAuthCookies(res);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// POST /auth/logout
app.post('/auth/logout', (_req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});
```

> **Important:** `prisma` is exported from `server/context.ts`. Import it at the top of `index.ts`:
>
> ```typescript
> import { Context, createContext, prisma } from './context.js';
> ```
>
> (Replace the existing `import { Context, createContext }` line.)

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: only errors in `server/resolvers/user.ts` (to be fixed in Task 4). No errors in `server/index.ts`.

- [ ] **Step 5: Commit**

```bash
git add server/index.ts
git commit -m "feat(auth): add cookieParser, REST /auth/refresh + /auth/logout routes, cookie helpers"
```

---

## Task 3 — Update GraphQL schema: remove token fields, add `logout` mutation

**Files:**
- Modify: `server/schemas/user.ts`

- [ ] **Step 1: Update type definitions**

Replace the content of `server/schemas/user.ts` with:

```typescript
import { gql } from 'graphql-tag';

export const userTypeDefs = gql`
  type User {
    id: ID!
    role: String
    email: String
    name: String
    avatar: String
    phone: String
    diet: String
    allergy: [String!]!
    dislike: [String!]!
    createdAt: String!
    updatedAt: String!
    favoriteProducts: [Product!]!
    favoriteDishes: [Dish!]!
    dishesCount: Int!
    productsCount: Int!
  }

  # Tokens are now set as httpOnly cookies — only user is returned in the body
  type AuthPayload {
    user: User!
  }

  type SocialAuthPayload {
    user: User!
  }

  extend type Query {
    me: User
  }

  extend type Mutation {
    register(email: String!, password: String!, name: String): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    logout: Boolean!
    updateProfile(
      name: String
      phone: String
      avatar: String
      diet: String
      allergy: [String!]
      dislike: [String!]
    ): User!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
    handleOAuthCallback(provider: String!, code: String!): SocialAuthPayload!
  }
`;
```

Note: `refreshToken(token: String!): AuthPayload!` is removed — replaced by `POST /auth/refresh`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: errors only in `server/resolvers/user.ts` where resolver still returns `token`/`refreshToken`. These are fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add server/schemas/user.ts
git commit -m "feat(auth): remove token fields from AuthPayload, add logout mutation, drop refreshToken mutation"
```

---

## Task 4 — Update resolvers: set cookies, add `logout`, remove `refreshToken`

**Files:**
- Modify: `server/resolvers/user.ts`

- [ ] **Step 1: Add `setAuthCookies` import at the top of the file**

Add after the existing imports:

```typescript
import { setAuthCookies, clearAuthCookies } from '../index.js';
```

Wait — circular import risk. Move `setAuthCookies` and `clearAuthCookies` out of `index.ts` into a shared utility file.

**Correction:** Before touching the resolver, extract the cookie helpers into `server/shared/cookieHelpers.ts`:

Create `server/shared/cookieHelpers.ts`:

```typescript
import { Response } from 'express';

const ACCESS_TOKEN_MAX_AGE  = 15 * 60;           // 15 min  (seconds)
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days (seconds)

const COOKIE_DEFAULTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
): void => {
  res.cookie('token', accessToken, {
    ...COOKIE_DEFAULTS,
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE * 1000,
  });
  res.cookie('refreshToken', refreshToken, {
    ...COOKIE_DEFAULTS,
    path: '/auth/refresh',
    maxAge: REFRESH_TOKEN_MAX_AGE * 1000,
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie('token',        { path: '/' });
  res.clearCookie('refreshToken', { path: '/auth/refresh' });
};

export const ACCESS_TOKEN_EXPIRY  = `${ACCESS_TOKEN_MAX_AGE}s`;
export const REFRESH_TOKEN_EXPIRY = `${REFRESH_TOKEN_MAX_AGE}s`;
```

Then update `server/index.ts` to import helpers from there (remove the inline definitions added in Task 2):

```typescript
import {
  setAuthCookies,
  clearAuthCookies,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from './shared/cookieHelpers.js';
```

And update the `/auth/refresh` route in `index.ts` to use `ACCESS_TOKEN_EXPIRY` / `REFRESH_TOKEN_EXPIRY` instead of the inline string literals.

- [ ] **Step 2: Update `login` resolver**

Find the `login` resolver in `server/resolvers/user.ts` and replace with:

```typescript
login: async (
  _parent: unknown,
  args: { email: string; password: string },
  context: Context,
) => {
  const user = await context.prisma.user.findUnique({
    where: { email: args.email },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(args.password, user.password!);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  setAuthCookies(context.res, token, refreshToken);
  return { user };
},
```

- [ ] **Step 3: Update `register` resolver**

Replace the `register` resolver with:

```typescript
register: async (
  _parent: unknown,
  args: { email: string; password: string; name?: string },
  context: Context,
) => {
  const hashedPassword = await bcrypt.hash(args.password, 10);

  const user = await context.prisma.user.create({
    data: {
      email: args.email,
      password: hashedPassword,
      name: args.name,
    },
  });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  setAuthCookies(context.res, token, refreshToken);
  return { user };
},
```

- [ ] **Step 4: Update `handleOAuthCallback` resolver**

Replace the `handleOAuthCallback` resolver with:

```typescript
handleOAuthCallback: async (
  _parent: unknown,
  args: { provider: string; code: string },
  context: Context,
) => {
  return new Promise((resolve, reject) => {
    const req = {
      query: { code: args.code },
      user: null,
    } as any;

    passport.authenticate(
      args.provider,
      { session: false },
      (err: any, user: any) => {
        if (err || !user) {
          console.error(`[OAuth] ${args.provider} authentication failed:`, err);
          reject(new Error('Authentication failed'));
          return;
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
          expiresIn: ACCESS_TOKEN_EXPIRY,
        });
        const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
          expiresIn: REFRESH_TOKEN_EXPIRY,
        });

        setAuthCookies(context.res, token, refreshToken);
        resolve({ user });
      },
    )(req, {} as any, () => {});
  });
},
```

- [ ] **Step 5: Remove the `refreshToken` resolver and add `logout`**

Delete the entire `refreshToken` mutation resolver block and add `logout` in its place:

```typescript
logout: async (
  _parent: unknown,
  _args: unknown,
  context: Context,
) => {
  clearAuthCookies(context.res);
  return true;
},
```

- [ ] **Step 6: Add imports at the top of `server/resolvers/user.ts`**

Add:

```typescript
import {
  setAuthCookies,
  clearAuthCookies,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from '../shared/cookieHelpers.js';
```

- [ ] **Step 7: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add server/shared/cookieHelpers.ts server/resolvers/user.ts server/index.ts
git commit -m "feat(auth): set httpOnly cookies in login/register/logout/OAuth resolvers"
```

---

## Task 5 — Update OAuth popup callbacks: set cookies, restrict `postMessage` origin

**Files:**
- Modify: `server/oauth.ts`

- [ ] **Step 1: Add imports**

Add at the top of `server/oauth.ts`:

```typescript
import {
  setAuthCookies,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from './shared/cookieHelpers.js';
```

Replace `const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';` with:

```typescript
import { JWT_SECRET } from './resolvers/utils.js';
```

- [ ] **Step 2: Replace `handleOAuthCallback` function**

Replace the existing `handleOAuthCallback` function (lines 21–58) with:

```typescript
const handleOAuthCallback =
  (provider: string) => (req: any, res: any, next: any) => {
    passport.authenticate(
      provider,
      { session: false },
      (err: any, user: any) => {
        if (err || !user) {
          console.error(`[OAuth] ${provider} authentication failed:`, err);
          return res.status(401).send(`
            <!DOCTYPE html><html><body>
            <script>
              if (window.opener) {
                window.opener.postMessage(
                  { type: 'OAUTH_ERROR', error: 'Authentication failed' },
                  ${JSON.stringify(CLIENT_URL)}
                );
                setTimeout(() => window.close(), 500);
              }
            </script>
            </body></html>
          `);
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
          expiresIn: ACCESS_TOKEN_EXPIRY,
        });
        const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
          expiresIn: REFRESH_TOKEN_EXPIRY,
        });

        setAuthCookies(res, token, refreshToken);

        // Signal success to the opener — no token in postMessage
        res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Authentication Success</title></head>
          <body>
            <h3>Authentication successful! Closing window...</h3>
            <script>
              if (window.opener) {
                window.opener.postMessage(
                  { type: 'OAUTH_SUCCESS' },
                  ${JSON.stringify(CLIENT_URL)}
                );
                setTimeout(() => window.close(), 500);
              }
            </script>
          </body>
          </html>
        `);
      },
    )(req, res, next);
  };
```

Note: `CLIENT_URL` is already defined in this file — no change needed.

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add server/oauth.ts
git commit -m "feat(auth): OAuth callbacks set httpOnly cookies, restrict postMessage to CLIENT_URL"
```

---

## Task 6 — Verify CORS and run smoke test

**Files:**
- Verify: `server/index.ts` (no code change needed — CORS is already correct)

- [ ] **Step 1: Confirm CORS configuration**

The existing CORS setup in `server/index.ts` already has `credentials: true` and rejects `*` origins via the dynamic `allowedOrigins` array. No change required.

Confirm the env var `CLIENT_URL` is set to your frontend domain in `.env` (or `.env.production`):

```bash
grep CLIENT_URL /Users/vornic/Desktop/pet/mealvy/mealvy-backend/.env 2>/dev/null || echo "CLIENT_URL not found in .env — add it"
```

If missing, add to `.env`:
```
CLIENT_URL=https://mealvy.vercel.app
```

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

Expected: `🚀 Server ready at http://0.0.0.0:4000/graphql`

- [ ] **Step 3: Smoke test `login` — verify Set-Cookie headers**

```bash
curl -s -D - -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { login(email: \"test@example.com\", password: \"password\") { user { id email } } }"}' \
  2>&1 | grep -E '(set-cookie|Set-Cookie|"user")'
```

Expected output contains:
```
set-cookie: token=<jwt>; Max-Age=900; Path=/; HttpOnly; SameSite=Strict
set-cookie: refreshToken=<jwt>; Max-Age=2592000; Path=/auth/refresh; HttpOnly; SameSite=Strict
```
And in the JSON body: `"user": { "id": "...", "email": "..." }` — **no `token` field**.

- [ ] **Step 4: Smoke test `POST /auth/refresh`**

```bash
# First login to capture cookies
COOKIE=$(curl -s -c /tmp/mealvy_cookies.txt -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { login(email: \"test@example.com\", password: \"password\") { user { id } } }"}' > /dev/null && cat /tmp/mealvy_cookies.txt)

# Then call /auth/refresh with the cookies
curl -s -D - -b /tmp/mealvy_cookies.txt \
  -X POST http://localhost:4000/auth/refresh
```

Expected:
```
set-cookie: token=<new-jwt>; ...
set-cookie: refreshToken=<new-jwt>; ...
{"ok":true}
```

- [ ] **Step 5: Smoke test `POST /auth/logout`**

```bash
curl -s -D - -b /tmp/mealvy_cookies.txt \
  -X POST http://localhost:4000/auth/logout
```

Expected:
```
set-cookie: token=; Max-Age=0; Path=/; ...
set-cookie: refreshToken=; Max-Age=0; Path=/auth/refresh; ...
{"ok":true}
```

- [ ] **Step 6: Smoke test `me` query with cookie**

```bash
curl -s -b /tmp/mealvy_cookies.txt \
  -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { me { id email } }"}'
```

Expected: `{ "data": { "me": { "id": "...", "email": "..." } } }` — authenticated via cookie, no `Authorization` header needed.

- [ ] **Step 7: Final commit**

```bash
git add .env  # only if CLIENT_URL was just added
git commit -m "feat(auth): complete httpOnly cookie migration — smoke tests pass"
```

---

## Spec Coverage Checklist

| Requirement | Task |
|---|---|
| `login` sets `token` cookie (HttpOnly, Secure, SameSite=Strict, Path=/, Max-Age=900) | Task 4 |
| `login` sets `refreshToken` cookie (Path=/auth/refresh, Max-Age=2592000) | Task 4 |
| OAuth callbacks set same cookies | Task 5 |
| `POST /auth/refresh` reads `refreshToken` cookie, issues new `token` cookie | Task 2 |
| `POST /auth/logout` clears both cookies via Max-Age=0 | Task 2 |
| CORS: `credentials: true`, no wildcard origin | Already done — Task 6 verification |
| GraphQL context reads token from cookie, not `Authorization` header | Task 1 |
| `AuthPayload` no longer exposes tokens in response body | Task 3 |
| `postMessage` restricted to `CLIENT_URL` (no `'*'`) | Task 5 |
