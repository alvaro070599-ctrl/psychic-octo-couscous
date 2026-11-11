import { getRedis } from '../lib/redis.js';

const KEY = process.env.LOJA_ID ? 'config-loja-' + process.env.LOJA_ID : 'config-loja';
const autorizado = (req) =>
  !!process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;

function limparTelefone(v) {
  return String(v || '').replace(/\D/g, '');
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }
  if (req.method === 'POST' && !autorizado(req)) {
    return res.status(401).json({ erro: 'Senha incorreta ou não autorizada.' });
  }

  try {
    const redis = await getRedis();

    if (req.method === 'GET') {
      const value = await redis.get(KEY);
      const config = value ? JSON.parse(value) : { whatsapp: '', nomeLoja: 'Botoleto' };
      return res.status(200).json(config);
    }

    const { whatsapp, nomeLoja } = req.body || {};
    const numero = limparTelefone(whatsapp);
    if (!numero || numero.length < 10) {
      return res.status(400).json({ erro: 'Informe um número de WhatsApp válido, com DDD.' });
    }
    const config = { whatsapp: numero, nomeLoja: String(nomeLoja || 'Botoleto').slice(0, 60) };
    await redis.set(KEY, JSON.stringify(config));
    return res.status(200).json(config);
  } catch (error) {
    console.error('[api/settings]', error);
    const mensagem = error?.message || 'Falha inesperada.';
    const indisponivel = /redis|timeout|connect|socket/i.test(mensagem);
    return res.status(indisponivel ? 503 : 500).json({
      erro: indisponivel
        ? 'O banco de dados está temporariamente indisponível. Tente novamente em instantes.'
        : 'Não foi possível carregar ou salvar as configurações.',
      detalhe: mensagem,
    });
  }
}
