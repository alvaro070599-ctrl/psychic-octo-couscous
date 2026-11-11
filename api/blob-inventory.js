import { list } from '@vercel/blob';
const authorized = (req) => !!process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
  if (!authorized(req)) return res.status(401).json({ erro: 'Não autorizado.' });
  try {
    const { blobs, cursor, hasMore } = await list({ limit: 1000, cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined });
    const images = blobs.filter((b) => /\.(jpe?g|png|webp|gif|avif)$/i.test(b.pathname) || /^image\//i.test(b.contentType || ''));
    const groups = new Map();
    for (const image of images) if (image.etag) groups.set(image.etag, [...(groups.get(image.etag) || []), image.pathname]);
    const duplicates = [...groups.entries()].filter(([, paths]) => paths.length > 1).map(([etag, paths]) => ({ etag, paths }));
    return res.status(200).json({ images, count: images.length, duplicates, hasMore, cursor: cursor || null });
  } catch (error) {
    console.error('[api/blob-inventory]', error?.message || error);
    return res.status(503).json({ erro: 'Não foi possível listar o Blob. Confirme a conexão BLOB_READ_WRITE_TOKEN.' });
  }
}
