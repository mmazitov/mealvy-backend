import express from 'express';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { JWT_SECRET } from './resolvers/utils.js';
import {
	ACCESS_TOKEN_EXPIRY,
	REFRESH_TOKEN_EXPIRY,
	setAuthCookies,
} from './shared/cookieHelpers.js';

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = [
	'http://localhost:5173',
	'http://localhost:5174',
	'https://mealvy.vercel.app',
	process.env.CLIENT_URL,
].filter(Boolean);

// Info endpoint
router.get('/', (req, res) => {
	res.json({
		message: 'OAuth Authentication',
		providers: {
			google: '/auth/google-auth',
			github: '/auth/github-auth',
			facebook: '/auth/facebook-auth',
		},
	});
});

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
                  '*'
                );
                setTimeout(() => window.close(), 500);
              }
            </script>
            </body></html>
          `);
        }

        const sessionToken = jwt.sign(
          { userId: user.id, type: 'oauth_session' },
          JWT_SECRET,
          { expiresIn: '5m' }
        );

        res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Authentication Success</title></head>
          <body>
            <h3>Authentication successful! Closing window...</h3>
            <script>
              if (window.opener) {
                window.opener.postMessage(
                  { type: 'OAUTH_SUCCESS', sessionToken: ${JSON.stringify(sessionToken)} },
                  '*'
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

router.get('/google-auth', (req, res, next) => {
	if (req.query.code) {
		handleOAuthCallback('google')(req, res, next);
	} else {
		passport.authenticate('google', { scope: ['profile', 'email'] })(
			req,
			res,
			next,
		);
	}
});

router.get('/google/callback', handleOAuthCallback('google'));

router.get('/github-auth', (req, res, next) => {
	if (req.query.code) {
		handleOAuthCallback('github')(req, res, next);
	} else {
		passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
	}
});

router.get('/github/callback', handleOAuthCallback('github'));

router.get('/facebook-auth', (req, res, next) => {
	if (req.query.code) {
		handleOAuthCallback('facebook')(req, res, next);
	} else {
		passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
	}
});

router.get('/facebook/callback', handleOAuthCallback('facebook'));

router.post('/exchange-session', (req, res) => {
	const { sessionToken } = req.body;
	
	if (!sessionToken) {
		return res.status(400).json({ error: 'Session token required' });
	}

	try {
		const payload = jwt.verify(sessionToken, JWT_SECRET) as any;
		
		if (payload.type !== 'oauth_session') {
			return res.status(401).json({ error: 'Invalid session token type' });
		}

		const accessToken = jwt.sign({ userId: payload.userId }, JWT_SECRET, {
			expiresIn: ACCESS_TOKEN_EXPIRY,
		});
		const refreshToken = jwt.sign({ userId: payload.userId }, JWT_SECRET, {
			expiresIn: REFRESH_TOKEN_EXPIRY,
		});

		setAuthCookies(res, accessToken, refreshToken);
		res.json({ ok: true });
	} catch (error) {
		console.error('[OAuth] Session token exchange failed:', error);
		res.status(401).json({ error: 'Invalid or expired session token' });
	}
});

export default router;
