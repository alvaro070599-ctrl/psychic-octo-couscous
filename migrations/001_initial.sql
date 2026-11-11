CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  nome text NOT NULL,
  cat text NOT NULL CHECK (cat IN ('Feminino', 'Masculino', 'Unissex')),
  notas text NOT NULL DEFAULT '',
  preco numeric(12,2) NOT NULL CHECK (preco >= 0),
  foto text NOT NULL DEFAULT '',
  marca text,
  fabricante text,
  volume_ml integer CHECK (volume_ml IS NULL OR volume_ml > 0),
  tipo text,
  codigo_barras text,
  estoque integer CHECK (estoque IS NULL OR estoque >= 0),
  review_status text NOT NULL DEFAULT 'published' CHECK (review_status IN ('draft','review','published')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_catalog_idx ON products (review_status, created_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS store_settings (
  loja_id text PRIMARY KEY,
  whatsapp text NOT NULL DEFAULT '',
  nome_loja text NOT NULL DEFAULT 'Botoleto',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only record of every image uploaded through the admin. Originals are never deleted by product edits.
CREATE TABLE IF NOT EXISTS product_images (
  id bigserial PRIMARY KEY,
  product_id text,
  blob_url text NOT NULL UNIQUE,
  pathname text,
  source text NOT NULL DEFAULT 'admin-upload',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_backups (
  id bigserial PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION save_recovery_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot jsonb;
BEGIN
  SELECT jsonb_build_object(
    'products', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at,p.id) FROM products p WHERE p.deleted_at IS NULL), '[]'::jsonb),
    'settings', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.loja_id) FROM store_settings s), '[]'::jsonb)
  ) INTO snapshot;
  INSERT INTO recovery_backups(payload) VALUES (snapshot);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS products_backup_after_change ON products;
CREATE TRIGGER products_backup_after_change AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION save_recovery_snapshot();
DROP TRIGGER IF EXISTS settings_backup_after_change ON store_settings;
CREATE TRIGGER settings_backup_after_change AFTER INSERT OR UPDATE OR DELETE ON store_settings FOR EACH ROW EXECUTE FUNCTION save_recovery_snapshot();
