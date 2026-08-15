import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";

/* CLI ONLY. Nothing in the app imports this file.

   `@better-auth/cli generate` has to load an auth instance outside a Worker to
   work out what schema to emit, and the real one takes a D1 binding that only
   exists inside a request. So this hands it Node's built in SQLite instead: same
   family, same emitted DDL, and D1 accepts it. The database is in memory and is
   thrown away the moment the command exits.

   Keep the options that affect the schema in step with `app/lib/auth.server.ts`,
   which is the file the app actually runs. Anything that only affects behaviour,
   like the base URL, is irrelevant here. */
export const auth = betterAuth({
	database: new DatabaseSync(":memory:"),
	emailAndPassword: { enabled: true },
	// Storing rate limits in the database is what adds a table, so it belongs here.
	rateLimit: { enabled: true, storage: "database" },
});
