const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3210);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'enterprise.sqlite');
const SESSION_SECRET = process.env.SESSION_SECRET || 'enterprise-wg-session-secret';
const SESSION_COOKIE = 'enterprise_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    matricula: row.matricula,
    nome: row.nome,
    role: row.role,
    status: row.status
  };
}

function mapProduct(row) {
  return {
    id: row.id,
    nome: row.nome,
    categoria: row.categoria,
    quantidade: row.quantidade,
    valorLote: row.valor_lote,
    valorUnidadeCompra: row.valor_unidade_compra,
    valorVenda: row.valor_venda,
    lucroBrutoEstimado: row.lucro_bruto_estimado,
    createdAt: row.created_at
  };
}

function mapSale(row) {
  return {
    id: row.id,
    produtoId: row.produto_id,
    nomeProduto: row.nome_produto,
    quantidadeTrancionada: row.quantidade,
    vendedor: row.vendedor_nome,
    matricula: row.vendedor_matricula,
    descontoPercentual: row.desconto_percentual,
    descontoValor: row.desconto_valor,
    receitaBruta: row.receita_bruta,
    receitaLiquida: row.receita_liquida,
    custoAproximadoTotalVenda: row.custo_total,
    lucroEmpresa: row.lucro_empresa,
    comissaoVendedor: row.comissao_vendedor,
    createdAt: row.created_at
  };
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matricula TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('gerente', 'vendedor')),
      status TEXT NOT NULL DEFAULT 'aprovado' CHECK(status IN ('aprovado', 'pendente', 'reprovado')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      categoria TEXT NOT NULL,
      quantidade INTEGER NOT NULL,
      valor_lote REAL NOT NULL,
      valor_unidade_compra REAL NOT NULL,
      valor_venda REAL NOT NULL,
      lucro_bruto_estimado REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL,
      nome_produto TEXT NOT NULL,
      quantidade INTEGER NOT NULL,
      vendedor_nome TEXT NOT NULL,
      vendedor_matricula TEXT NOT NULL,
      desconto_percentual REAL NOT NULL DEFAULT 0,
      desconto_valor REAL NOT NULL DEFAULT 0,
      receita_bruta REAL NOT NULL,
      receita_liquida REAL NOT NULL,
      custo_total REAL NOT NULL,
      lucro_empresa REAL NOT NULL,
      comissao_vendedor REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES products(id)
    );
  `);

  const count = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  if (count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (matricula, nome, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    [
      { matricula: '0001', nome: 'Gerente', senha: '123', role: 'gerente', status: 'aprovado' },
      { matricula: '1001', nome: 'Lucas - Vendedor', senha: '123', role: 'vendedor', status: 'aprovado' },
      { matricula: '1002', nome: 'Maria - Vendedora', senha: '123', role: 'vendedor', status: 'aprovado' }
    ].forEach((user) => {
      insertUser.run(user.matricula, user.nome, hashPassword(user.senha), user.role, user.status);
    });
  }
}

initializeDatabase();

function getFinanceiro() {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(valor_lote), 0) AS investimento,
      COALESCE(SUM(lucro_bruto_estimado), 0) AS lucro_estimado
    FROM products
  `).get();

  return {
    investimento: Number(row.investimento || 0),
    lucro: Number(row.lucro_estimado || 0),
    prejuizo: Number(row.lucro_estimado || 0) < 0 ? Math.abs(Number(row.lucro_estimado || 0)) : 0
  };
}

function createSignature(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function generateOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashSessionToken(token) {
  return createSignature(token);
}

function parseCookies(req) {
  const raw = req.headers.cookie;
  if (!raw) return {};

  return raw.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function getAuthenticatedUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const session = db.prepare(`
    SELECT s.id, s.user_id, s.expires_at, u.id AS db_user_id, u.matricula, u.nome, u.role, u.status
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(hashSessionToken(token));

  if (!session) return null;
  if (!session.expires_at || session.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    return null;
  }

  db.prepare('UPDATE sessions SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(session.id);

  if (session.status !== 'aprovado') return null;
  return mapUser({
    id: session.db_user_id,
    matricula: session.matricula,
    nome: session.nome,
    role: session.role,
    status: session.status
  });
}

function buildCookie(value, maxAgeSeconds) {
  const secureFlag = IS_PRODUCTION ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureFlag}`;
}

function setSessionCookie(res, user) {
  const token = generateOpaqueToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.prepare(`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `).run(user.id, hashSessionToken(token), expiresAt);
  res.setHeader('Set-Cookie', buildCookie(token, Math.floor(SESSION_TTL_MS / 1000)));
}

function clearSessionCookie(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token));
  }
  res.setHeader('Set-Cookie', buildCookie('', 0));
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, statusCode, payload, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(payload);
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload muito grande.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

function getStaticContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  return types[ext] || 'application/octet-stream';
}

function serveStaticFile(res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const requestedPath = path.normalize(path.join(ROOT_DIR, safePath));

  if (!requestedPath.startsWith(ROOT_DIR)) {
    sendText(res, 403, 'Acesso negado.');
    return;
  }

  if (!fs.existsSync(requestedPath) || fs.statSync(requestedPath).isDirectory()) {
    sendText(res, 404, 'Arquivo não encontrado.');
    return;
  }

  const content = fs.readFileSync(requestedPath);
  res.writeHead(200, {
    'Content-Type': getStaticContentType(requestedPath),
    'Content-Length': content.length
  });
  res.end(content);
}

function listUsers() {
  return db.prepare(`
    SELECT id, matricula, nome, role, status
    FROM users
    ORDER BY role DESC, nome ASC
  `).all().map(mapUser);
}

function listProducts() {
  return db.prepare(`
    SELECT id, nome, categoria, quantidade, valor_lote, valor_unidade_compra, valor_venda, lucro_bruto_estimado, created_at
    FROM products
    ORDER BY id DESC
  `).all().map(mapProduct);
}

function listSales() {
  return db.prepare(`
    SELECT id, produto_id, nome_produto, quantidade, vendedor_nome, vendedor_matricula,
           desconto_percentual, desconto_valor, receita_bruta, receita_liquida,
           custo_total, lucro_empresa, comissao_vendedor, created_at
    FROM sales
    ORDER BY id DESC
  `).all().map(mapSale);
}

async function handleApi(req, res, pathname) {
  const authenticatedUser = getAuthenticatedUser(req);
  const userDetailMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  const userStatusMatch = pathname.match(/^\/api\/users\/([^/]+)\/status$/);
  const productDetailMatch = pathname.match(/^\/api\/produtos\/([^/]+)$/);
  const requireAuth = () => {
    if (!authenticatedUser) {
      sendJson(res, 401, { error: 'Sua sessão expirou ou não é válida.' });
      return false;
    }
    return true;
  };
  const requireManager = () => {
    if (!requireAuth()) return false;
    if (authenticatedUser.role !== 'gerente') {
      sendJson(res, 403, { error: 'Esta ação é exclusiva para gerentes.' });
      return false;
    }
    return true;
  };

  if (req.method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/bootstrap') {
    if (!requireAuth()) return true;
    sendJson(res, 200, {
      produtos: listProducts(),
      logsVenda: authenticatedUser.role === 'gerente'
        ? listSales()
        : listSales().filter((sale) => sale.matricula === authenticatedUser.matricula),
      users: authenticatedUser.role === 'gerente' ? listUsers() : [],
      financeiro: getFinanceiro()
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const { matricula, senha } = await parseRequestBody(req);
    if (!matricula || !senha) {
      sendJson(res, 400, { error: 'Informe matrícula e senha.' });
      return true;
    }

    const user = db.prepare(`
      SELECT id, matricula, nome, role, status, password_hash
      FROM users
      WHERE matricula = ?
    `).get(String(matricula).trim());

    if (!user || !verifyPassword(String(senha), user.password_hash)) {
      sendJson(res, 401, { error: 'Matrícula ou senha inválidos.' });
      return true;
    }

    if (user.status === 'pendente') {
      sendJson(res, 403, { error: 'Seu cadastro ainda está pendente de aprovação pelo gerente.' });
      return true;
    }

    if (user.status === 'reprovado') {
      sendJson(res, 403, { error: 'Seu cadastro foi reprovado e não pode acessar o sistema.' });
      return true;
    }

    setSessionCookie(res, user);
    sendJson(res, 200, { user: mapUser(user) });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    clearSessionCookie(req, res);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    if (!requireAuth()) return true;
    sendJson(res, 200, { user: authenticatedUser });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const { nome, matricula, senha } = await parseRequestBody(req);
    if (!nome || !matricula || !senha) {
      sendJson(res, 400, { error: 'Preencha todos os campos.' });
      return true;
    }

    const existing = db.prepare('SELECT id FROM users WHERE matricula = ?').get(String(matricula).trim());
    if (existing) {
      sendJson(res, 409, { error: 'Matrícula já está em uso.' });
      return true;
    }

    db.prepare(`
      INSERT INTO users (matricula, nome, password_hash, role, status)
      VALUES (?, ?, ?, 'vendedor', 'pendente')
    `).run(String(matricula).trim(), String(nome).trim(), hashPassword(String(senha)));

    sendJson(res, 201, { message: 'Cadastro realizado com sucesso. Seu acesso está pendente de aprovação.' });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/users') {
    if (!requireManager()) return true;
    sendJson(res, 200, { users: listUsers() });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/users') {
    if (!requireManager()) return true;
    const { matricula, nome, senha, role, status } = await parseRequestBody(req);
    if (!matricula || !nome || !senha || !role) {
      sendJson(res, 400, { error: 'Preencha todos os campos obrigatórios.' });
      return true;
    }

    const existing = db.prepare('SELECT id FROM users WHERE matricula = ?').get(String(matricula).trim());
    if (existing) {
      sendJson(res, 409, { error: 'Matrícula já existe.' });
      return true;
    }

    db.prepare(`
      INSERT INTO users (matricula, nome, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      String(matricula).trim(),
      String(nome).trim(),
      hashPassword(String(senha)),
      role === 'gerente' ? 'gerente' : 'vendedor',
      status || 'aprovado'
    );

    sendJson(res, 201, { users: listUsers() });
    return true;
  }

  if (req.method === 'PUT' && userDetailMatch) {
    if (!requireManager()) return true;
    const matricula = decodeURIComponent(userDetailMatch[1]);
    const { nome, senha, role, status } = await parseRequestBody(req);
    const existing = db.prepare('SELECT id FROM users WHERE matricula = ?').get(matricula);

    if (!existing) {
      sendJson(res, 404, { error: 'Usuário não encontrado.' });
      return true;
    }

    if (!nome || !role) {
      sendJson(res, 400, { error: 'Nome e função são obrigatórios.' });
      return true;
    }

    if (senha) {
      db.prepare(`
        UPDATE users
        SET nome = ?, role = ?, status = ?, password_hash = ?
        WHERE matricula = ?
      `).run(String(nome).trim(), role, status || 'aprovado', hashPassword(String(senha)), matricula);
    } else {
      db.prepare(`
        UPDATE users
        SET nome = ?, role = ?, status = ?
        WHERE matricula = ?
      `).run(String(nome).trim(), role, status || 'aprovado', matricula);
    }

    sendJson(res, 200, { users: listUsers() });
    return true;
  }

  if (req.method === 'DELETE' && userDetailMatch) {
    if (!requireManager()) return true;
    const matricula = decodeURIComponent(userDetailMatch[1]);
    db.prepare('DELETE FROM users WHERE matricula = ?').run(matricula);
    sendJson(res, 200, { users: listUsers() });
    return true;
  }

  if (req.method === 'POST' && userStatusMatch) {
    if (!requireManager()) return true;
    const matricula = decodeURIComponent(userStatusMatch[1]);
    const { status } = await parseRequestBody(req);

    if (!['aprovado', 'pendente', 'reprovado'].includes(status)) {
      sendJson(res, 400, { error: 'Status inválido.' });
      return true;
    }

    db.prepare('UPDATE users SET status = ? WHERE matricula = ?').run(status, matricula);
    sendJson(res, 200, { users: listUsers() });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/produtos') {
    if (!requireAuth()) return true;
    sendJson(res, 200, { produtos: listProducts(), financeiro: getFinanceiro() });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/produtos') {
    if (!requireManager()) return true;
    const { nome, categoria, quantidade, valorLote, valorVenda } = await parseRequestBody(req);
    const qtd = Number(quantidade);
    const lote = Number(valorLote);
    const venda = Number(valorVenda);

    if (!nome || !categoria || !Number.isFinite(qtd) || !Number.isFinite(lote) || !Number.isFinite(venda)) {
      sendJson(res, 400, { error: 'Preencha todos os campos do produto.' });
      return true;
    }

    if (qtd <= 0 || lote <= 0 || venda <= 0) {
      sendJson(res, 400, { error: 'Os valores e quantidades devem ser maiores que zero.' });
      return true;
    }

    const valorUnidadeCompra = lote / qtd;
    const lucroBrutoEstimado = (venda * qtd) - lote;

    const result = db.prepare(`
      INSERT INTO products (nome, categoria, quantidade, valor_lote, valor_unidade_compra, valor_venda, lucro_bruto_estimado)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(String(nome).trim(), String(categoria).trim(), qtd, lote, valorUnidadeCompra, venda, lucroBrutoEstimado);

    const produto = db.prepare(`
      SELECT id, nome, categoria, quantidade, valor_lote, valor_unidade_compra, valor_venda, lucro_bruto_estimado, created_at
      FROM products
      WHERE id = ?
    `).get(result.lastInsertRowid);

    sendJson(res, 201, {
      produto: mapProduct(produto),
      produtos: listProducts(),
      financeiro: getFinanceiro()
    });
    return true;
  }

  if (req.method === 'PUT' && productDetailMatch) {
    if (!requireManager()) return true;
    const productId = Number(decodeURIComponent(productDetailMatch[1]));
    const { nome, categoria, quantidade, valorLote, valorVenda } = await parseRequestBody(req);
    const qtd = Number(quantidade);
    const lote = Number(valorLote);
    const venda = Number(valorVenda);

    const existingProduct = db.prepare(`
      SELECT id
      FROM products
      WHERE id = ?
    `).get(productId);

    if (!existingProduct) {
      sendJson(res, 404, { error: 'Produto não encontrado.' });
      return true;
    }

    if (!nome || !categoria || !Number.isFinite(qtd) || !Number.isFinite(lote) || !Number.isFinite(venda)) {
      sendJson(res, 400, { error: 'Preencha todos os campos do produto.' });
      return true;
    }

    if (qtd < 0 || lote <= 0 || venda <= 0) {
      sendJson(res, 400, { error: 'Quantidade deve ser 0 ou maior, e os valores devem ser maiores que zero.' });
      return true;
    }

    const valorUnidadeCompra = qtd === 0 ? 0 : lote / Math.max(qtd, 1);
    const lucroBrutoEstimado = (venda * qtd) - lote;

    db.prepare(`
      UPDATE products
      SET nome = ?, categoria = ?, quantidade = ?, valor_lote = ?, valor_unidade_compra = ?, valor_venda = ?, lucro_bruto_estimado = ?
      WHERE id = ?
    `).run(String(nome).trim(), String(categoria).trim(), qtd, lote, valorUnidadeCompra, venda, lucroBrutoEstimado, productId);

    sendJson(res, 200, {
      produtos: listProducts(),
      financeiro: getFinanceiro()
    });
    return true;
  }

  if (req.method === 'DELETE' && productDetailMatch) {
    if (!requireManager()) return true;
    const productId = Number(decodeURIComponent(productDetailMatch[1]));
    const existingProduct = db.prepare(`
      SELECT id
      FROM products
      WHERE id = ?
    `).get(productId);

    if (!existingProduct) {
      sendJson(res, 404, { error: 'Produto não encontrado.' });
      return true;
    }

    const hasSales = db.prepare(`
      SELECT 1
      FROM sales
      WHERE produto_id = ?
      LIMIT 1
    `).get(productId);

    if (hasSales) {
      sendJson(res, 409, { error: 'Este produto já possui vendas registradas e não pode ser removido.' });
      return true;
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(productId);
    sendJson(res, 200, {
      produtos: listProducts(),
      financeiro: getFinanceiro()
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/vendas') {
    if (!requireAuth()) return true;
    const logsVenda = authenticatedUser.role === 'gerente'
      ? listSales()
      : listSales().filter((sale) => sale.matricula === authenticatedUser.matricula);
    sendJson(res, 200, { logsVenda });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/vendas') {
    if (!requireAuth()) return true;
    const { produtoId, quantidade, descontoPercentual = 0, vendedor, matricula } = await parseRequestBody(req);
    const qtd = Number(quantidade);
    const descontoPct = Number(descontoPercentual) || 0;
    const vendedorEfetivo = authenticatedUser.role === 'vendedor' ? authenticatedUser.nome : vendedor;
    const matriculaEfetiva = authenticatedUser.role === 'vendedor' ? authenticatedUser.matricula : matricula;

    if (!produtoId || !Number.isFinite(qtd) || qtd <= 0 || descontoPct < 0 || descontoPct > 100 || !vendedorEfetivo || !matriculaEfetiva) {
      sendJson(res, 400, { error: 'Dados da venda inválidos.' });
      return true;
    }

    const produto = db.prepare(`
      SELECT id, nome, quantidade, valor_unidade_compra, valor_venda
      FROM products
      WHERE id = ?
    `).get(Number(produtoId));

    if (!produto) {
      sendJson(res, 404, { error: 'Produto não encontrado.' });
      return true;
    }

    if (qtd > produto.quantidade) {
      sendJson(res, 400, { error: `Quantidade solicitada (${qtd}) excede o saldo em estoque (${produto.quantidade}).` });
      return true;
    }

    const receitaBruta = produto.valor_venda * qtd;
    const descontoValor = receitaBruta * (descontoPct / 100);
    const receitaLiquida = receitaBruta - descontoValor;
    const custoTotal = produto.valor_unidade_compra * qtd;
    const lucroEmpresa = receitaLiquida - custoTotal;
    const comissaoVendedor = receitaLiquida * 0.05;

    db.exec('BEGIN');
    try {
      db.prepare('UPDATE products SET quantidade = quantidade - ? WHERE id = ?').run(qtd, produto.id);
      db.prepare(`
        INSERT INTO sales (
          produto_id, nome_produto, quantidade, vendedor_nome, vendedor_matricula,
          desconto_percentual, desconto_valor, receita_bruta, receita_liquida,
          custo_total, lucro_empresa, comissao_vendedor
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        produto.id,
        produto.nome,
        qtd,
        String(vendedorEfetivo).trim(),
        String(matriculaEfetiva).trim(),
        descontoPct,
        descontoValor,
        receitaBruta,
        receitaLiquida,
        custoTotal,
        lucroEmpresa,
        comissaoVendedor
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    sendJson(res, 201, {
      logsVenda: listSales(),
      produtos: listProducts()
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/admin/reset') {
    if (!requireManager()) return true;
    db.exec(`
      DELETE FROM sales;
      DELETE FROM products;
      DELETE FROM sessions;
      DELETE FROM users;
      DELETE FROM sqlite_sequence;
    `);
    initializeDatabase();
    sendJson(res, 200, { message: 'Banco de dados reinicializado com sucesso.' });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(requestUrl.pathname);

    if (pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, pathname);
      if (!handled) sendJson(res, 404, { error: 'Rota não encontrada.' });
      return;
    }

    serveStaticFile(res, pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Erro interno do servidor.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor disponível em http://${HOST}:${PORT}`);
});
