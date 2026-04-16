import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '..', '.env.local') });
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const isDev = process.env.NODE_ENV !== 'production';

export const config = {
  isDev,
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',

  jwtSecret: isDev
    ? (process.env.JWT_SECRET || 'supersecret-dev-only')
    : required('JWT_SECRET'),

  sessionSecret: isDev
    ? (process.env.SESSION_SECRET || 'session-dev-only')
    : required('SESSION_SECRET'),

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  cookieDomain: process.env.COOKIE_DOMAIN || (isDev ? undefined : '.mealvy.app'),

  db: {
    url: required('DATABASE_URL'),
  },
} as const;
