import { APIError } from "better-auth/api";
import { MIN_PASSWORD_LENGTH } from "~/lib/auth-constants";

/* What a person reads when signing in or signing up is refused.

   Server only, and deliberately so: importing `better-auth/api` from a route
   module would drag the library into the client bundle for the sake of one
   string. The action computes the sentence and sends it down as data.

   Better Auth's own messages are not all fit to show. A validation failure
   arrives as "[body.email] Invalid input", which is a developer's sentence, and
   "Password too short" never says how short. So the mapping is by code, and
   anything unrecognized falls back rather than leaking whatever a library or a
   database decided to say. */

const GENERIC = "Something went wrong. Please try again.";

const BY_CODE: Record<string, string> = {
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
		"An account with that email already exists. Try signing in instead.",
	/* The same sentence for a wrong password and for an email with no account,
	   because a form that distinguishes them tells a stranger which addresses
	   are registered. */
	INVALID_EMAIL_OR_PASSWORD: "Invalid email or password.",
	PASSWORD_TOO_SHORT: `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`,
	PASSWORD_TOO_LONG: "That password is too long.",
};

/* Validation failures name their field inside the message rather than in the
   code, so the field is where the useful part is. */
const BY_FIELD: [pattern: RegExp, message: string][] = [
	[/body\.email/i, "Enter a valid email address."],
	[/body\.password/i, `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`],
	[/body\.name/i, "Enter your name."],
];

export function authErrorMessage(error: unknown): string {
	if (!(error instanceof APIError)) return GENERIC;

	const body = error.body as { code?: string; message?: string } | undefined;

	const known = body?.code ? BY_CODE[body.code] : undefined;
	if (known) return known;

	if (body?.message) {
		const field = BY_FIELD.find(([pattern]) => pattern.test(body.message ?? ""));
		if (field) return field[1];
	}

	return GENERIC;
}

/* Our own check, before the library's.

   Better Auth is the backstop, not the first line: it accepts an empty name,
   and its validation failures arrive worded for a developer. Checking here
   means the obvious mistakes get a sentence written for the person making them,
   and nothing malformed reaches the database at all. */
export function signUpProblem(fields: {
	name: string;
	email: string;
	password: string;
}): string | null {
	if (!fields.name) return "Enter your name.";
	if (!fields.email) return "Enter your email address.";
	// Deliberately loose: the only authority on an address is sending mail to it,
	// and a stricter pattern rejects real addresses more often than fake ones.
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email)) {
		return "Enter a valid email address.";
	}
	if (fields.password.length < MIN_PASSWORD_LENGTH) {
		return `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
	}

	return null;
}

/* Sign in checks less than sign up, on purpose. Anything beyond "you left a box
   empty" is the library's call, and its answer is deliberately the same whether
   the password was wrong or the account does not exist. */
export function signInProblem(fields: {
	email: string;
	password: string;
}): string | null {
	if (!fields.email) return "Enter your email address.";
	if (!fields.password) return "Enter your password.";

	return null;
}
