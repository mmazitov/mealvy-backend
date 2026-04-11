import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express4';
import cors from 'cors';
import express, { json } from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import depthLimit from 'graphql-depth-limit';
import http from 'http';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import { Context, createContext, prisma } from './context.js';
import oauthRouter from './oauth.js';
import './passport/strategies.js';
import { resolvers } from './resolvers.js';
import { typeDefs } from './schema.js';
import { setAuthCookies, clearAuthCookies, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY } from './shared/cookieHelpers.js';
import { JWT_SECRET } from './resolvers/utils.js';

const app = express();
const httpServer = http.createServer(app);

if (process.env.NODE_ENV === 'production') {
	if (!process.env.JWT_SECRET) {
		throw new Error('JWT_SECRET environment variable is required in production');
	}
	if (!process.env.SESSION_SECRET) {
		throw new Error('SESSION_SECRET environment variable is required in production');
	}
}

const allowedOrigins = [
	process.env.CLIENT_URL || 'http://localhost:5173',
	'https://mealvy.vercel.app',
	'http://localhost:5173',
	'http://localhost:5174',
	/^https:\/\/.*\.vercel\.app$/,
];

// Global Rate Limiter
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,       // 15 minutes window
	max: 1000,                      // Limit each IP to 1000 requests per `window`
	standardHeaders: true,          // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false,           // Disable the `X-RateLimit-*` headers
	message: 'Too many requests from this IP, please try again later.',
});

app.use(apiLimiter);
app.use(
	cors({
		origin: (origin, callback) => {
			if (!origin) return callback(null, true);
			
			for (const allowedOrigin of allowedOrigins) {
				if (typeof allowedOrigin === 'string' && allowedOrigin === origin) {
					return callback(null, true);
				}
				if (allowedOrigin instanceof RegExp && allowedOrigin.test(origin)) {
					return callback(null, true);
				}
			}
			
			return callback(new Error('Not allowed by CORS'), false);
		},
		credentials: true,
	})
);
app.use(json());
app.use(cookieParser());

// Session для Passport
app.use(
	session({
		secret: process.env.SESSION_SECRET || 'your-session-secret',
		resave: false,
		saveUninitialized: false,
		cookie: {
			secure: process.env.NODE_ENV === 'production',
			maxAge: 24 * 60 * 60 * 1000,
		},
	}) as any
);

app.use(passport.initialize() as any);
app.use(passport.session() as any);

// Routes
app.get('/', (req, res) => {
	res.json({
		status: 'ok',
		message: 'Mealvy API is running',
		endpoints: {
			graphql: '/graphql',
			auth: '/auth',
		},
	});
});

// POST /auth/refresh
app.post('/auth/refresh', async (req, res) => {
  const refreshToken: string | undefined = req.cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      clearAuthCookies(res);
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const newAccessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
    const newRefreshToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
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

app.use('/auth', oauthRouter);

// Apollo Server
const server = new ApolloServer<Context>({
	typeDefs,
	resolvers,
	introspection: process.env.NODE_ENV !== 'production',
	plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
	validationRules: [depthLimit(7)],
});

const startServer = async () => {
	await server.start();

	app.use(
		'/graphql',
		expressMiddleware(server, {
			context: async ({ req, res }) => createContext({ req, res }),
		})
	);

	const PORT = parseInt(process.env.PORT || '4000', 10);
	const HOST = process.env.HOST || '0.0.0.0';

	await new Promise<void>((resolve) =>
		httpServer.listen({ port: PORT, host: HOST }, resolve)
	);

	console.log(`🚀 Server ready at http://${HOST}:${PORT}/graphql`);
	console.log(`🔐 OAuth endpoints at http://${HOST}:${PORT}/auth`);
};

startServer().catch((err) => {
	console.error('Failed to start server:', err);
	process.exit(1);
});
