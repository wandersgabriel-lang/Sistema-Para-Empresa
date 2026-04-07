# Enterprise WG's (Sistema para Empresa)

Sistema gerencial com controle de estoque, registro de vendas, cadastro de produtos e gerenciamento de usuários.

## Stack atual

- Frontend: HTML, CSS e JavaScript
- Backend: Node.js nativo (`http`)
- Banco de dados: SQLite real via `node:sqlite`
- Sessão: cookie `HttpOnly` com sessão persistida em banco

## Como rodar localmente

1. Abra o terminal na pasta `Sistema Para empresa`
2. Execute:

```bash
node server.js
```

3. Acesse:

```text
http://127.0.0.1:3210
```

Ou, se preferir:

```bash
npm start
```

## Credenciais iniciais

- Gerente
  - Matrícula: `0001`
  - Senha: `123`
- Vendedor
  - Matrícula: `1001`
  - Senha: `123`

## O que já usa banco real

- Login
- Sessão autenticada por cookie `HttpOnly`
- Cadastro de usuário
- Aprovação e reprovação de usuários
- Cadastro de produtos
- Edição e remoção de produtos
- Registro de vendas
- Histórico de vendas
- Estoque

## Observações

- O banco SQLite é criado automaticamente em `data/enterprise.sqlite`
- O frontend mantém uma cópia leve do usuário em `sessionStorage` só para a interface, mas a autorização real agora acontece no backend
- Rotas de gerente e vendedor já têm restrição no servidor
- O próximo passo natural é substituir a lógica inline de renderização por módulos menores

## Deploy com Docker

1. Gere uma chave segura para sessão
2. Suba a imagem com as variáveis de ambiente

Build:

```bash
docker build -t sistema-empresa .
```

Run:

```bash
docker run -d ^
  -p 3210:3210 ^
  -e NODE_ENV=production ^
  -e HOST=0.0.0.0 ^
  -e PORT=3210 ^
  -e SESSION_SECRET=sua-chave-bem-segura ^
  -v sistema_empresa_data:/app/data ^
  --name sistema-empresa ^
  sistema-empresa
```

Arquivos de apoio:

- `Dockerfile`
- `.dockerignore`
- `.env.example`

## Regras atuais de permissão

- `gerente` pode cadastrar, editar e remover produtos
- `gerente` pode gerenciar usuários
- `gerente` pode resetar o banco
- `vendedor` pode registrar vendas
- `vendedor` não pode criar, editar ou remover produtos
- `vendedor` não pode acessar gerenciamento de usuários no backend
