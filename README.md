# Botoleto — recuperação

Esta cópia mantém a interface original e troca o Redis desinstalado por Neon PostgreSQL.

## Conectar o banco

1. Provisionar um banco Neon persistente e conectá-lo ao projeto Vercel por Marketplace.
2. Garantir que `DATABASE_URL` esteja disponível nas variáveis Preview e Production. Não coloque a URL no repositório.
3. Executar `migrations/001_initial.sql` no SQL Editor do Neon uma única vez.
4. Manter `ADMIN_PASSWORD`, `BLOB_READ_WRITE_TOKEN` e `LOJA_ID` nas variáveis Vercel. O projeto já tinha uma loja Blob associada.
5. Implantar primeiro como Preview protegido e verificar `/api/products`, `/api/settings` e `/api/blob-inventory`.

## Recuperação de dados e imagens

- `/api/blob-inventory` lista imagens em páginas de até 1000 objetos; exige `x-admin-password`. Compare os `etag` para ver duplicatas. A rota não altera nem apaga imagens.
- `/api/export-products` baixa um JSON autenticado e grava um snapshot no banco.
- A migração cria snapshots automáticos no banco depois de cada alteração em produtos/configurações. São histórico lógico no mesmo banco; para cópia independente, configure backups gerenciados do Neon/Vercel e guarde as exportações fora do banco.
- Os campos sem dados confiáveis (`marca`, `fabricante`, `volume_ml`, `tipo`, `codigo_barras`, `estoque`) ficam nulos; não inferir preços nem estoque.

## Limites conhecidos desta etapa

O catálogo Redis antigo foi perdido e nenhum catálogo estava nos repositórios. A rota Blob torna possível recuperar inventário quando houver deploy Preview com a conexão Blob, mas ainda não foi executada contra o store real. Identificação por IA requer conectar uma credencial/modelo de visão; nenhuma estava configurada na auditoria. Até lá, nomes e atributos devem ser revisados por uma pessoa antes da publicação.
