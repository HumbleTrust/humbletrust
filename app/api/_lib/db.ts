import postgres from "postgres";

let sql: ReturnType<typeof postgres> | undefined;

const getSql = () => {
  if (!sql) {
    sql = postgres(process.env.DATABASE_URL!, {
      ssl: "require",
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return sql;
};

export const query = async (text: string, params?: unknown[]) => {
  const rows = await getSql().unsafe(text, (params ?? []) as never[]);
  return { rows: rows as unknown[] };
};
