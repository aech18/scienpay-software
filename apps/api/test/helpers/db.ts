import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://scienpay_app:scienpay_dev_password_change_me@localhost:55432/scienpay_test';

export function createSql() {
  return postgres(connectionString, { max: 5, connect_timeout: 15 });
}

export async function scalar<T = unknown>(
  sql: postgres.Sql,
  query: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await sql.unsafe(query, params as never[]);
  const first = rows[0] as Record<string, unknown> | undefined;
  return first ? (Object.values(first)[0] as T) : undefined;
}
