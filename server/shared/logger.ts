import { createRequire } from 'module';

import pino from 'pino';

import { config } from './config.js';

const require = createRequire(import.meta.url);

// pino-pretty is a dev-only dependency, absent from production installs. Guard
// on actual resolvability instead of NODE_ENV alone, so a misconfigured
// environment can never crash the process on a missing transport target.
const hasPrettyTransport = (): boolean => {
	try {
		require.resolve('pino-pretty');
		return true;
	} catch {
		return false;
	}
};

// JSON to stdout in production (picked up by the platform log collector),
// human-readable output in dev. Never pass secrets/tokens/PII into log fields.
export const logger = pino({
	level: process.env.LOG_LEVEL || (config.isDev ? 'debug' : 'info'),
	...(config.isDev && hasPrettyTransport() && {
		transport: {
			target: 'pino-pretty',
			options: { colorize: true, translateTime: 'HH:MM:ss' },
		},
	}),
});
