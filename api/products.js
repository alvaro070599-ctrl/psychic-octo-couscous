import { put, del } from '@vercel/blob';
import { getRedis } from '../lib/redis.js';

async function lerLista() {
  const r = await getRedis();
  const v = await r.get('produtos');
  if (!v) return [];
  const lista = JSON.parse(v);
  if (!Array.isArray(lista)) throw new Error('O cadastro de produtos no Redis está em formato inválido.');
  return lista;
}

async function salvarLista(lista) {
  const r = await getRedis();
  await r.set('produtos', JSON.stringify(lista));
}

const CATS = ['Feminino', 'Masculino', 'Unissex'];
const autorizado = (req) =>
  !!process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }

  if (req.method !== 'GET' && !autorizado(req)) {
    return res.status(401).json({ erro: 'Senha incorreta ou não autorizada.' });
  }
  if (req.method === 'GET' && req.query.auth && !autorizado(req)) {
    return res.status(401).json({ erro: 'Senha incorreta.' });
  }

  try {
    const lista = await lerLista();

    if (req.method === 'GET') return res.status(200).json(lista);

    if (req.method === 'POST') {
      const { id, nome, cat, notas, preco, imagem } = req.body || {};
      const valor = Number(preco);
      if (!String(nome || '').trim() || !CATS.includes(cat) || !(valor > 0)) {
        return res.status(400).json({ erro: 'Preencha nome, categoria e preço válido.' });
      }

      const atual = id != null ? lista.find((p) => String(p.id) === String(id)) : null;
      let foto = atual?.foto || '';
      if (imagem && /^data:image\/jpeg;base64,/.test(imagem)) {
        const base64 = imagem.split(',')[1];
        const blob = await put(`perfumes/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`, Buffer.from(base64, 'base64'), {
          access: 'public',
          contentType: 'image/jpeg',
        });
        foto = blob.url;
        if (atual?.foto) await del(atual.foto).catch((error) => console.error('[blob] falha ao remover foto antiga:', error?.message));
      }

      const novo = {
        id: atual ? atual.id : Date.now(),
        nome: String(nome).trim().slice(0, 80),
        cat,
        notas: String(notas || '').slice(0, 300),
        preco: Math.round(valor * 100) / 100,
        foto,
      };
      const atualizada = atual
        ? lista.map((p) => (String(p.id) === String(atual.id) ? novo : p))
        : [...lista, novo];
      await salvarLista(atualizada);
      return res.status(200).json(novo);
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      if (!id) return res.status(400).json({ erro: 'Informe o ID do produto.' });
      const alvo = lista.find((p) => String(p.id) === id);
      if (!alvo) return res.status(404).json({ erro: 'Produto não encontrado.' });
      const atualizada = lista.filter((p) => String(p.id) !== id);
      await salvarLista(atualizada);
      if (alvo.foto) await del(alvo.foto).catch((error) => console.error('[blob] falha ao remover foto:', error?.message));
      return res.status(200).json({ ok: true });
    }
  } catch (error) {
    console.error('[api/products]', error);
    const mensagem = error?.message || 'Falha inesperada.';
    const indisponivel = /redis|timeout|connect|socket/i.test(mensagem);
    return res.status(indisponivel ? 503 : 500).json({
      erro: indisponivel
        ? 'O banco de dados está temporariamente indisponível. Tente novamente em instantes.'
        : 'Não foi possível processar os produtos.',
      detalhe: mensagem,
    });
  }
}
