import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

let client: Sql | undefined;

export function getDb(): Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  client = postgres(url);
  return client;
}

export type Db = Sql;
