import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const connectionString =
  process.env["DATABASE_URL"] ?? "postgres://solo:solo@localhost:5432/solocompass";

const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
