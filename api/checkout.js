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
      
      items.push({
        id: String(p.id),
        title: p.nome,
        quantity: q,
        unit_price: unit
      });
    }

    if (!items.length) return res.status(400).json({ erro: 'Carrinho vazio' });

    const totalFormatado = base.toFixed(2);
    
    return res.status(200).json({
      mensagem: "Pedido processado com sucesso.",
      itens: items,
      total: totalFormatado,
      cliente: cliente
    });

  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
}
