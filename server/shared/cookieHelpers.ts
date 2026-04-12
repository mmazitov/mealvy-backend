import { Response } from 'express';

export const ACCESS_TOKEN_MAX_AGE  = 15 * 60;           // 15 min (seconds)
export const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days (seconds)

export const ACCESS_TOKEN_EXPIRY  = `${ACCESS_TOKEN_MAX_AGE}s`;
export const REFRESH_TOKEN_EXPIRY = `${REFRESH_TOKEN_MAX_AGE}s`;

const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_DEFAULTS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
};

/**
 * Sets auth cookies on the response.
 * The refreshToken cookie uses path '/auth/refresh' intentionally — the browser
 * will only send it to that endpoint, limiting the attack surface if tokens
 * are somehow intercepted via other routes.
 */
export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
): void => {
  res.cookie('token', accessToken, {
    ...COOKIE_DEFAULTS,
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE * 1000,
  });
  res.cookie('refreshToken', refreshToken, {
    ...COOKIE_DEFAULTS,
    path: '/auth/refresh',
    maxAge: REFRESH_TOKEN_MAX_AGE * 1000,
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie('token', { ...COOKIE_DEFAULTS, path: '/' });
  res.clearCookie('refreshToken', { ...COOKIE_DEFAULTS, path: '/auth/refresh' });
};
