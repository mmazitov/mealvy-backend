import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express4';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { json } from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import depthLimit from 'graphql-depth-limit';
import http from 'http';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { config } from './shared/config.js';
import { Context, createContext, prisma } from './context.js';
import oauthRouter from './oauth.js';
import './passport/strategies.js';
import { resolvers } from './resolvers.js';
import { JWT_SECRET } from './resolvers/utils.js';
import { typeDefs } from './schema.js';
import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  clearAuthCookies,
  setAuthCookies,
} from './shared/cookieHelpers.js';

const app = express();
const httpServer = http.createServer(app);

const buildAllowedOrigins = (): (string | RegExp)[] => {
  const origins: (string | RegExp)[] = [
    'http://localhost:5173',
    'http://localhost:5174',
    /^https:\/\/.*\.vercel\.app$/,
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

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});

app.use(apiLimiter);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      for (const allowed of allowedOrigins) {
        if (typeof allowed === 'string' && allowed === origin) return callback(null, true);
        if (allowed instanceof RegExp && allowed.test(origin)) return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  })
);
app.use(json());
app.use(cookieParser());
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: !config.isDev,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }) as any
);
app.use(passport.initialize() as any);
app.use(passport.session() as any);

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Mealvy API', endpoints: { graphql: '/graphql', auth: '/auth' } });
});

app.post('/auth/refresh', async (req, res) => {
  const refreshToken: string | undefined = req.cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      clearAuthCookies(res);
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const newAccess = jwt.sign({ userId: payload.userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const newRefresh = jwt.sign({ userId: payload.userId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
    setAuthCookies(res, newAccess, newRefresh);
    res.json({ ok: true });
  } catch (error) {
    clearAuthCookies(res);
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.NotBeforeError
    ) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
    } else {
      console.error('[/auth/refresh] Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.post('/auth/logout', (_req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

app.use('/auth', oauthRouter);

const server = new ApolloServer<Context>({
  typeDefs,
  resolvers,
  introspection: config.isDev,
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

  console.log(`🚀 Server ready at http://${config.host}:${config.port}/graphql`);
  console.log(`🔐 OAuth endpoints at http://${config.host}:${config.port}/auth`);
  if (config.isDev) {
    console.log(`[ENV] CLIENT_URL: ${config.clientUrl}`);
  }
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
