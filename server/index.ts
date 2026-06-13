import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express4';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { json, Request } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

app.use(helmet());

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
// limiter whenever the GraphQL document contains an auth operation.
// inviteFamilyMember is included because it sends emails to arbitrary addresses.
const isAuthOperation = (req: Request): boolean => {
  const query = req.body?.query;
  return (
    typeof query === 'string' &&
    /\b(login|register|changePassword|inviteFamilyMember)\b/.test(query)
  );
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

const server = new ApolloServer<Context>({
  typeDefs,
  resolvers,
  introspection: true, // Required for Vercel frontend builds
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  validationRules: [depthLimit(7)],
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
