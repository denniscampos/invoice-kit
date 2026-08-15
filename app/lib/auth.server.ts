import { betterAuth } from "better-auth";
import { redirect } from "react-router";
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

/* The three fields the app actually reads, rather than Better Auth's whole user
   object. Feature 7 takes `userId` from here to scope every invoice query, so
   widening this later is easy and narrowing it once several features read it is
   not. */
export type SessionUser = { id: string; name: string; email: string };

/* Who is signed in, or nobody. The one way to ask.

   Always from the request's own headers: a user id that arrived in a form field
   or a query parameter is a claim, not a fact, and feature 7 separates one
   person's invoices from another's using exactly what this returns. */
export async function getUser(
	request: Request,
	env: Env,
): Promise<SessionUser | null> {
	const session = await createAuth(env).api.getSession({
		headers: request.headers,
	});
	if (!session) return null;

	const { id, name, email } = session.user;

	return { id, name, email };
}

/* The same question, for a page that cannot render without an answer.

   It throws rather than returning null on purpose. A helper that can hand back
   nothing invites `user!.id` at the call site, and that assumption becomes a
   security bug the first day it is wrong. */
export async function requireUser(
	request: Request,
	env: Env,
): Promise<SessionUser> {
	const user = await getUser(request, env);
	if (user) return user;

	const { pathname, search } = new URL(request.url);

	throw redirect(`/sign-in?redirectTo=${encodeURIComponent(pathname + search)}`);
}

/* Where to send someone after they sign in, reduced to somewhere in this app.

   An unchecked `?redirectTo=` is an open redirect: an attacker sends a real link
   to our real sign in page, the user signs in for real, and lands on a copy of
   the site asking them to do it again. Only a path survives, so the worst a
   crafted link can do is choose which of our own pages someone lands on. */
/* Where an auth form should send someone on success: the `redirectTo` it was
   asked for, reduced to somewhere in this app. The other half of `requireUser`,
   which is what writes that parameter. */
export function redirectDestination(request: Request): string {
	return safeRedirectTo(new URL(request.url).searchParams.get("redirectTo"));
}

export function safeRedirectTo(value: string | null | undefined): string {
	if (!value || !value.startsWith("/")) return "/";

	/* `//evil.com` is a protocol-relative URL, and a browser reads a backslash
	   here the way it reads a slash, so `/\evil.com` leaves too. Both start with
	   the slash that got them past the check above. */
	if (value.startsWith("//") || value.startsWith("/\\")) return "/";

	return value;
}
