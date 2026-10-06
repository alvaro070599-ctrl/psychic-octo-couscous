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
async function lerLista() {
  const r = await db();
  const v = await r.get('produtos');
  return v ? JSON.parse(v) : [];
}
async function salvarLista(lista) {
  const r = await db();
  await r.set('produtos', JSON.stringify(lista));
}

const FRETE_GRATIS = 299;
const FRETE = 24.9;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { itens, cupom, cliente } = req.body || {};
    const lista = await lerLista();
    const desconto = cupom === 'BOTO10' ? 0.9 : 1;
    const items = [];
    let base = 0;
    for (const i of Array.isArray(itens) ? itens : []) {
      const p = lista.find((x) => x.id === i.id);
      const q = Math.min(Math.max(parseInt(i.qtd) || 0, 0), 20);
      if (!p || !q) continue;
      const unit = Math.round(p.preco * desconto * 100) / 100;
      base += unit * q;
      items.push({ id: String(p.id), title: p.nome, quantity: q, unit_price: unit, currency_id: 'BRL' });
    }
    if (!items.length) return res.status(400).json({ erro: 'Carrinho vazio' });

    const frete = base >= FRETE_GRATIS ? 0 : FRETE;
    const origem = `https://${req.headers.host}`;
    const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items,
        payer: { name: cliente?.nome, email: cliente?.email },
        shipments: { cost: frete, mode: 'not_specified' },
        metadata: { entrega: cliente },
        back_urls: {
          success: `${origem}/?pagamento=ok`,
          pending: `${origem}/?pagamento=pendente`,
          failure: `${origem}/?pagamento=erro`,
        },
        auto_return: 'approved',
        statement_descriptor: 'BOTOLETO',
      }),
    });
    const d = await resp.json();
    if (!resp.ok) return res.status(502).json({ erro: d.message || 'Erro no Mercado Pago' });
    const teste = String(process.env.MP_ACCESS_TOKEN).startsWith('TEST-');
    return res.status(200).json({ url: teste ? d.sandbox_init_point : d.init_point });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
