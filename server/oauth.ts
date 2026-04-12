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

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
          expiresIn: ACCESS_TOKEN_EXPIRY,
        });
        const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
          expiresIn: REFRESH_TOKEN_EXPIRY,
        });

        setAuthCookies(res, token, refreshToken);

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

export default router;
