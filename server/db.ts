import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../shared/schema.js";

export function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  return drizzle(neon(connectionString), { schema });
}

export type Db = NonNullable<ReturnType<typeof createDb>>;
