// server/shared/cookieHelpers.ts
import { Response } from 'express';
import { config } from './config.js';

export const ACCESS_TOKEN_MAX_AGE  = 15 * 60;           // 15 минут (секунды)
export const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 дней (секунды)

export const ACCESS_TOKEN_EXPIRY  = `${ACCESS_TOKEN_MAX_AGE}s`;
export const REFRESH_TOKEN_EXPIRY = `${REFRESH_TOKEN_MAX_AGE}s`;

const cookieDefaults = () => ({
  httpOnly: true,
  secure: !config.isDev,          // false на localhost (http), true в prod
  sameSite: config.isDev ? ('lax' as const) : ('none' as const),
  domain: config.cookieDomain,
});

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
): void => {
  res.cookie('token', accessToken, {
    ...cookieDefaults(),
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE * 1000,
  });
  res.cookie('refreshToken', refreshToken, {
    ...cookieDefaults(),
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE * 1000,
  });
};

export const clearAuthCookies = (res: Response): void => {
  const defaults = cookieDefaults();
  res.clearCookie('token', { ...defaults, path: '/' });
  res.clearCookie('refreshToken', { ...defaults, path: '/' });
};
