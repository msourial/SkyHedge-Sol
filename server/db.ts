import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../shared/schema";

const connectionString = process.env.DATABASE_URL;

export function createDb() {
  if (!connectionString) throw new Error("DATABASE_URL is required for persistence");
  return drizzle(neon(connectionString), { schema });
}

export type Db = ReturnType<typeof createDb>;