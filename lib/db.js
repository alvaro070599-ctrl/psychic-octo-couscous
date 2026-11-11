import { neon } from '@neondatabase/serverless';

let sql;
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada. Conecte o banco Neon ao projeto Vercel.');
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}

export async function listProducts() {
  const db = getDb();
  const rows = await db`SELECT id, nome, cat, notas, preco, foto FROM products WHERE deleted_at IS NULL ORDER BY created_at, id`;
  return rows.map((p) => ({ ...p, preco: Number(p.preco) }));
}
