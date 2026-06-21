import express from 'express';
import passport from 'passport';
import { prisma } from './context.js';
import { config } from './shared/config.js';
import { setAuthCookies } from './shared/cookieHelpers.js';
import { logger } from './shared/logger.js';
import { createTokenPair } from './shared/tokens.js';
import { EmailVerificationService } from './services/emailVerification.js';

const router = express.Router();

// Callback pages must keep a reference to window.opener (for postMessage), so we
// relax COOP ONLY there. The postMessage logic lives in a same-origin external
// script (/auth/oauth-callback.js) instead of an inline block, so CSP can stay
// 'script-src self' — no 'unsafe-inline'.
const popupHeaders = (
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'");
  next();
};

const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Reads its parameters from its own data-config attribute (set by the callback
// page) — no values are interpolated into executable code.
const CALLBACK_SCRIPT = `(function () {
  var el = document.currentScript;
  var data = {};
  try { data = JSON.parse(el.getAttribute('data-config')); } catch (e) {}
  var clientUrl = data.clientUrl;
  try {
    if (window.opener && !window.opener.closed && clientUrl) {
      var msg = data.type === 'OAUTH_SUCCESS'
        ? { type: 'OAUTH_SUCCESS' }
        : { type: 'OAUTH_ERROR', error: data.error || 'Authentication failed' };
      window.opener.postMessage(msg, clientUrl);
    }
  } catch (e) {}
  // Close unconditionally; if the browser blocks it (COOP), navigate to the app.
  window.close();
  if (clientUrl) {
    setTimeout(function () { window.location.replace(clientUrl); }, 250);
  }
})();`;

const renderCallbackPage = (
  type: 'OAUTH_SUCCESS' | 'OAUTH_ERROR',
  heading: string,
  error?: string,
): string => {
  const cfg = escapeAttr(
    JSON.stringify({ type, clientUrl: config.clientUrl, error }),
  );
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Mealvy</title></head>
<body>
  <h3>${heading}</h3>
  <script src="/auth/oauth-callback.js" data-config="${cfg}"></script>
</body>
</html>`;
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
          return res
            .status(401)
            .send(
              renderCallbackPage(
                'OAUTH_ERROR',
                'Authentication failed. Closing window...',
                'Authentication failed',
              ),
            );
        }

        const { accessToken, refreshToken } = await createTokenPair(user.id, prisma);

        setAuthCookies(res, accessToken, refreshToken);

        res.send(
          renderCallbackPage(
            'OAUTH_SUCCESS',
            'Authentication successful! Closing window...',
          ),
        );
      },
    )(req, res, next);
  };

router.get('/oauth-callback.js', (_req, res) => {
	res.type('application/javascript').send(CALLBACK_SCRIPT);
});

// Verification links point here (backend), never at the frontend, so the raw
// token is never exposed to client JS. clientUrl is fixed config — not the token
// — so there's no open-redirect surface.
router.get('/verify-email', async (req, res) => {
	const token = typeof req.query.token === 'string' ? req.query.token : '';
	const ok = token
		? await EmailVerificationService.verify(token, prisma)
		: false;
	res.redirect(`${config.clientUrl}/?emailVerified=${ok ? 'success' : 'invalid'}`);
});

router.get('/google-auth',
	passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback', popupHeaders, handleOAuthCallback('google'));

export default router;
