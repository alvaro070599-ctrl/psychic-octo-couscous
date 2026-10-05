import { Redis } from '@upstash/redis';
import { put, del } from '@vercel/blob';

const redis = Redis.fromEnv();
const KEY = 'produtos';
const CATS = ['Feminino', 'Masculino', 'Unissex'];
const autorizado = (req) =>
  !!process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;

export default async function handler(req, res) {
  try {
    let lista = (await redis.get(KEY)) || [];

    if (req.method === 'GET') {
      if (req.query.auth && !autorizado(req)) return res.status(401).json({ erro: 'Senha incorreta' });
      return res.status(200).json(lista);
    }

    if (!autorizado(req)) return res.status(401).json({ erro: 'Senha incorreta' });

    if (req.method === 'POST') {
      const { id, nome, cat, notas, preco, imagem } = req.body || {};
      const valor = Number(preco);
      if (!nome || !CATS.includes(cat) || !(valor > 0))
        return res.status(400).json({ erro: 'Preencha nome, categoria e preço' });

      const atual = id ? lista.find((p) => p.id === id) : null;
      let foto = atual?.foto || '';
      if (imagem && /^data:image\/jpeg;base64,/.test(imagem)) {
        const blob = await put(`perfumes/${Date.now()}.jpg`, Buffer.from(imagem.split(',')[1], 'base64'), {
          access: 'public',
          contentType: 'image/jpeg',
        });
        if (foto) await del(foto).catch(() => {});
        foto = blob.url;
      }
      const novo = {
        id: atual ? atual.id : Date.now(),
        nome: String(nome).slice(0, 80),
        cat,
        notas: String(notas || '').slice(0, 300),
        preco: Math.round(valor * 100) / 100,
        foto,
      };
      lista = atual ? lista.map((p) => (p.id === atual.id ? novo : p)) : [...lista, novo];
      await redis.set(KEY, lista);
      return res.status(200).json(novo);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      const alvo = lista.find((p) => p.id === id);
      if (alvo?.foto) await del(alvo.foto).catch(() => {});
      await redis.set(KEY, lista.filter((p) => p.id !== id));
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ erro: 'Erro no servidor: ' + e.message });
  }
}
