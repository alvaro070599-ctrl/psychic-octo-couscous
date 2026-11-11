import { listProducts } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).end(); }
  try {
    const { itens, cliente } = req.body || {};
    const lista = await listProducts();
    const items = [];
    let base = 0;
    for (const i of Array.isArray(itens) ? itens : []) {
      const p = lista.find((x) => String(x.id) === String(i.id));
      const q = Math.min(Math.max(parseInt(i.qtd,10) || 0, 0), 20);
      if (!p || !q) continue;
      const unit = Math.round(Number(p.preco) * 100) / 100;
      base += unit * q;
      items.push({ id:String(p.id), title:p.nome, quantity:q, unit_price:unit });
    }
    if (!items.length) return res.status(400).json({ erro:'Carrinho vazio' });
    return res.status(200).json({ sucesso:true, itens:items, total:base.toFixed(2), cliente:cliente || {} });
  } catch (error) {
    console.error('[api/checkout]', error?.message || error);
    return res.status(/DATABASE_URL/.test(error?.message || '') ? 503 : 500).json({ erro:'Não foi possível carregar os produtos para o carrinho.' });
  }
}
