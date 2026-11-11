import { getDb } from '../lib/db.js';
const authorized = (req) => !!process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
const lojaId = () => process.env.LOJA_ID || 'default';
function cleanPhone(v) { return String(v || '').replace(/\D/g, ''); }

export default async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) { res.setHeader('Allow','GET, POST'); return res.status(405).json({ erro:'Método não permitido.' }); }
  if (req.method === 'POST' && !authorized(req)) return res.status(401).json({ erro:'Senha incorreta ou não autorizada.' });
  try {
    const db = getDb();
    if (req.method === 'GET') {
      const rows = await db`SELECT whatsapp,nome_loja FROM store_settings WHERE loja_id=${lojaId()}`;
      return res.status(200).json(rows[0] ? { whatsapp: rows[0].whatsapp, nomeLoja: rows[0].nome_loja } : { whatsapp:'', nomeLoja:'Botoleto' });
    }
    const numero = cleanPhone(req.body?.whatsapp);
    if (numero.length < 10) return res.status(400).json({ erro:'Informe um número de WhatsApp válido, com DDD.' });
    const nomeLoja = String(req.body?.nomeLoja || 'Botoleto').slice(0,60);
    await db`INSERT INTO store_settings (loja_id,whatsapp,nome_loja,updated_at) VALUES (${lojaId()},${numero},${nomeLoja},now()) ON CONFLICT (loja_id) DO UPDATE SET whatsapp=excluded.whatsapp,nome_loja=excluded.nome_loja,updated_at=now()`;
    return res.status(200).json({ whatsapp:numero, nomeLoja });
  } catch (error) {
    console.error('[api/settings]', error?.message || error);
    return res.status(/DATABASE_URL/.test(error?.message||'') ? 503 : 500).json({ erro:/DATABASE_URL/.test(error?.message||'') ? 'Banco persistente ainda não conectado.' : 'Não foi possível carregar ou salvar as configurações.' });
  }
}
