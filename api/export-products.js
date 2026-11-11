import { getDb, listProducts } from '../lib/db.js';
const authorized = (req) => !!process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  if (!authorized(req)) return res.status(401).json({ erro: 'Não autorizado.' });
  try {
    const products = await listProducts();
    const db = getDb();
    const settings = await db`SELECT loja_id,whatsapp,nome_loja,updated_at FROM store_settings`;
    const payload = { version: 1, exportedAt: new Date().toISOString(), products, settings };
    await db`INSERT INTO recovery_backups (payload) VALUES (${JSON.stringify(payload)}::jsonb)`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="botoleto-backup.json"');
    return res.status(200).json(payload);
  } catch (error) { console.error('[api/export-products]', error?.message || error); return res.status(503).json({ erro: 'Exportação indisponível. Verifique a conexão com o banco.' }); }
}
