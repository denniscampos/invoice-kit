import { betterAuth } from "better-auth";
import { MIN_PASSWORD_LENGTH } from "~/lib/auth-constants";

/* The auth server. Better Auth owns accounts, sessions, password hashing, and
   its own four tables in D1; nothing in this project hashes a password or mints
   a session token.

   A factory rather than a module level instance, and that is not a style
   preference: `env.DB` is a request scoped binding that does not exist while
   this module is being imported, so a top level `betterAuth({ database: env.DB })`
   would be constructed with nothing. Every caller builds one from the env it was
   handed. */
export function createAuth(env: Env) {
	return betterAuth({
		/* The binding goes straight in: `D1Database` is one of the accepted
		   database types, so there is no dialect to wire up and no adapter
		   package. */
		database: env.DB,

		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,

		/* The counter has to be shared or the rule is a fiction. Better Auth already
		   limits sign in to three attempts in ten seconds, but its default storage
		   is in memory, which on Workers means three per isolate: a caller spread
		   across isolates gets a multiple of the intended allowance. In the
		   database it is one count for the whole account.

		   Enabled in development too, against the library's default, because a
		   protection nobody can see locally is one nobody notices breaking. */
		rateLimit: {
			enabled: true,
			storage: "database",
		},

		emailAndPassword: {
			enabled: true,

			/* Stated rather than left to the library's default, because the sign up
			   form's label and the message explaining a refusal both read the same
			   constant. A rule the user is told about is a rule they can follow. */
			minPasswordLength: MIN_PASSWORD_LENGTH,

			/* Deferred for MVP, recorded in the feature 6a spec: verification needs
			   an email sender, which would be the first third party key a self
			   hoster has to obtain, against a setup promise of no service keys.
			   Sign up therefore works immediately. */
			requireEmailVerification: false,
		},
	});
}
