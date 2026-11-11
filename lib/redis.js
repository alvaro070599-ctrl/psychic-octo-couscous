import { createClient } from 'redis';

let clientPromise;

export async function getRedis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL não está configurada na Vercel.');

  if (!clientPromise) {
    const client = createClient({
      url,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 8000,
        reconnectStrategy(retries) {
          if (retries >= 3) return new Error('Redis indisponível após 3 tentativas.');
          return Math.min((retries + 1) * 250, 1000);
        },
      },
    });

    client.on('error', (error) => {
      console.error('[redis] conexão:', error?.message || error);
    });

    clientPromise = client.connect()
      .then(() => client)
      .catch(async (error) => {
        clientPromise = undefined;
        try { if (client.isOpen) await client.disconnect(); } catch {}
        throw new Error('Não foi possível conectar ao Redis: ' + (error?.message || 'erro desconhecido'));
      });
  }

  return clientPromise;
}
