import passport from 'passport';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../context.js';

async function findOrCreateUserFromOAuth(
	provider: string,
	profileId: string,
	profile: {
		emails?: { value: string }[];
		displayName?: string;
		username?: string;
		photos?: { value: string }[];
	},
	// Linking by email is an account-takeover vector when the provider hasn't
	// verified the address (attacker registers victim's email at the provider)
	isEmailVerified: boolean,
) {
	let account = await prisma.account.findUnique({
		where: {
			provider_providerAccountId: { provider, providerAccountId: profileId },
		},
		include: { user: true },
	});

	if (account) return account.user;

	const email = profile.emails?.[0]?.value;

	let user;
	if (email) {
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing && !isEmailVerified) {
			throw new Error(
				`Email ${email} is already registered. Sign in with your original method first.`,
			);
		}
		user = existing ?? undefined;
	}

	if (!user) {
		user = await prisma.user.create({
			data: {
				// Unverified emails are not stored — otherwise this account would
				// block (or hijack) the real owner's future registration
				email: isEmailVerified ? email : undefined,
				name: profile.displayName || profile.username,
				...(profile.photos?.[0]?.value && {
					avatar: profile.photos[0].value,
				}),
			},
		});
	}

	await prisma.account.create({
		data: {
			userId: user.id,
			provider,
			providerAccountId: profileId,
		},
	});

	return user;
}
passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
			callbackURL:
				process.env.GOOGLE_CALLBACK_URL ||
				'http://localhost:4000/auth/google/callback',
		},
		async (accessToken, refreshToken, profile, done) => {
			try {
				// Google reports verification per email entry
				const isEmailVerified =
					(profile.emails?.[0] as { verified?: boolean | string } | undefined)
						?.verified === true ||
					(profile._json as { email_verified?: boolean } | undefined)
						?.email_verified === true;
				const user = await findOrCreateUserFromOAuth(
					'google',
					profile.id,
					profile,
					isEmailVerified,
				);
				return done(null, user);
			} catch (error) {
				return done(error);
			}
		},
	),
);

passport.use(
	new GitHubStrategy(
		{
			clientID: process.env.GITHUB_CLIENT_ID!,
			clientSecret: process.env.GITHUB_CLIENT_SECRET!,
			callbackURL:
				process.env.GITHUB_CALLBACK_URL ||
				'http://localhost:4000/auth/github/callback',
		},
		async (
			accessToken: string,
			refreshToken: string,
			profile: any,
			done: any,
		) => {
			try {
				// passport-github2 exposes no verification flag — treat as unverified
				const user = await findOrCreateUserFromOAuth(
					'github',
					profile.id.toString(),
					profile,
					false,
				);
				return done(null, user);
			} catch (error) {
				return done(error);
			}
		},
	),
);

passport.use(
	new FacebookStrategy(
		{
			clientID: process.env.FACEBOOK_APP_ID!,
			clientSecret: process.env.FACEBOOK_APP_SECRET!,
			callbackURL:
				process.env.FACEBOOK_CALLBACK_URL ||
				'http://localhost:4000/auth/facebook/callback',
			profileFields: ['id', 'displayName', 'photos', 'email'],
		},
		async (accessToken, refreshToken, profile, done) => {
			try {
				// Facebook only returns confirmed email addresses
				const user = await findOrCreateUserFromOAuth(
					'facebook',
					profile.id,
					profile,
					true,
				);
				return done(null, user);
			} catch (error) {
				return done(error);
			}
		},
	),
);
