import express from 'express';
import passport from 'passport';
import { prisma } from './context.js';
import { config } from './shared/config.js';
import { setAuthCookies } from './shared/cookieHelpers.js';
import { logger } from './shared/logger.js';
import { createTokenPair } from './shared/tokens.js';

const router = express.Router();

// Callback pages run an inline postMessage script and must keep a reference
// to window.opener — relax headers ONLY there, not on the whole /auth router
const popupHeaders = (
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.setHeader('Content-Security-Policy', "script-src 'unsafe-inline'");
  next();
};

if (config.isDev) {
    logger.debug({ clientUrl: config.clientUrl }, '[OAuth] client URL');
}

router.get('/', (_req, res) => {
	res.json({
		message: 'OAuth Authentication',
		providers: {
			google: '/auth/google-auth',
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
      async (err: any, user: any) => {
        if (err || !user) {
          logger.error({ err, provider }, '[OAuth] authentication failed');
          return res.status(401).send(`
            <!DOCTYPE html><html><body>
            <h3>Authentication failed. Closing window...</h3>
            <script>
              // Google's sign-in pages send a COOP header that severs window.opener
              // during the redirect chain, so postMessage is best-effort only.
              try {
                if (window.opener && !window.opener.closed) {
                  window.opener.postMessage(
                    { type: 'OAUTH_ERROR', error: 'Authentication failed' },
                    '${config.clientUrl}'
                  );
                }
              } catch (e) {}
              // Close unconditionally; if the browser blocks it (COOP), navigate to
              // the app so the user is not stranded on this page.
              window.close();
              setTimeout(function () { window.location.replace('${config.clientUrl}'); }, 250);
            </script>
            </body></html>
          `);
        }

        const { accessToken, refreshToken } = await createTokenPair(user.id, prisma);

        setAuthCookies(res, accessToken, refreshToken);

        res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Authentication Success</title></head>
          <body>
            <h3>Authentication successful! Closing window...</h3>
            <script>
              // Google's sign-in pages send a COOP header that severs window.opener
              // during the redirect chain, so postMessage is best-effort only.
              try {
                if (window.opener && !window.opener.closed) {
                  window.opener.postMessage(
                    { type: 'OAUTH_SUCCESS' },
                    '${config.clientUrl}'
                  );
                }
              } catch (e) {}
              // Close unconditionally; if the browser blocks it (COOP), navigate to
              // the app where the cookie just set logs the user in.
              window.close();
              setTimeout(function () { window.location.replace('${config.clientUrl}'); }, 250);
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

router.get('/google/callback', popupHeaders, handleOAuthCallback('google'));

export default router;
