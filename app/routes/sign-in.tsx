import { data, Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/sign-in";
import { Field } from "~/components/invoice/Field";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { cloudflareContext } from "~/context";
import { authErrorMessage, signInProblem } from "~/lib/auth-errors.server";
import { createAuth, getUser, redirectDestination } from "~/lib/auth.server";

/* Signing back in. Same shape as sign up, and the same reason for posting here
   rather than to /api/auth from the browser. */

export function meta() {
	return [{ title: "Sign in - Invoice Kit" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { env } = context.get(cloudflareContext);

	// Nobody needs a sign in form when they are already signed in.
	if (await getUser(request, env)) {
		throw redirect(redirectDestination(request));
	}

	return null;
}

export async function action({ request, context }: Route.ActionArgs) {
	const form = await request.formData();
	const email = String(form.get("email") ?? "").trim();
	const password = String(form.get("password") ?? "");

	const problem = signInProblem({ email, password });
	if (problem) {
		return data({ error: problem, values: { email } }, { status: 400 });
	}

	const { env } = context.get(cloudflareContext);

	try {
		const { headers } = await createAuth(env).api.signInEmail({
			returnHeaders: true,
			body: { email, password },
		});

		// The session rides on the redirect, exactly as it does on sign up.
		const outgoing = new Headers();
		for (const cookie of headers.getSetCookie()) {
			outgoing.append("set-cookie", cookie);
		}

		return redirect(redirectDestination(request), { headers: outgoing });
	} catch (error) {
		return data({ error: authErrorMessage(error), values: { email } }, { status: 400 });
	}
}

export default function SignIn({ actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";

	return (
		<main className="mx-auto grid min-h-screen max-w-md items-start p-6 sm:pt-24">
			<Card>
				<CardHeader>
					<CardTitle>Sign in</CardTitle>
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

						<Field id="password" label="Password">
							<Input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
							/>
						</Field>

						<Button type="submit" disabled={submitting} aria-busy={submitting}>
							{submitting ? "Signing in..." : "Sign in"}
						</Button>
					</Form>

					<p className="mt-4 text-sm text-muted-foreground">
						No account yet?{" "}
						<Link to="/sign-up" className="text-primary underline">
							Create one
						</Link>
					</p>
				</CardContent>
			</Card>
		</main>
	);
}
