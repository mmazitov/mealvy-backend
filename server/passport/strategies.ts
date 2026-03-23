import passport from 'passport';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../context.js';

async function findOrCreateUserFromOAuth(
	provider: string,
	profileId: string,
	profile: { emails?: { value: string }[], displayName?: string, username?: string, photos?: { value: string }[] }
) {
	let account = await prisma.account.findUnique({
		where: { provider_providerAccountId: { provider, providerAccountId: profileId } },
		include: { user: true },
	});

	if (account) return account.user;

	let user;
	if (profile.emails?.[0]?.value) {
		user = await prisma.user.findUnique({ where: { email: profile.emails[0].value } });
	}

	if (!user) {
		user = await prisma.user.create({
			data: {
				email: profile.emails?.[0]?.value,
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
				const user = await findOrCreateUserFromOAuth('google', profile.id, profile);
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
				const user = await findOrCreateUserFromOAuth('github', profile.id.toString(), profile);
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
				const user = await findOrCreateUserFromOAuth('facebook', profile.id, profile);
				return done(null, user);
			} catch (error) {
				return done(error);
			}
		},
	),
);

passport.serializeUser((user: any, done) => {
	done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
	try {
		const user = await prisma.user.findUnique({
			where: { id },
		});
		done(null, user);
	} catch (error) {
		done(error);
	}
});
