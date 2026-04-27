import express from 'express';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { config } from './shared/config.js';
import {
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY,
    setAuthCookies,
} from './shared/cookieHelpers.js';

const router = express.Router();

if (config.isDev) {
    console.log('[OAuth] CLIENT_URL:', config.clientUrl);
}

// Info endpoint
router.get('/', (req, res) => {
	res.json({
		message: 'OAuth Authentication',
		providers: {
			google: '/auth/google-auth',
			github: '/auth/github-auth',
			facebook: '/auth/facebook-auth',
		},
		config: {
			clientUrl: config.clientUrl,
			nodeEnv: process.env.NODE_ENV,
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
                  '${config.clientUrl}'
                );
                setTimeout(() => window.close(), 500);
              }
            </script>
            </body></html>
          `);
        }

        const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
          expiresIn: ACCESS_TOKEN_EXPIRY,
        });
        const refreshToken = jwt.sign({ userId: user.id }, config.jwtSecret, {
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
                  '${config.clientUrl}'
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

router.get('/google-auth', 
	passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback', handleOAuthCallback('google'));

router.get('/github-auth',
	passport.authenticate('github', { scope: ['user:email'] })
);

router.get('/github/callback', handleOAuthCallback('github'));

router.get('/facebook-auth',
	passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/facebook/callback', handleOAuthCallback('facebook'));

export default router;
