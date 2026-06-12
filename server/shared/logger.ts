import pino from 'pino';

import { config } from './config.js';

// JSON to stdout in production (picked up by the platform log collector),
// human-readable output in dev. Never pass secrets/tokens/PII into log fields.
export const logger = pino({
	level: process.env.LOG_LEVEL || (config.isDev ? 'debug' : 'info'),
	...(config.isDev && {
		transport: {
			target: 'pino-pretty',
			options: { colorize: true, translateTime: 'HH:MM:ss' },
		},
	}),
});
