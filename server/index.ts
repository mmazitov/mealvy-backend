import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express4';
import cors from 'cors';
import express, { json } from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import depthLimit from 'graphql-depth-limit';
import http from 'http';
import passport from 'passport';
import { Context, createContext } from './context.js';
import oauthRouter from './oauth.js';
import './passport/strategies.js';
import { resolvers } from './resolvers.js';
import { typeDefs } from './schema.js';

const app = express();
const httpServer = http.createServer(app);

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

app.use('/auth', oauthRouter);

// Apollo Server
const server = new ApolloServer<Context>({
	typeDefs,
	resolvers,
	introspection: true, // Enable introspection for GraphQL codegen
	plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
	validationRules: [depthLimit(7)],
});

const startServer = async () => {
	await server.start();

	app.use(
		'/graphql',
		expressMiddleware(server, {
			context: async ({ req }) => createContext({ req }),
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
