import { createClient } from 'redis';

let client;
async function db() {
  if (!client) {
    const novo = createClient({ url: process.env.REDIS_URL });
    novo.on('error', () => {});
    try {
      await novo.connect();
    } catch (e) {
      throw new Error('Falha ao conectar no Redis: ' + e.message);
    }
    client = novo;
  }
  return client;
}

const KEY = process.env.LOJA_ID ? 'config-loja-' + process.env.LOJA_ID : 'config-loja';
const autorizado = (req) =>
  !!process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;

function limparTelefone(v) {
  return String(v || '').replace(/\D/g, '');
}

export default async function handler(req, res) {
  try {
    const r = await db();

    if (req.method === 'GET') {
      const v = await r.get(KEY);
      const cfg = v ? JSON.parse(v) : { whatsapp: '', nomeLoja: 'Botoleto' };
      return res.status(200).json(cfg);
    }

    if (!autorizado(req)) return res.status(401).json({ erro: 'Senha incorreta' });

    if (req.method === 'POST') {
      const { whatsapp, nomeLoja } = req.body || {};
      const numero = limparTelefone(whatsapp);
      if (!numero || numero.length < 10)
        return res.status(400).json({ erro: 'Informe um número de WhatsApp válido, com DDD.' });
      const cfg = { whatsapp: numero, nomeLoja: String(nomeLoja || 'Botoleto').slice(0, 60) };
      await r.set(KEY, JSON.stringify(cfg));
      return res.status(200).json(cfg);
    }

    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ erro: 'Erro no servidor: ' + e.message });
  }
}
