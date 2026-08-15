import { data, Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/sign-up";
import { Field } from "~/components/invoice/Field";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { cloudflareContext } from "~/context";
import { MIN_PASSWORD_LENGTH } from "~/lib/auth-constants";
import { authErrorMessage, signUpProblem } from "~/lib/auth-errors.server";
import { createAuth, getUser, redirectDestination } from "~/lib/auth.server";

/* Creating an account. The form posts here rather than to /api/auth from the
   browser: the validation and the refusal both belong on the server, and a
   server side call is a function call rather than a request carrying an Origin,
   so this cannot break because a dev server moved ports. */

export function meta() {
	return [{ title: "Create an account - Invoice Kit" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { env } = context.get(cloudflareContext);

	// Nobody needs a sign up form when they already have an account open.
	if (await getUser(request, env)) {
		throw redirect(redirectDestination(request));
	}

	return null;
}

export async function action({ request, context }: Route.ActionArgs) {
	const form = await request.formData();
	const name = String(form.get("name") ?? "").trim();
	const email = String(form.get("email") ?? "").trim();
	const password = String(form.get("password") ?? "");

	const problem = signUpProblem({ name, email, password });
	if (problem) {
		return data({ error: problem, values: { name, email } }, { status: 400 });
	}

	const { env } = context.get(cloudflareContext);

	try {
		const { headers } = await createAuth(env).api.signUpEmail({
			returnHeaders: true,
			body: { name, email, password },
		});

		/* The session lives in the cookies Better Auth just set, so they have to
		   travel on the redirect. Without this the account exists, the redirect
		   works, and the user arrives signed out with no idea why. getSetCookie
		   returns a list, and every entry matters. */
		const outgoing = new Headers();
		for (const cookie of headers.getSetCookie()) {
			outgoing.append("set-cookie", cookie);
		}

		return redirect(redirectDestination(request), { headers: outgoing });
	} catch (error) {
		/* What the user typed comes back with the message, so a short password
		   does not also cost them their name and email. The password itself is
		   never echoed. */
		return data(
			{ error: authErrorMessage(error), values: { name, email } },
			{ status: 400 },
		);
	}
}

export default function SignUp({ actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";

	return (
		<main className="mx-auto grid min-h-screen max-w-md items-start p-6 sm:pt-24">
			<Card>
				<CardHeader>
					<CardTitle>Create an account</CardTitle>
				</CardHeader>
				<CardContent>
					<Form method="post" className="flex flex-col gap-4" replace>
						{actionData?.error ? (
							<p
								role="alert"
								className="rounded-lg bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue-fg"
							>
								{actionData.error}
							</p>
						) : null}

						<Field id="name" label="Name">
							<Input
								id="name"
								name="name"
								autoComplete="name"
								required
								defaultValue={actionData?.values.name}
							/>
						</Field>

						<Field id="email" label="Email">
							<Input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								defaultValue={actionData?.values.email}
							/>
						</Field>

						{/* The minimum is in the label, not only in the error: a rule you
						    meet by failing first is a bad rule. */}
						<Field
							id="password"
							label={`Password (at least ${MIN_PASSWORD_LENGTH} characters)`}
						>
							<Input
								id="password"
								name="password"
								type="password"
								autoComplete="new-password"
								minLength={MIN_PASSWORD_LENGTH}
								required
							/>
						</Field>

						<Button type="submit" disabled={submitting} aria-busy={submitting}>
							{submitting ? "Creating account..." : "Create account"}
						</Button>
					</Form>

					<p className="mt-4 text-sm text-muted-foreground">
						Already have an account?{" "}
						<Link to="/sign-in" className="text-primary underline">
							Sign in
						</Link>
					</p>
				</CardContent>
			</Card>
		</main>
	);
}
