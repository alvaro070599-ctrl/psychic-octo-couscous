import { put } from '@vercel/blob';
import { getDb, listProducts } from '../lib/db.js';

const CATS = ['Feminino', 'Masculino', 'Unissex'];
const authorized = (req) => !!process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
const errorResponse = (res, error) => {
  console.error('[api/products]', error?.message || error);
  const missingDb = /DATABASE_URL/.test(error?.message || '');
  return res.status(missingDb ? 503 : 500).json({ erro: missingDb ? 'Banco persistente ainda não conectado. Configure DATABASE_URL na Vercel.' : 'Não foi possível processar os produtos.' });
};

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) { res.setHeader('Allow', 'GET, POST, DELETE'); return res.status(405).json({ erro: 'Método não permitido.' }); }
  if (req.method !== 'GET' && !authorized(req)) return res.status(401).json({ erro: 'Senha incorreta ou não autorizada.' });
  if (req.method === 'GET' && req.query.auth && !authorized(req)) return res.status(401).json({ erro: 'Senha incorreta.' });
  try {
    const db = getDb();
    if (req.method === 'GET') return res.status(200).json(await listProducts());
    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      if (!id) return res.status(400).json({ erro: 'Informe o ID do produto.' });
      const rows = await db`UPDATE products SET deleted_at = now(), updated_at = now() WHERE id = ${id} AND deleted_at IS NULL RETURNING id`;
      return rows.length ? res.status(200).json({ ok: true }) : res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    const { id, nome, cat, notas, preco, imagem, marca, fabricante, volume_ml, tipo, codigo_barras, estoque, review_status } = req.body || {};
    const valor = Number(preco);
    if (!String(nome || '').trim() || !CATS.includes(cat) || !Number.isFinite(valor) || valor < 0) return res.status(400).json({ erro: 'Preencha nome, categoria e preço válido (use 0 se ainda não definido).' });
    let foto = '';
    if (imagem && /^data:image\/(jpeg|png|webp);base64,/.test(imagem)) {
      const [, format, base64] = imagem.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/) || [];
      if (!base64) return res.status(400).json({ erro: 'Imagem inválida.' });
      const blob = await put(`perfumes/${Date.now()}-${Math.random().toString(36).slice(2)}.${format}`, Buffer.from(base64, 'base64'), { access: 'public', contentType: `image/${format}` });
      foto = blob.url;
    }
    const productId = id == null ? String(Date.now()) : String(id);
    const rows = await db`INSERT INTO products (id,nome,cat,notas,preco,foto,marca,fabricante,volume_ml,tipo,codigo_barras,estoque,review_status,deleted_at,updated_at)
      VALUES (${productId},${String(nome).trim().slice(0,120)},${cat},${String(notas||'').slice(0,1000)},${Math.round(valor*100)/100},${foto},${marca||null},${fabricante||null},${volume_ml ? Number(volume_ml) : null},${tipo||null},${codigo_barras||null},${estoque === '' || estoque == null ? null : Number(estoque)},${['draft','review','published'].includes(review_status) ? review_status : 'published'},NULL,now())
      ON CONFLICT (id) DO UPDATE SET nome=excluded.nome,cat=excluded.cat,notas=excluded.notas,preco=excluded.preco,foto=CASE WHEN excluded.foto='' THEN products.foto ELSE excluded.foto END,marca=excluded.marca,fabricante=excluded.fabricante,volume_ml=excluded.volume_ml,tipo=excluded.tipo,codigo_barras=excluded.codigo_barras,estoque=excluded.estoque,review_status=excluded.review_status,deleted_at=NULL,updated_at=now()
      RETURNING id,nome,cat,notas,preco,foto,marca,fabricante,volume_ml,tipo,codigo_barras,estoque,review_status`;
    if (foto) await db`INSERT INTO product_images (product_id,blob_url,pathname) VALUES (${productId},${foto},${blob.pathname}) ON CONFLICT (blob_url) DO NOTHING`;
    return res.status(200).json({ ...rows[0], preco: Number(rows[0].preco) });
  } catch (error) { return errorResponse(res, error); }
}
