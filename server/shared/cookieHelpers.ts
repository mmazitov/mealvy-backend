import { Response } from 'express';

export const ACCESS_TOKEN_MAX_AGE  = 15 * 60;           // 15 min (seconds)
export const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days (seconds)

export const ACCESS_TOKEN_EXPIRY  = `${ACCESS_TOKEN_MAX_AGE}s`;
export const REFRESH_TOKEN_EXPIRY = `${REFRESH_TOKEN_MAX_AGE}s`;

const COOKIE_DEFAULTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
};

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
  res.clearCookie('token',        { path: '/' });
  res.clearCookie('refreshToken', { path: '/auth/refresh' });
};
