# Gestor Fácil

Aplicação web de gestão para pequenos comércios e prestadores de serviços. A aplicação mantém o frontend React/Vite e o backend Express; a persistência foi adaptada para PostgreSQL hospedado no Supabase.

## Requisitos

- Node.js 22 ou superior
- Projeto Supabase
- Connection string PostgreSQL do Supabase (preferencialmente Transaction Pooler)

## Configurar o Supabase

1. Crie um projeto no Supabase.
2. Abra **Project Settings → Database → Connection string**.
3. Selecione **Transaction pooler** e copie a URL PostgreSQL.
4. Crie um arquivo `.env` na raiz do projeto usando `.env.example` como modelo.
5. Preencha `DATABASE_URL`, `PLATFORM_ADMIN_EMAIL` e `PLATFORM_ADMIN_PASSWORD`. A senha do administrador deve ter pelo menos 16 caracteres.
6. Não coloque a connection string em variáveis `VITE_*`, no frontend, nem envie o arquivo `.env` ao Git.

Na primeira inicialização, o servidor cria as tabelas, índices, ativa Row Level Security e semeia somente os 10 módulos padrão. O usuário administrador é criado somente se o e-mail ainda não existir; a senha existente não é redefinida automaticamente. Depois que a conta inicial for criada com sucesso, você pode remover `PLATFORM_ADMIN_PASSWORD` do ambiente; mantenha `PLATFORM_ADMIN_EMAIL` para que o servidor confira a conta administrativa configurada.

O servidor usa uma conexão privilegiada do PostgreSQL no backend. As credenciais do banco nunca devem ser entregues ao navegador. As tabelas não concedem acesso direto aos papéis `anon` e `authenticated`; todas as operações da aplicação passam pelas rotas autenticadas do Express, que verificam empresa e módulos habilitados.

## Instalar e executar

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Entre com o e-mail e a senha definidos no `.env`. Cadastre a primeira empresa na área administrativa e, em seguida, habilite os módulos desejados para ela.

## Validar antes de publicar

```bash
npm run typecheck
npm run build
```

Faça testes com pelo menos duas empresas e confirme que uma conta de cliente não consegue consultar ou alterar dados da outra empresa, nem acessar módulos não liberados. Não use dados reais de clientes até concluir esses testes.

## Como os dados são armazenados nesta versão

Os cadastros de plataforma (empresas, usuários, sessões, módulos, vínculos de módulos e auditoria) ficam em tabelas PostgreSQL. O estado operacional atual de cada empresa continua agrupado em `company_business_state.state_json` (JSONB), para preservar as regras e telas existentes nesta primeira migração do SQLite. Isso permite testar a aplicação no Supabase sem reconstruir o frontend, mas não é o modelo relacional definitivo para um ERP em escala. A próxima evolução recomendada é normalizar clientes, produtos, estoque, vendas, compras e financeiro em tabelas próprias, com transações de negócio específicas.

## Autenticação

Esta versão mantém a autenticação de aplicação implementada no backend Express (senhas com scrypt e tokens de sessão com hash SHA-256 armazenado no banco). Ela utiliza o PostgreSQL do Supabase, mas ainda não está integrada ao Supabase Auth. Não exponha `DATABASE_URL` nem publique as rotas administrativas sem HTTPS em produção.
