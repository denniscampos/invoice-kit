import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH } from "./auth-constants";
import {
	authErrorMessage,
	signInProblem,
	signUpProblem,
} from "./auth-errors.server";

/* The shapes below were taken from the running endpoint rather than invented,
   so a library change that alters them should break these tests. */
const apiError = (status: number, body: { code?: string; message?: string }) =>
	new APIError(status as never, body);

describe("authErrorMessage", () => {
	it("explains a duplicate email and points at signing in", () => {
		const message = authErrorMessage(
			apiError(422, {
				code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
				message: "User already exists. Use another email.",
			}),
		);

		expect(message).toContain("already exists");
		expect(message).toContain("signing in");
	});

	/* Both refusals have to read identically, or the form becomes a way to find
	   out which addresses have accounts. */
	it("says the same thing for a wrong password and an unknown email", () => {
		const wrongPassword = authErrorMessage(
			apiError(401, {
				code: "INVALID_EMAIL_OR_PASSWORD",
				message: "Invalid email or password",
			}),
		);
		const unknownEmail = authErrorMessage(
			apiError(401, {
				code: "INVALID_EMAIL_OR_PASSWORD",
				message: "Invalid email or password",
			}),
		);

		expect(wrongPassword).toBe(unknownEmail);
		expect(wrongPassword).toBe("Invalid email or password.");
	});

	it("names the minimum when the password is too short", () => {
		const message = authErrorMessage(
			apiError(400, { code: "PASSWORD_TOO_SHORT", message: "Password too short" }),
		);

		expect(message).toContain(String(MIN_PASSWORD_LENGTH));
		// The library's own sentence never says how short is too short.
		expect(message).not.toBe("Password too short");
	});

	/* Validation errors arrive as "[body.email] Invalid input", which is a
	   sentence for a developer, not for the person filling in the form. */
	it.each([
		["email", "[body.email] Invalid input", "Enter a valid email address."],
		["name", "[body.name] Invalid input", "Enter your name."],
	])("turns a %s validation failure into plain words", (_field, raw, expected) => {
		const message = authErrorMessage(
			apiError(400, { code: "VALIDATION_ERROR", message: raw }),
		);

		expect(message).toBe(expected);
		expect(message).not.toContain("body.");
	});

	it.each([
		["an unrecognized code", apiError(400, { code: "SOMETHING_NEW", message: "" })],
		["no body at all", apiError(500, {})],
		["a plain error", new Error("D1_ERROR: no such table: user")],
		["a string", "boom"],
		["null", null],
		["undefined", undefined],
	])("falls back to a generic sentence for %s", (_label, error) => {
		expect(authErrorMessage(error)).toBe("Something went wrong. Please try again.");
	});

	/* The fallback is what keeps an internal failure from becoming user facing
	   text: a database error must not arrive on the sign up form. */
	it("never leaks the text of an unexpected error", () => {
		const message = authErrorMessage(new Error("D1_ERROR: no such table: user"));

		expect(message).not.toContain("D1");
		expect(message).not.toContain("table");
	});
});

describe("signUpProblem", () => {
	const valid = {
		name: "Dennis",
		email: "dennis@example.test",
		password: "a-long-enough-password",
	};

	it("passes a complete sign up", () => {
		expect(signUpProblem(valid)).toBeNull();
	});

	/* The gap this function exists to close: Better Auth accepts an empty name
	   and creates the account, which was reproduced against the running app
	   before this check was added. */
	it("refuses an empty name", () => {
		expect(signUpProblem({ ...valid, name: "" })).toBe("Enter your name.");
	});

	it("refuses an empty email", () => {
		expect(signUpProblem({ ...valid, email: "" })).toBe(
			"Enter your email address.",
		);
	});

	it.each([
		"not-an-email",
		"missing@domain",
		"@example.test",
		"spaces in@example.test",
		"two@@example.test",
	])("refuses %o as an address", (email) => {
		expect(signUpProblem({ ...valid, email })).toBe(
			"Enter a valid email address.",
		);
	});

	/* Loose on purpose. These are real shapes that a stricter pattern rejects. */
	it.each([
		"first.last@example.co.uk",
		"user+invoice@example.test",
		"user_name@sub.example.test",
		"o'brien@example.test",
	])("accepts %o", (email) => {
		expect(signUpProblem({ ...valid, email })).toBeNull();
	});

	it("refuses a password below the minimum and says the number", () => {
		const message = signUpProblem({ ...valid, password: "a".repeat(MIN_PASSWORD_LENGTH - 1) });

		expect(message).toContain(String(MIN_PASSWORD_LENGTH));
	});

	it("accepts a password of exactly the minimum", () => {
		expect(
			signUpProblem({ ...valid, password: "a".repeat(MIN_PASSWORD_LENGTH) }),
		).toBeNull();
	});

	/* Name first, so a form with several problems names the one nearest the top
	   rather than whichever the code happened to check first. */
	it("reports the first problem in field order", () => {
		expect(signUpProblem({ name: "", email: "bad", password: "x" })).toBe(
			"Enter your name.",
		);
	});
});

describe("signInProblem", () => {
	it("passes a filled in form", () => {
		expect(
			signInProblem({ email: "dennis@example.test", password: "anything" }),
		).toBeNull();
	});

	it.each([
		["an empty email", { email: "", password: "anything" }, "Enter your email address."],
		["an empty password", { email: "dennis@example.test", password: "" }, "Enter your password."],
	])("refuses %s", (_label, fields, expected) => {
		expect(signInProblem(fields)).toBe(expected);
	});

	/* Sign in does not check the address shape. A malformed address is simply an
	   address with no account, and saying so differently would tell a stranger
	   which addresses are registered. */
	it("does not judge the shape of the address", () => {
		expect(signInProblem({ email: "not-an-email", password: "anything" })).toBeNull();
	});
});
