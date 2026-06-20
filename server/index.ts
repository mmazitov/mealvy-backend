import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express4';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { json, Request } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {
  GraphQLError,
  parse,
  type ASTVisitor,
  type ValidationContext,
} from 'graphql';
import depthLimit from 'graphql-depth-limit';
import http from 'http';
import passport from 'passport';
import { config } from './shared/config.js';
import { logger } from './shared/logger.js';
import { Context, createContext, prisma } from './context.js';
import oauthRouter from './oauth.js';
import './passport/strategies.js';
import { resolvers } from './resolvers.js';
import { typeDefs } from './schema.js';
import { clearAuthCookies, setAuthCookies } from './shared/cookieHelpers.js';
import {
  createTokenPair,
  revokeRefreshToken,
  verifyRefreshToken,
} from './shared/tokens.js';

const app = express();
const httpServer = http.createServer(app);

// Behind a single TLS-terminating proxy (fly.dev): needed for correct req.ip
// (rate limiting) and secure-cookie detection
app.set('trust proxy', 1);

const buildAllowedOrigins = (): string[] => {
  // NOTE: never use origin wildcards (e.g. *.vercel.app) here — with
  // credentials: true that would let any site on that domain act as the user
  const origins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://mealvy.vercel.app',
  ];

  if (config.clientUrl) {
    origins.push(config.clientUrl);
  }

  if (!config.isDev) {
    origins.push('https://mealvy.app', 'https://www.mealvy.app');
  }

  return origins;
};

const allowedOrigins = buildAllowedOrigins();

app.use(
  helmet({
    // HSTS only in production (localhost is plain http); 2 years + preload-eligible
    hsts: config.isDev
      ? false
      : { maxAge: 63072000, includeSubDomains: true, preload: true },
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts, please try again later.',
});

app.use(apiLimiter);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  })
);
app.use(json());
app.use(cookieParser());
app.use(passport.initialize() as any);

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Mealvy API', endpoints: { graphql: '/graphql', auth: '/auth' } });
});

// Login/register/changePassword go through /graphql, so the global apiLimiter
// (1000 req/15 min) is far too generous for brute force — apply the strict
// limiter whenever the GraphQL document selects an auth mutation.
// inviteFamilyMember is included because it sends emails to arbitrary addresses.
const AUTH_OPERATIONS = new Set([
  'login',
  'register',
  'changePassword',
  'inviteFamilyMember',
]);

// Parse the actual operation AST instead of regex-matching the raw body: aliases,
// comments, and field names in unrelated fragments can't trip or evade this.
const selectsAuthMutation = (query: string): boolean => {
  let document;
  try {
    document = parse(query);
  } catch {
    // Unparseable — Apollo will reject it; it can't be a valid auth mutation
    return false;
  }
  return document.definitions.some(
    (def) =>
      def.kind === 'OperationDefinition' &&
      def.operation === 'mutation' &&
      def.selectionSet.selections.some(
        (sel) => sel.kind === 'Field' && AUTH_OPERATIONS.has(sel.name.value)
      )
  );
};

const isAuthOperation = (req: Request): boolean => {
  const body = req.body;
  const queries: unknown[] = Array.isArray(body)
    ? body.map((op) => op?.query)
    : [body?.query];
  return queries.some((q) => typeof q === 'string' && selectsAuthMutation(q));
};

app.use('/graphql', (req, res, next) => {
  if (isAuthOperation(req)) {
    authLimiter(req, res, next);
    return;
  }
  next();
});

app.use('/auth/refresh', authLimiter);

app.post('/auth/refresh', async (req, res) => {
  const refreshToken: string | undefined = req.cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  try {
    const userId = await verifyRefreshToken(refreshToken, prisma);
    if (!userId) {
      clearAuthCookies(res);
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      await revokeRefreshToken(refreshToken, prisma);
      clearAuthCookies(res);
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Rotate: the old token stops working as soon as the new one is issued
    await revokeRefreshToken(refreshToken, prisma);
    const { accessToken, refreshToken: newRefresh } = await createTokenPair(userId, prisma);
    setAuthCookies(res, accessToken, newRefresh);
    res.json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, '[/auth/refresh] Unexpected error');
    clearAuthCookies(res);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/logout', async (req, res) => {
  const refreshToken: string | undefined = req.cookies?.refreshToken;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken, prisma);
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

app.use('/auth', oauthRouter);

// Bound total query cost (field count) so a syntactically shallow but very wide
// query can't be used to amplify load past the depth limit. Implemented as a
// validation rule (Apollo's own graphql instance) rather than a separate cost
// library to avoid pulling in a second graphql realm.
const MAX_QUERY_COMPLEXITY = 1000;

const complexityLimit =
  (max: number) =>
  (context: ValidationContext): ASTVisitor => {
    let fieldCount = 0;
    return {
      Field() {
        fieldCount += 1;
        if (fieldCount > max) {
          context.reportError(
            new GraphQLError(
              `Query is too complex: exceeds ${max} fields.`,
              { extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }
            )
          );
        }
      },
    };
  };

// Client-safe error codes pass through verbatim; anything else (DB errors,
// unexpected throws) is masked in production so we never leak internals/stack traces.
const SAFE_ERROR_CODES = new Set([
  'BAD_USER_INPUT',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'GRAPHQL_VALIDATION_FAILED',
  'GRAPHQL_PARSE_FAILED',
  'PERSISTED_QUERY_NOT_FOUND',
  'PERSISTED_QUERY_NOT_SUPPORTED',
]);

const server = new ApolloServer<Context>({
  typeDefs,
  resolvers,
  // Introspection is disabled in production: the Origin header it would gate on is optional and
  // spoofable, so it offers no real protection. The frontend codegen consumes the committed
  // schema.graphql (see `npm run schema:export`) instead of introspecting the live server.
  introspection: config.isDev,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  validationRules: [depthLimit(7), complexityLimit(MAX_QUERY_COMPLEXITY)],
  formatError: (formattedError) => {
    if (config.isDev) return formattedError;
    const code = formattedError.extensions?.code;
    if (typeof code === 'string' && SAFE_ERROR_CODES.has(code)) {
      return { message: formattedError.message, extensions: { code } };
    }
    return {
      message: 'Internal server error',
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    };
  },
});

const startServer = async () => {
  await server.start();

  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req, res }) => createContext({ req, res }),
  }));

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: config.port, host: config.host }, resolve)
  );

  logger.info(`Server ready at http://${config.host}:${config.port}/graphql`);
  logger.info(`OAuth endpoints at http://${config.host}:${config.port}/auth`);
  if (config.isDev) {
    logger.debug(`CLIENT_URL: ${config.clientUrl}`);
  }
};

startServer().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down gracefully...');
  try {
    await server.stop();
    await prisma.$disconnect();
    httpServer.close(() => process.exit(0));
    // Don't wait forever for open connections to drain
    setTimeout(() => process.exit(0), 10_000).unref();
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
