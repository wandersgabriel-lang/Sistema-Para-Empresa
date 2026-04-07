const SESSION_USER_KEY = 'SistemaEmpresaUserSession';

const EmpresaData = {
    produtos: [],
    logsVenda: [],
    financeiro: {
        investimento: 0,
        lucro: 0,
        prejuizo: 0
    }
};

let usersCache = [];

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function recalcularFinanceiro() {
    const investimento = EmpresaData.produtos.reduce((acc, produto) => acc + Number(produto.valorLote || 0), 0);
    const lucro = EmpresaData.produtos.reduce((acc, produto) => acc + Number(produto.lucroBrutoEstimado || 0), 0);

    EmpresaData.financeiro = {
        investimento,
        lucro,
        prejuizo: lucro < 0 ? Math.abs(lucro) : 0
    };
}

async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        ...options
    });

    let payload = {};
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }

    if (!response.ok) {
        if (response.status === 401) {
            setCurrentUser(null);
        }
        throw new Error(payload.error || 'Erro ao processar a requisição.');
    }

    return payload;
}

function getCurrentUser() {
    const raw = sessionStorage.getItem(SESSION_USER_KEY);
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function setCurrentUser(user) {
    if (user) {
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    } else {
        sessionStorage.removeItem(SESSION_USER_KEY);
    }
}

async function logout() {
    try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
    } finally {
        setCurrentUser(null);
        window.location.reload();
    }
}

function getSavedUsers() {
    return usersCache;
}

function applyBootstrapData(data) {
    EmpresaData.produtos = Array.isArray(data.produtos) ? data.produtos : [];
    EmpresaData.logsVenda = Array.isArray(data.logsVenda) ? data.logsVenda : [];
    usersCache = Array.isArray(data.users) ? data.users : [];
    recalcularFinanceiro();
}

async function carregarDadosIniciais() {
    const data = await apiRequest('/api/bootstrap');
    applyBootstrapData(data);
}

async function refreshUsers() {
    const data = await apiRequest('/api/users');
    usersCache = data.users || [];
    return usersCache;
}

async function refreshProdutos() {
    const data = await apiRequest('/api/produtos');
    EmpresaData.produtos = data.produtos || [];
    recalcularFinanceiro();
    return EmpresaData.produtos;
}

async function refreshVendas() {
    const data = await apiRequest('/api/vendas');
    EmpresaData.logsVenda = data.logsVenda || [];
    return EmpresaData.logsVenda;
}

async function refreshAllData() {
    await carregarDadosIniciais();
}

function renderListaUsuarios() {
    const listaUsuarios = document.querySelector('#listaUsuarios');
    if (!listaUsuarios) return;

    const users = getSavedUsers();

    if (users.length === 0) {
        listaUsuarios.innerHTML = '<p style="text-align: center; color: #a1a0a0; padding: 20px;">Nenhum usuário cadastrado.</p>';
        return;
    }

    let html = '<table style="width:100%; border-collapse: collapse; text-align: left; margin-top: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;">';
    html += '<thead><tr style="border-bottom: 2px solid #00f529;"><th style="padding: 12px; color: #00f529;">Matrícula</th><th style="padding: 12px; color: #00f529;">Nome</th><th style="padding: 12px; color: #00f529;">Função</th><th style="padding: 12px; color: #00f529;">Status</th><th style="padding: 12px; color: #00f529;">Ações</th></tr></thead><tbody>';

    users.forEach((user) => {
        const statusDisplay = user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Aprovado';

        let actionsHtml = `<button onclick="editarUsuario('${user.matricula}')" style="margin-right: 5px; padding: 5px 10px; background: #ffa500; color: #000; border: none; border-radius: 4px; cursor: pointer;">Editar</button>
                           <button onclick="removerUsuario('${user.matricula}')" style="padding: 5px 10px; background: #ff4f4f; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Remover</button>`;

        if (user.status === 'pendente') {
            actionsHtml = `<button onclick="aprovarUsuario('${user.matricula}')" style="margin-right: 5px; padding: 5px 10px; background: #00f529; color: #000; border: none; border-radius: 4px; cursor: pointer;">Aprovar</button>
                           <button onclick="reprovarUsuario('${user.matricula}')" style="padding: 5px 10px; background: #ff4f4f; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Reprovar</button>`;
        }

        html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
            <td style="padding: 12px; color: #fff;">${user.matricula}</td>
            <td style="padding: 12px; color: #fff;">${user.nome}</td>
            <td style="padding: 12px; color: #fff;">${user.role === 'gerente' ? 'Gerente' : 'Vendedor'}</td>
            <td style="padding: 12px; color: #fff;">${statusDisplay}</td>
            <td style="padding: 12px;">${actionsHtml}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    listaUsuarios.innerHTML = html;
}

function adicionarUsuario() {
    const container = document.querySelector('#listaUsuarios');
    if (!container) return;

    const formHtml = `
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h4>Adicionar Novo Usuário</h4>
            <form id="formAddUsuario">
                <div class="form-group">
                    <label for="novaMatricula">Matrícula:</label>
                    <input type="text" id="novaMatricula" required>
                </div>
                <div class="form-group">
                    <label for="novaSenha">Senha:</label>
                    <input type="password" id="novaSenha" required>
                </div>
                <div class="form-group">
                    <label for="novoNome">Nome:</label>
                    <input type="text" id="novoNome" required>
                </div>
                <div class="form-group">
                    <label for="novaFuncao">Função:</label>
                    <select id="novaFuncao" required>
                        <option value="vendedor">Vendedor</option>
                        <option value="gerente">Gerente</option>
                    </select>
                </div>
                <button type="submit" style="padding: 10px 15px; background: #00f529; color: #000; border: none; border-radius: 8px; cursor: pointer;">Salvar</button>
                <button type="button" onclick="cancelarAddUsuario()" style="margin-left: 10px; padding: 10px 15px; background: #666; color: #fff; border: none; border-radius: 8px; cursor: pointer;">Cancelar</button>
            </form>
        </div>
    `;

    container.innerHTML += formHtml;

    document.querySelector('#formAddUsuario').addEventListener('submit', async (e) => {
        e.preventDefault();
        const matricula = document.querySelector('#novaMatricula').value.trim();
        const senha = document.querySelector('#novaSenha').value.trim();
        const nome = document.querySelector('#novoNome').value.trim();
        const role = document.querySelector('#novaFuncao').value;

        try {
            await apiRequest('/api/users', {
                method: 'POST',
                body: JSON.stringify({ matricula, senha, nome, role, status: 'aprovado' })
            });
            await refreshUsers();
            renderListaUsuarios();
        } catch (error) {
            alert(error.message);
        }
    });
}

function editarUsuario(matricula) {
    const users = getSavedUsers();
    const user = users.find((item) => item.matricula === matricula);
    if (!user) return;

    const formHtml = `
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h4>Editar Usuário</h4>
            <form id="formEditUsuario">
                <div class="form-group">
                    <label for="editMatricula">Matrícula:</label>
                    <input type="text" id="editMatricula" value="${user.matricula}" readonly>
                </div>
                <div class="form-group">
                    <label for="editSenha">Senha:</label>
                    <input type="password" id="editSenha" placeholder="Digite uma nova senha para alterar">
                    <small style="display: block; margin-top: 6px; color: #a1a0a0;">Deixe em branco para manter a senha atual.</small>
                </div>
                <div class="form-group">
                    <label for="editNome">Nome:</label>
                    <input type="text" id="editNome" value="${user.nome}" required>
                </div>
                <div class="form-group">
                    <label for="editFuncao">Função:</label>
                    <select id="editFuncao" required>
                        <option value="vendedor" ${user.role === 'vendedor' ? 'selected' : ''}>Vendedor</option>
                        <option value="gerente" ${user.role === 'gerente' ? 'selected' : ''}>Gerente</option>
                    </select>
                </div>
                <button type="submit" style="padding: 10px 15px; background: #00f529; color: #000; border: none; border-radius: 8px; cursor: pointer;">Salvar</button>
                <button type="button" onclick="cancelarEditUsuario()" style="margin-left: 10px; padding: 10px 15px; background: #666; color: #fff; border: none; border-radius: 8px; cursor: pointer;">Cancelar</button>
            </form>
        </div>
    `;

    document.querySelector('#listaUsuarios').innerHTML += formHtml;

    document.querySelector('#formEditUsuario').addEventListener('submit', async (e) => {
        e.preventDefault();
        const senha = document.querySelector('#editSenha').value.trim();
        const nome = document.querySelector('#editNome').value.trim();
        const role = document.querySelector('#editFuncao').value;

        try {
            await apiRequest(`/api/users/${encodeURIComponent(matricula)}`, {
                method: 'PUT',
                body: JSON.stringify({ nome, senha, role, status: user.status || 'aprovado' })
            });
            await refreshUsers();
            renderListaUsuarios();
        } catch (error) {
            alert(error.message);
        }
    });
}

async function removerUsuario(matricula) {
    if (!confirm('Tem certeza que deseja remover este usuário?')) return;

    try {
        await apiRequest(`/api/users/${encodeURIComponent(matricula)}`, { method: 'DELETE' });
        await refreshUsers();
        renderListaUsuarios();
    } catch (error) {
        alert(error.message);
    }
}

async function aprovarUsuario(matricula) {
    if (!confirm('Tem certeza que deseja aprovar este usuário?')) return;

    try {
        await apiRequest(`/api/users/${encodeURIComponent(matricula)}/status`, {
            method: 'POST',
            body: JSON.stringify({ status: 'aprovado' })
        });
        await refreshUsers();
        renderListaUsuarios();
    } catch (error) {
        alert(error.message);
    }
}

async function reprovarUsuario(matricula) {
    if (!confirm('Tem certeza que deseja reprovar este usuário?')) return;

    try {
        await apiRequest(`/api/users/${encodeURIComponent(matricula)}/status`, {
            method: 'POST',
            body: JSON.stringify({ status: 'reprovado' })
        });
        await refreshUsers();
        renderListaUsuarios();
    } catch (error) {
        alert(error.message);
    }
}

function cancelarAddUsuario() {
    renderListaUsuarios();
}

function cancelarEditUsuario() {
    renderListaUsuarios();
}

function renderPermissoes() {
    const permissoesConteudo = document.querySelector('#permissoesConteudo');
    if (!permissoesConteudo) return;

    const user = getCurrentUser();
    if (!user || user.role !== 'gerente') {
        permissoesConteudo.innerHTML = '<p style="text-align: center; color: #a1a0a0; padding: 20px;">Esta página é exclusiva para gerentes.</p>';
        return;
    }

    permissoesConteudo.innerHTML = `
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #ff6b6b; margin-bottom: 20px;">
            <h4 style="color: #ff6b6b; margin-bottom: 10px;">⚠️ Zona de Segurança</h4>
            <p style="color: #fff; margin-bottom: 15px;">Operações sensíveis que afetam o sistema inteiro. Use com cuidado!</p>
            <button onclick="limparBancoDados()" style="width: 100%; padding: 15px; background: #ff4f4f; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem;">
                🗑️ LIMPAR BANCO DE DADOS
            </button>
            <p style="color: #ffa500; margin-top: 10px; font-size: 0.85rem;">⚠️ Aviso: Esta ação é irreversível e removerá TODOS os dados do sistema.</p>
        </div>
    `;
}

function renderConfiguracoes() {
    const configuracoesConteudo = document.querySelector('#configuracoesConteudo');
    if (!configuracoesConteudo) return;

    const user = getCurrentUser();
    if (!user || user.role !== 'gerente') {
        configuracoesConteudo.innerHTML = '<p style="text-align: center; color: #a1a0a0; padding: 20px;">Esta página é exclusiva para gerentes.</p>';
        return;
    }

    configuracoesConteudo.innerHTML = `
        <div class="card-relatorio">
            <p><strong>Resumo do sistema</strong></p>
            <p>Produtos cadastrados: ${EmpresaData.produtos.length}</p>
            <p>Usuários cadastrados: ${usersCache.length}</p>
            <p>Vendas registradas: ${EmpresaData.logsVenda.length}</p>
        </div>
        <div class="card-relatorio">
            <p><strong>Banco de dados atual</strong></p>
            <p>O sistema agora usa SQLite real via servidor Node.js.</p>
            <p>As sessões ainda ficam no navegador, mas produtos, usuários e vendas já saem do armazenamento local.</p>
        </div>
    `;
}

async function limparBancoDados() {
    const user = getCurrentUser();
    if (!user || user.role !== 'gerente') {
        alert('Apenas gerentes podem realizar esta ação.');
        return;
    }

    const confirmacao = confirm('⚠️ CONFIRMAÇÃO: Esta ação removerá TODOS os dados do sistema. Tem certeza?');
    if (!confirmacao) return;

    const confirmacao2 = confirm('SEGUNDA CONFIRMAÇÃO: Digite "LIMPAR" na próxima caixa para confirmar permanentemente.');
    if (!confirmacao2) return;

    const resposta = prompt('Digite "LIMPAR" (em maiúsculas) para confirmar:');
    if (resposta !== 'LIMPAR') {
        alert('Confirmação cancelada. Banco de dados preservado.');
        return;
    }

    try {
        await apiRequest('/api/admin/reset', { method: 'POST' });
        alert('✅ Banco de dados foi reinicializado com sucesso!');
        logout();
    } catch (error) {
        alert(error.message);
    }
}

function renderResumoProduto(resultado, ultimoAdicionado) {
    const totalItens = EmpresaData.produtos.reduce((acc, produto) => acc + Number(produto.quantidade || 0), 0);
    let statusFinanceiro = '';

    if (EmpresaData.financeiro.lucro < 0) {
        statusFinanceiro = `<p class="msg-erro">⚠️ Atenção: O estoque está operando com prejuízo estimado!</p>`;
    } else if (EmpresaData.financeiro.lucro === 0) {
        statusFinanceiro = `<p class="msg-alerta">Ponto de Equilíbrio Estimado.</p>`;
    } else {
        statusFinanceiro = `<p class="msg-sucesso">✅ Estoque operando com Lucratividade Alta!</p>`;
    }

    const cardProduto = ultimoAdicionado ? `
        <div class="card-relatorio">
            <p class="msg-sucesso"><strong>📦 ${ultimoAdicionado.nome}</strong> adicionado com sucesso!</p>
            <p>Lote de ${ultimoAdicionado.quantidade} unidades adicionadas.</p>
            <p>Custo Unitário Médio: ${formatarMoeda(ultimoAdicionado.valorUnidadeCompra)}</p>
            <p>Previsto lucro neste lote: ${formatarMoeda(ultimoAdicionado.lucroBrutoEstimado)}</p>
        </div>
    ` : '';

    const cardEstoque = `
        <div class="card-relatorio">
            <p><strong>📊 RESUMO GERAL DE ESTOQUE</strong></p>
            <p>Total de Modelos Cadastrados: ${EmpresaData.produtos.length}</p>
            <p>Total de Unidades Armazenadas: ${totalItens}</p>
            <p>Investimento Alocado: ${formatarMoeda(EmpresaData.financeiro.investimento)}</p>
        </div>
    `;

    resultado.innerHTML = statusFinanceiro + cardProduto + cardEstoque;
}

function initModuloProdutos() {
    const form = document.querySelector('.formProdutos');
    const resultado = document.querySelector('.resultado');
    if (!form || !resultado) return;

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();

        const nome = form.querySelector('.nomeProduto').value.trim();
        const categoria = form.querySelector('.categoriaProduto').value.trim();
        const quantidade = Number(form.querySelector('.quantidadeProduto').value);
        const valorLote = Number(form.querySelector('.valorProduto').value);
        const valorVenda = Number(form.querySelector('.valorVendaProduto').value);

        if (!nome || !categoria || !Number.isFinite(quantidade) || !Number.isFinite(valorLote) || !Number.isFinite(valorVenda)) {
            resultado.innerHTML = '<p class="msg-erro">Preencha todos os campos do produto.</p>';
            return;
        }

        if (quantidade <= 0 || valorLote <= 0 || valorVenda <= 0) {
            resultado.innerHTML = '<p class="msg-erro">Os valores e quantidades devem ser maiores que zero.</p>';
            return;
        }

        try {
            const data = await apiRequest('/api/produtos', {
                method: 'POST',
                body: JSON.stringify({ nome, categoria, quantidade, valorLote, valorVenda })
            });

            EmpresaData.produtos = data.produtos || [];
            recalcularFinanceiro();
            renderResumoProduto(resultado, data.produto);
            form.reset();
        } catch (error) {
            resultado.innerHTML = `<p class="msg-erro">${error.message}</p>`;
        }
    });
}

function editarProduto(produtoId) {
    const produto = EmpresaData.produtos.find((item) => Number(item.id) === Number(produtoId));
    const listaEstoque = document.querySelector('#listaEstoque');
    if (!produto || !listaEstoque) return;

    const formHtml = `
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h4>Editar Produto</h4>
            <form id="formEditProduto">
                <div class="form-group">
                    <label for="editProdutoNome">Nome:</label>
                    <input type="text" id="editProdutoNome" value="${produto.nome}" required>
                </div>
                <div class="form-group">
                    <label for="editProdutoCategoria">Categoria:</label>
                    <select id="editProdutoCategoria" required>
                        <option value="Vestuário" ${produto.categoria === 'Vestuário' ? 'selected' : ''}>Vestuário</option>
                        <option value="Eletrônicos" ${produto.categoria === 'Eletrônicos' ? 'selected' : ''}>Eletrônicos</option>
                        <option value="Calçados" ${produto.categoria === 'Calçados' ? 'selected' : ''}>Calçados</option>
                        <option value="Outros" ${produto.categoria === 'Outros' ? 'selected' : ''}>Outros</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="editProdutoQuantidade">Quantidade:</label>
                    <input type="number" id="editProdutoQuantidade" min="0" value="${produto.quantidade}" required>
                </div>
                <div class="form-group">
                    <label for="editProdutoValorLote">Valor Total de Compra:</label>
                    <input type="number" id="editProdutoValorLote" min="0.01" step="0.01" value="${produto.valorLote}" required>
                </div>
                <div class="form-group">
                    <label for="editProdutoValorVenda">Valor Unitário de Venda:</label>
                    <input type="number" id="editProdutoValorVenda" min="0.01" step="0.01" value="${produto.valorVenda}" required>
                </div>
                <button type="submit" style="padding: 10px 15px; background: #00f529; color: #000; border: none; border-radius: 8px; cursor: pointer;">Salvar</button>
                <button type="button" onclick="cancelarEditProduto()" style="margin-left: 10px; padding: 10px 15px; background: #666; color: #fff; border: none; border-radius: 8px; cursor: pointer;">Cancelar</button>
            </form>
        </div>
    `;

    listaEstoque.innerHTML += formHtml;

    document.querySelector('#formEditProduto').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            nome: document.querySelector('#editProdutoNome').value.trim(),
            categoria: document.querySelector('#editProdutoCategoria').value,
            quantidade: Number(document.querySelector('#editProdutoQuantidade').value),
            valorLote: Number(document.querySelector('#editProdutoValorLote').value),
            valorVenda: Number(document.querySelector('#editProdutoValorVenda').value)
        };

        try {
            const data = await apiRequest(`/api/produtos/${produto.id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            EmpresaData.produtos = data.produtos || [];
            recalcularFinanceiro();
            renderTableEstoque();
        } catch (error) {
            alert(error.message);
        }
    });
}

async function removerProduto(produtoId) {
    if (!confirm('Tem certeza que deseja remover este produto?')) return;

    try {
        const data = await apiRequest(`/api/produtos/${produtoId}`, {
            method: 'DELETE'
        });
        EmpresaData.produtos = data.produtos || [];
        recalcularFinanceiro();
        renderTableEstoque();
    } catch (error) {
        alert(error.message);
    }
}

function cancelarEditProduto() {
    renderTableEstoque();
}

function renderHistoricoVendas() {
    const historicoVendas = document.querySelector('#historicoVendas');
    if (!historicoVendas) return;

    const user = getCurrentUser();
    const allLogsVenda = EmpresaData.logsVenda || [];

    if (user && user.role === 'gerente') {
        if (allLogsVenda.length === 0) {
            historicoVendas.innerHTML = '<p style="text-align: center; color: #a1a0a0; padding: 20px;">Nenhuma saída registrada ainda.</p>';
            return;
        }

        let html = '<h4 style="color:#ffaa00; margin-top:20px; border-bottom:1px solid rgba(255,170,0,0.3); padding-bottom:5px;">Saídas de Estoque (Vendas)</h4>';

        allLogsVenda.forEach((venda) => {
            const dataStr = new Date(venda.createdAt || venda.id).toLocaleString();
            html += `
                <div style="background: rgba(255,255,255,0.05); padding: 14px; margin-top: 10px; border-radius: 8px; border-left: 4px solid #ffaa00;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <small style="color: #a1a0a0;">Data: ${dataStr}</small>
                        <strong style="color: #fff;">Vendedor: ${venda.vendedor || '—'}</strong>
                    </div>
                    <p style="margin: 6px 0; font-size: 0.95rem;">
                        <strong style="color:#fff">${venda.quantidadeTrancionada}x ${venda.nomeProduto}</strong>
                    </p>
                </div>
            `;
        });

        historicoVendas.innerHTML = html;
        return;
    }

    const logsVenda = user && user.role === 'vendedor'
        ? allLogsVenda.filter((venda) => venda.matricula === user.matricula)
        : allLogsVenda;

    if (logsVenda.length === 0) {
        historicoVendas.innerHTML = '<p style="text-align: center; color: #a1a0a0; padding: 20px;">Ainda não há vendas registradas para este usuário.</p>';
        return;
    }

    const hoje = new Date().toDateString();
    const vendasHoje = logsVenda.filter((venda) => new Date(venda.createdAt || venda.id).toDateString() === hoje);
    const totalHoje = vendasHoje.reduce((sum, venda) => sum + Number(venda.receitaLiquida || 0), 0);

    let html = `
        <div style="background: rgba(255,255,255,0.05); padding: 14px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #00f529;">
            <h4 style="color: #00f529; margin-bottom: 6px;">Suas vendas hoje</h4>
            <p style="margin: 0; color: #fff;">Total de vendas: <strong>${vendasHoje.length}</strong></p>
            <p style="margin: 4px 0 0; color: #a1a0a0;">Receita líquida: <strong>${formatarMoeda(totalHoje)}</strong></p>
        </div>
        <h4 style="color:#ffaa00; margin-top:20px; border-bottom:1px solid rgba(255,170,0,0.3); padding-bottom:5px;">Últimas Vendas Realizadas</h4>
    `;

    logsVenda.forEach((venda) => {
        const dataStr = new Date(venda.createdAt || venda.id).toLocaleString();
        html += `
            <div style="background: rgba(255,255,255,0.05); padding: 14px; margin-top: 10px; border-radius: 8px; border-left: 4px solid #ffaa00;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <small style="color: #a1a0a0;">Data: ${dataStr}</small>
                    <strong style="color: #fff;">Vendedor: ${venda.vendedor} (Matr.: ${venda.matricula})</strong>
                </div>
                <p style="margin: 6px 0; font-size: 0.95rem;">
                    <strong style="color:#fff">${venda.quantidadeTrancionada}x ${venda.nomeProduto}</strong>
                </p>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-top: 6px;">
                    <span>Receita Bruta: <strong style="color:#00f529">${formatarMoeda(venda.receitaBruta)}</strong></span>
                    <span>Desconto: <strong style="color:#ff6b6b">${formatarMoeda(venda.descontoValor)} (${Number(venda.descontoPercentual || 0).toFixed(2)}%)</strong></span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-top: 4px;">
                    <span>Receita Líquida: <strong style="color:#00f529">${formatarMoeda(venda.receitaLiquida)}</strong></span>
                    <span>Lucro Empresa: <strong style="color:#00d623">${formatarMoeda(venda.lucroEmpresa)}</strong></span>
                </div>
                <div style="text-align: right; margin-top: 4px; font-size: 0.85rem;">
                    Comissão: <strong style="color:#ffa500">${formatarMoeda(venda.comissaoVendedor)}</strong>
                </div>
            </div>
        `;
    });

    historicoVendas.innerHTML = html;
}

function renderDashboard() {
    const dashboardContent = document.querySelector('#dashboardContent');
    if (!dashboardContent) return;

    const user = getCurrentUser();
    if (user && user.role === 'vendedor') {
        dashboardContent.innerHTML = '<p style="text-align: center; color: #a1a0a0; padding: 20px;">O dashboard está disponível apenas para gestores.</p>';
        return;
    }

    const produtosBaixoEstoque = EmpresaData.produtos.filter((produto) => Number(produto.quantidade) <= 10);
    const logsVenda = EmpresaData.logsVenda || [];
    const hoje = new Date().toDateString();
    const vendasHoje = logsVenda.filter((log) => new Date(log.createdAt || log.id).toDateString() === hoje);

    const produtoVendas = {};
    logsVenda.forEach((log) => {
        produtoVendas[log.nomeProduto] = (produtoVendas[log.nomeProduto] || 0) + Number(log.quantidadeTrancionada || 0);
    });

    const produtosMaisVendidos = Object.entries(produtoVendas).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const produtosMenosVendidos = Object.entries(produtoVendas).sort((a, b) => a[1] - b[1]).slice(0, 5);

    const vendedorVendas = {};
    logsVenda.forEach((log) => {
        const chave = `${log.vendedor} (${log.matricula || '—'})`;
        vendedorVendas[chave] = (vendedorVendas[chave] || 0) + Number(log.receitaLiquida || 0);
    });

    const vendedorTop = Object.entries(vendedorVendas).sort((a, b) => b[1] - a[1])[0];

    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">';

    if (produtosBaixoEstoque.length > 0) {
        html += `
            <div style="grid-column: 1 / -1; background: rgba(255,0,0,0.1); padding: 20px; border-radius: 8px; border-left: 4px solid #ff0000;">
                <h4 style="color: #ff0000; margin-bottom: 10px;">⚠️ Alerta de Estoque Baixo</h4>
                <p style="color: #fff; margin-bottom: 10px;">Os seguintes produtos estão com estoque baixo (10 ou menos unidades):</p>
                <ul style="list-style: none; padding: 0; color: #fff;">
                    ${produtosBaixoEstoque.map((produto) => `<li style="margin-bottom: 5px;">${produto.nome}: ${produto.quantidade} unidades restantes</li>`).join('')}
                </ul>
            </div>
        `;
    }

    html += `
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #00f529;">
            <h4 style="color: #00f529; margin-bottom: 10px;">Vendas de Hoje</h4>
            <p style="font-size: 1.2rem; color: #fff;">${vendasHoje.length} vendas realizadas</p>
            <p style="font-size: 1rem; color: #a1a0a0;">Total: ${formatarMoeda(vendasHoje.reduce((sum, venda) => sum + Number(venda.receitaLiquida || 0), 0))}</p>
        </div>
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #ffaa00;">
            <h4 style="color: #ffaa00; margin-bottom: 10px;">Produtos Mais Vendidos</h4>
            <ul style="list-style: none; padding: 0;">
                ${produtosMaisVendidos.map(([produto, qtd]) => `<li style="margin-bottom: 5px; color: #fff;">${produto}: ${qtd} unidades</li>`).join('') || '<li style="color: #a1a0a0;">Sem vendas registradas.</li>'}
            </ul>
        </div>
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #ff6b6b;">
            <h4 style="color: #ff6b6b; margin-bottom: 10px;">Produtos Menos Vendidos</h4>
            <ul style="list-style: none; padding: 0;">
                ${produtosMenosVendidos.map(([produto, qtd]) => `<li style="margin-bottom: 5px; color: #fff;">${produto}: ${qtd} unidades</li>`).join('') || '<li style="color: #a1a0a0;">Sem vendas registradas.</li>'}
            </ul>
        </div>
    `;

    if (vendedorTop) {
        html += `
            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #ffa500;">
                <h4 style="color: #ffa500; margin-bottom: 10px;">Vendedor Destaque</h4>
                <p style="font-size: 1.1rem; color: #fff;">${vendedorTop[0]}</p>
                <p style="font-size: 1rem; color: #a1a0a0;">Receita: ${formatarMoeda(vendedorTop[1])}</p>
            </div>
        `;
    }

    html += '</div>';
    dashboardContent.innerHTML = html;
}

function renderTableEstoque() {
    const listaEstoque = document.querySelector('#listaEstoque');
    if (!listaEstoque) return;
    const user = getCurrentUser();
    const canManageProducts = user && user.role === 'gerente';

    if (EmpresaData.produtos.length === 0) {
        listaEstoque.innerHTML = '<p style="text-align: center; color: #a1a0a0; padding: 20px;">O estoque da empresa está vazio. Cadastre novos produtos primeiro.</p>';
        return;
    }

    let html = `
        <table style="width:100%; border-collapse: collapse; text-align: left; margin-top: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;">
            <thead>
                <tr style="border-bottom: 2px solid #00f529;">
                    <th style="padding: 12px; color: #00f529;">ID</th>
                    <th style="padding: 12px; color: #00f529;">Categoria</th>
                    <th style="padding: 12px; color: #00f529;">Produto</th>
                    <th style="padding: 12px; color: #00f529;">Qtd.</th>
                    <th style="padding: 12px; color: #00f529;">Preço Venda</th>
                    ${canManageProducts ? '<th style="padding: 12px; color: #00f529;">Ações</th>' : ''}
                </tr>
            </thead>
            <tbody>
    `;

    EmpresaData.produtos.forEach((produto, idx) => {
        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); transition: background 0.2s;">
                <td style="padding: 12px; color: #a1a0a0;">#${idx + 1}</td>
                <td style="padding: 12px;"><span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">${produto.categoria}</span></td>
                <td style="padding: 12px; font-weight: bold;">${produto.nome}</td>
                <td style="padding: 12px;">${produto.quantidade} un.</td>
                <td style="padding: 12px; color: #00f529;">${formatarMoeda(produto.valorVenda)}</td>
                ${canManageProducts ? `<td style="padding: 12px;">
                    <button onclick="editarProduto(${produto.id})" style="margin-right: 5px; padding: 5px 10px; background: #ffa500; color: #000; border: none; border-radius: 4px; cursor: pointer;">Editar</button>
                    <button onclick="removerProduto(${produto.id})" style="padding: 5px 10px; background: #ff4f4f; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Remover</button>
                </td>` : ''}
            </tr>
        `;
    });

    html += '</tbody></table>';
    listaEstoque.innerHTML = html;
}

function renderCategorias() {
    const listaCategorias = document.querySelector('#listaCategorias');
    if (!listaCategorias) return;

    if (EmpresaData.produtos.length === 0) {
        listaCategorias.innerHTML = '<p style="text-align: center; color: #a1a0a0; padding: 20px;">Não há produtos cadastrados nas categorias.</p>';
        return;
    }

    const categoriasMap = {
        'Vestuário': [],
        'Eletrônicos': [],
        'Calçados': [],
        'Outros': []
    };

    EmpresaData.produtos.forEach((produto) => {
        if (categoriasMap[produto.categoria]) {
            categoriasMap[produto.categoria].push(produto);
        } else {
            categoriasMap.Outros.push(produto);
        }
    });

    let html = '';

    Object.entries(categoriasMap).forEach(([nomeCategoria, produtos]) => {
        if (produtos.length === 0) return;

        html += `<h4 style="color: #00d0ff; margin-top: 20px; border-bottom: 1px solid rgba(0, 208, 255, 0.3); padding-bottom: 5px;">📂 ${nomeCategoria} <span style="color:#a1a0a0; font-size:0.8rem;">(${produtos.length} itens)</span></h4>`;
        html += '<ul style="list-style: none; padding: 0; margin-top: 10px;">';

        produtos.forEach((produto) => {
            html += `
                <li style="background: rgba(255,255,255,0.05); padding: 10px; margin-bottom: 8px; border-radius: 6px; border-left: 3px solid #00f529; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: #fff; display:block;">${produto.nome}</strong>
                        <small style="color: #a1a0a0;">Estoque: ${produto.quantidade} un.</small>
                    </div>
                    <div style="color: #00f529; font-weight:bold;">${formatarMoeda(produto.valorVenda)}</div>
                </li>
            `;
        });

        html += '</ul>';
    });

    listaCategorias.innerHTML = html || '<p style="text-align: center; color: #a1a0a0; padding: 20px;">Não há produtos classificados.</p>';
}

function initMenuNavigation() {
    if (window.__SistemaEmpresaMenuInit) {
        applyAccessRules();
        return;
    }

    window.__SistemaEmpresaMenuInit = true;

    const btnInicio = document.querySelector('#btnInicio');
    const btnAddProduto = document.querySelector('#btnAddProduto');
    const btnVendas = document.querySelector('#btnVendas');
    const btnHistorico = document.querySelector('#btnHistorico');
    const btnVerEstoque = document.querySelector('#btnVerEstoque');
    const btnCategorias = document.querySelector('#btnCategorias');
    const btnUsuarios = document.querySelector('#btnUsuarios');
    const btnPermissoes = document.querySelector('#btnPermissoes');
    const btnConfiguracoes = document.querySelector('#btnConfiguracoes');

    const boxInicio = document.querySelector('#boxInicio');
    const boxProdutos = document.querySelector('#boxProdutos');
    const boxVendas = document.querySelector('#boxVendas');
    const boxVerEstoque = document.querySelector('#boxVerEstoque');
    const boxCategorias = document.querySelector('#boxCategorias');
    const boxSaidaEstoque = document.querySelector('#boxSaidaEstoque');
    const boxGerenciamento = document.querySelector('#boxGerenciamento');
    const boxPermissoes = document.querySelector('#boxPermissoes');
    const boxConfiguracoes = document.querySelector('#boxConfiguracoes');

    const selectProdutoVenda = document.querySelector('#selectProdutoVenda');
    const quantidadeVenda = document.querySelector('#quantidadeVenda');
    const descontoVenda = document.querySelector('#descontoVenda');
    const vendedorVenda = document.querySelector('#vendedorVenda');
    const matriculaVendedor = document.querySelector('#matriculaVendedor');
    const resultadoVenda = document.querySelector('.resultadoVenda');
    const formSaida = document.querySelector('.formSaida');

    window.applyAccessRules = applyAccessRules;

    function applyAccessRules() {
        const user = getCurrentUser();
        const liInicio = btnInicio?.closest('li');
        const liProdutos = document.querySelector('a[href="#produtos"]')?.closest('li');
        const liVendas = btnVendas?.closest('li');
        const liHistorico = btnHistorico?.closest('li');
        const liEstoque = document.querySelector('a[href="#estoque"]')?.closest('li');
        const liGerenciamento = document.querySelector('a[href="#gerenciamento"]')?.closest('li');

        if (!user) {
            [liInicio, liProdutos, liVendas, liHistorico, liEstoque, liGerenciamento].forEach((item) => {
                if (item) item.style.display = 'none';
            });
            return;
        }

        [liVendas, liHistorico].forEach((item) => {
            if (item) item.style.display = 'block';
        });

        if (user.role === 'vendedor') {
            if (liInicio) liInicio.style.display = 'none';
            if (liProdutos) liProdutos.style.display = 'none';
            if (liEstoque) liEstoque.style.display = 'none';
            if (liGerenciamento) liGerenciamento.style.display = 'none';
        } else {
            [liInicio, liProdutos, liEstoque, liGerenciamento].forEach((item) => {
                if (item) item.style.display = 'block';
            });
        }

        applySalesFormUserContext();
    }

    function applySalesFormUserContext() {
        const user = getCurrentUser();
        if (!vendedorVenda || !matriculaVendedor) return;

        if (user && user.role === 'vendedor') {
            vendedorVenda.value = user.nome;
            matriculaVendedor.value = user.matricula;
            vendedorVenda.readOnly = true;
            matriculaVendedor.readOnly = true;
        } else {
            vendedorVenda.readOnly = false;
            matriculaVendedor.readOnly = false;
            vendedorVenda.value = '';
            matriculaVendedor.value = '';
        }
    }

    function atualizarSelectVendas() {
        if (!selectProdutoVenda) return;

        selectProdutoVenda.innerHTML = '<option value="" disabled selected style="color: black;">Selecione um produto</option>';

        EmpresaData.produtos.forEach((produto) => {
            if (Number(produto.quantidade) <= 0) return;

            const option = document.createElement('option');
            option.value = produto.id;
            option.style.color = 'black';
            option.textContent = `${produto.nome} (Disponível: ${produto.quantidade} un.) - ${formatarMoeda(produto.valorVenda)}`;
            selectProdutoVenda.appendChild(option);
        });
    }

    function abrirFormulario(elementoAtivar) {
        const user = getCurrentUser();
        const isVendedor = user && user.role === 'vendedor';

        if (isVendedor && elementoAtivar !== boxVendas && elementoAtivar !== boxSaidaEstoque) {
            return;
        }

        [boxInicio, boxProdutos, boxVendas, boxVerEstoque, boxCategorias, boxSaidaEstoque, boxGerenciamento, boxPermissoes, boxConfiguracoes].forEach((box) => {
            if (box) box.style.display = 'none';
        });

        document.querySelectorAll('.submenu.ativo').forEach((submenu) => submenu.classList.remove('ativo'));

        if (elementoAtivar) elementoAtivar.style.display = 'flex';
    }

    document.querySelectorAll('.dropdown > a').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const submenu = link.parentElement.querySelector('.submenu');

            document.querySelectorAll('.submenu.ativo').forEach((item) => {
                if (item !== submenu) item.classList.remove('ativo');
            });

            if (submenu) submenu.classList.toggle('ativo');
        });
    });

    if (btnInicio) {
        btnInicio.addEventListener('click', async (e) => {
            e.preventDefault();
            await refreshAllData();
            renderDashboard();
            abrirFormulario(boxInicio);
        });
    }

    if (btnAddProduto) {
        btnAddProduto.addEventListener('click', (e) => {
            e.preventDefault();
            abrirFormulario(boxProdutos);
        });
    }

    if (btnVendas) {
        btnVendas.addEventListener('click', async (e) => {
            e.preventDefault();
            await refreshProdutos();
            atualizarSelectVendas();
            applySalesFormUserContext();
            abrirFormulario(boxVendas);
        });
    }

    if (btnHistorico) {
        btnHistorico.addEventListener('click', async (e) => {
            e.preventDefault();
            await refreshVendas();
            renderHistoricoVendas();
            abrirFormulario(boxSaidaEstoque);
        });
    }

    if (btnVerEstoque) {
        btnVerEstoque.addEventListener('click', async (e) => {
            e.preventDefault();
            await refreshProdutos();
            renderTableEstoque();
            abrirFormulario(boxVerEstoque);
        });
    }

    if (btnCategorias) {
        btnCategorias.addEventListener('click', async (e) => {
            e.preventDefault();
            await refreshProdutos();
            renderCategorias();
            abrirFormulario(boxCategorias);
        });
    }

    if (btnUsuarios) {
        btnUsuarios.addEventListener('click', async (e) => {
            e.preventDefault();
            await refreshUsers();
            renderListaUsuarios();
            abrirFormulario(boxGerenciamento);
        });
    }

    if (btnPermissoes) {
        btnPermissoes.addEventListener('click', (e) => {
            e.preventDefault();
            renderPermissoes();
            abrirFormulario(boxPermissoes);
        });
    }

    if (btnConfiguracoes) {
        btnConfiguracoes.addEventListener('click', async (e) => {
            e.preventDefault();
            await refreshAllData();
            renderConfiguracoes();
            abrirFormulario(boxConfiguracoes);
        });
    }

    if (formSaida) {
        formSaida.addEventListener('submit', async (e) => {
            e.preventDefault();
            resultadoVenda.innerHTML = '';

            const produtoId = Number(selectProdutoVenda.value);
            const qtd = Number(quantidadeVenda.value);
            const descontoPct = Number(descontoVenda?.value) || 0;
            const currentUser = getCurrentUser();
            const vendedor = currentUser && currentUser.role === 'vendedor'
                ? currentUser.nome
                : vendedorVenda?.value.trim();
            const matricula = currentUser && currentUser.role === 'vendedor'
                ? currentUser.matricula
                : matriculaVendedor?.value.trim();

            try {
                await apiRequest('/api/vendas', {
                    method: 'POST',
                    body: JSON.stringify({ produtoId, quantidade: qtd, descontoPercentual: descontoPct, vendedor, matricula })
                });

                await refreshAllData();
                atualizarSelectVendas();
                renderHistoricoVendas();

                const vendaResumo = EmpresaData.logsVenda[0];
                resultadoVenda.innerHTML = `<p class="msg-sucesso">✅ Venda registrada com sucesso. Vendedor: <strong>${vendaResumo.vendedor}</strong> | Receita líquida: ${formatarMoeda(vendaResumo.receitaLiquida)} | Lucro: ${formatarMoeda(vendaResumo.lucroEmpresa)} | Comissão: ${formatarMoeda(vendaResumo.comissaoVendedor)}</p>`;

                quantidadeVenda.value = '';
                if (descontoVenda) descontoVenda.value = '';
                if (!currentUser || currentUser.role !== 'vendedor') {
                    vendedorVenda.value = '';
                    matriculaVendedor.value = '';
                }
            } catch (error) {
                resultadoVenda.innerHTML = `<p class="msg-erro">${error.message}</p>`;
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.submenu.ativo').forEach((submenu) => submenu.classList.remove('ativo'));
        }
    });

    applyAccessRules();
}

function initAuthentication() {
    const loginOverlay = document.querySelector('#loginOverlay');
    const authTitle = document.querySelector('#authTitle');
    const loginForm = document.querySelector('#loginForm');
    const loginMatricula = document.querySelector('#loginMatricula');
    const loginSenha = document.querySelector('#loginSenha');
    const loginError = document.querySelector('#loginError');

    const registerForm = document.querySelector('#registerForm');
    const registerNome = document.querySelector('#registerNome');
    const registerMatricula = document.querySelector('#registerMatricula');
    const registerSenha = document.querySelector('#registerSenha');
    const registerError = document.querySelector('#registerError');

    const showRegisterLink = document.querySelector('#showRegisterLink');
    const showLoginLink = document.querySelector('#showLoginLink');

    const userStatus = document.querySelector('#userStatus');
    const userInfo = document.querySelector('#userInfo');
    const btnLogout = document.querySelector('#btnLogout');

    async function applyUserUI() {
        const logged = getCurrentUser();

        if (!logged) {
            if (loginOverlay) loginOverlay.style.display = 'flex';
            if (userStatus) userStatus.style.display = 'none';
            if (window.applyAccessRules) window.applyAccessRules();
            return;
        }

        try {
            await refreshAllData();
        } catch (error) {
            setCurrentUser(null);
            if (loginOverlay) loginOverlay.style.display = 'flex';
            if (userStatus) userStatus.style.display = 'none';
            return;
        }

        if (loginOverlay) loginOverlay.style.display = 'none';
        if (userStatus) {
            userStatus.style.display = 'flex';
            userInfo.textContent = `Olá, ${logged.nome} (${logged.role === 'gerente' ? 'Gerente' : 'Vendedor'})`;
        }

        if (btnLogout) {
            btnLogout.onclick = (e) => {
                e.preventDefault();
                logout();
            };
        }

        if (window.applyAccessRules) window.applyAccessRules();
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            loginError.style.display = 'none';

            try {
                const data = await apiRequest('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({
                        matricula: loginMatricula.value.trim(),
                        senha: loginSenha.value.trim()
                    })
                });

                setCurrentUser(data.user);
                loginMatricula.value = '';
                loginSenha.value = '';
                await applyUserUI();
            } catch (error) {
                loginError.textContent = error.message;
                loginError.style.display = 'block';
            }
        });
    }

    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginForm) loginForm.style.display = 'none';
            if (registerForm) registerForm.style.display = 'block';
            if (authTitle) authTitle.textContent = 'Crie sua conta';
            if (loginError) loginError.style.display = 'none';
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (registerForm) registerForm.style.display = 'none';
            if (loginForm) loginForm.style.display = 'block';
            if (authTitle) authTitle.textContent = 'Acesse o sistema';
            if (registerError) registerError.style.display = 'none';
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            registerError.style.display = 'none';

            try {
                await apiRequest('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({
                        nome: registerNome.value.trim(),
                        matricula: registerMatricula.value.trim(),
                        senha: registerSenha.value.trim()
                    })
                });

                registerNome.value = '';
                registerMatricula.value = '';
                registerSenha.value = '';
                alert('Cadastro realizado com sucesso. Seu acesso está pendente de aprovação.');
                showLoginLink.click();
            } catch (error) {
                registerError.textContent = error.message;
                registerError.style.display = 'block';
            }
        });
    }

    return applyUserUI();
}

window.adicionarUsuario = adicionarUsuario;
window.editarUsuario = editarUsuario;
window.removerUsuario = removerUsuario;
window.aprovarUsuario = aprovarUsuario;
window.reprovarUsuario = reprovarUsuario;
window.cancelarAddUsuario = cancelarAddUsuario;
window.cancelarEditUsuario = cancelarEditUsuario;
window.editarProduto = editarProduto;
window.removerProduto = removerProduto;
window.cancelarEditProduto = cancelarEditProduto;
window.limparBancoDados = limparBancoDados;

document.addEventListener('DOMContentLoaded', async () => {
    initModuloProdutos();
    initMenuNavigation();
    await initAuthentication();
});
