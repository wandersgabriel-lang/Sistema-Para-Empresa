
const dadosSalvos = JSON.parse(localStorage.getItem('SistemaEmpresaData'));


const EmpresaData = dadosSalvos || {
    produtos: [],
    gastos: [],
    financeiro: {
        investimento: 0,
        lucro: 0,
        prejuizo: 0
    }
};


function salvarBancoDeDados() {
    localStorage.setItem('SistemaEmpresaData', JSON.stringify(EmpresaData));
}


const USERS_STORAGE_KEY = 'SistemaEmpresaUsers';
const SESSION_USER_KEY = 'SistemaEmpresaUserSession';

const defaultUsers = [
    { matricula: '0001', senha: '123', nome: 'Gerente', role: 'gerente' },
    { matricula: '1001', senha: '123', nome: 'Lucas - Vendedor', role: 'vendedor' },
    { matricula: '1002', senha: '123', nome: 'Maria - Vendedora', role: 'vendedor' }
];

function getSavedUsers() {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    try {
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (err) {
        console.warn('Erro ao ler usuários do localStorage', err);
    }
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaultUsers));
    return defaultUsers;
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

function logout() {
    setCurrentUser(null);
    window.location.reload();
}

function isManager() {
    const user = getCurrentUser();
    return user && user.role === 'gerente';
}

function isSeller() {
    const user = getCurrentUser();
    return user && user.role === 'vendedor';
}

function getLoggedSellerInfo() {
    const user = getCurrentUser();
    if (!user) return null;
    return {
        matricula: user.matricula,
        nome: user.nome
    };
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

    users.forEach(user => {
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
            <td style="padding: 12px;">
                ${actionsHtml}
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    listaUsuarios.innerHTML = html;
}

function adicionarUsuario() {
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
    document.querySelector('#listaUsuarios').innerHTML += formHtml;

    document.querySelector('#formAddUsuario').addEventListener('submit', function (e) {
        e.preventDefault();
        const matricula = document.querySelector('#novaMatricula').value.trim();
        const senha = document.querySelector('#novaSenha').value.trim();
        const nome = document.querySelector('#novoNome').value.trim();
        const role = document.querySelector('#novaFuncao').value;

        if (!matricula || !senha || !nome || !role) {
            alert('Preencha todos os campos.');
            return;
        }

        const users = getSavedUsers();
        if (users.find(u => u.matricula === matricula)) {
            alert('Matrícula já existe.');
            return;
        }

        users.push({ matricula, senha, nome, role });
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        renderListaUsuarios();
    });
}

function editarUsuario(matricula) {
    const users = getSavedUsers();
    const user = users.find(u => u.matricula === matricula);
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
                    <input type="password" id="editSenha" value="${user.senha}" required>
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

    document.querySelector('#formEditUsuario').addEventListener('submit', function (e) {
        e.preventDefault();
        const senha = document.querySelector('#editSenha').value.trim();
        const nome = document.querySelector('#editNome').value.trim();
        const role = document.querySelector('#editFuncao').value;

        if (!senha || !nome || !role) {
            alert('Preencha todos os campos.');
            return;
        }

        user.senha = senha;
        user.nome = nome;
        user.role = role;
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        renderListaUsuarios();
    });
}

function removerUsuario(matricula) {
    if (!confirm('Tem certeza que deseja remover este usuário?')) return;

    const users = getSavedUsers();
    const index = users.findIndex(u => u.matricula === matricula);
    if (index === -1) return;

    users.splice(index, 1);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    renderListaUsuarios();
}

function aprovarUsuario(matricula) {
    if (!confirm('Tem certeza que deseja aprovar este usuário?')) return;

    const users = getSavedUsers();
    const user = users.find(u => u.matricula === matricula);
    if (!user) return;

    user.status = 'aprovado';
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    renderListaUsuarios();
}

function reprovarUsuario(matricula) {
    if (!confirm('Tem certeza que deseja reprovar este usuário?')) return;

    const users = getSavedUsers();
    const user = users.find(u => u.matricula === matricula);
    if (!user) return;

    user.status = 'reprovado';
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    renderListaUsuarios();
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

    let html = `
        <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #ff6b6b; margin-bottom: 20px;">
            <h4 style="color: #ff6b6b; margin-bottom: 10px;">⚠️ Zona de Segurança</h4>
            <p style="color: #fff; margin-bottom: 15px;">Operações sensíveis que afetam o sistema inteiro. Use com cuidado!</p>
            
            <button onclick="limparBancoDados()" style="width: 100%; padding: 15px; background: #ff4f4f; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: all 0.3s ease;">
                🗑️ LIMPAR BANCO DE DADOS
            </button>
            <p style="color: #ffa500; margin-top: 10px; font-size: 0.85rem;">⚠️ Aviso: Esta ação é irreversível e removerá TODOS os dados do sistema (produtos, vendas, usuários).</p>
        </div>
    `;

    permissoesConteudo.innerHTML = html;
}

function limparBancoDados() {
    const user = getCurrentUser();
    if (!user || user.role !== 'gerente') {
        alert('Apenas gerentes podem realizar esta ação.');
        return;
    }

    const confirmacao = confirm('⚠️ CONFIRMAÇÃO: Esta ação removerá TODOS os dados do sistema (produtos, vendas, usuários, etc.). Tem certeza?');
    if (!confirmacao) return;

    const confirmacao2 = confirm('SEGUNDA CONFIRMAÇÃO: Digite "LIMPAR" na próxima caixa para confirmar permanentemente.');
    if (!confirmacao2) return;

    const resposta = prompt('Digite "LIMPAR" (em maiúsculas) para confirmar:');
    if (resposta !== 'LIMPAR') {
        alert('Confirmação cancelada. Banco de dados preservado.');
        return;
    }


    localStorage.removeItem('SistemaEmpresaData');
    localStorage.removeItem(USERS_STORAGE_KEY);


    alert('✅ Banco de dados foi completamente limpado com sucesso!');


    logout();
}




function initModuloProdutos() {
    const form = document.querySelector('.formProdutos');
    const resultado = document.querySelector('.resultado');


    const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    function recebeEventoForm(evento) {
        evento.preventDefault();

        const nome = form.querySelector('.nomeProduto').value.trim();
        const categoria = form.querySelector('.categoriaProduto').value.trim();
        const quantidade = Number(form.querySelector('.quantidadeProduto').value);
        const valorLote = Number(form.querySelector('.valorProduto').value);
        const valorVenda = Number(form.querySelector('.valorVendaProduto').value);


        if (!nome || !categoria || isNaN(quantidade) || isNaN(valorLote) || isNaN(valorVenda)) {
            resultado.innerHTML = `<p class="msg-erro">Preencha todos os campos do produto!</p>`;
            return;
        }

        if (quantidade <= 0 || valorLote <= 0 || valorVenda <= 0) {
            resultado.innerHTML = `<p class="msg-erro">Os valores e quantidades devem ser maiores que zero!</p>`;
            return;
        }

        if (nome.length < 3 || nome.length > 50) {
            resultado.innerHTML = `<p class="msg-erro">O nome do produto deve ter entre 3 e 50 caracteres.</p>`;
            return;
        }

        if (/\d/.test(nome)) {
            resultado.innerHTML = `<p class="msg-erro">O nome não pode conter números.</p>`;
            return;
        }


        const valorUnidadeCompra = valorLote / quantidade;
        const investimentoProduto = valorLote;
        const lucroBrutoEstimado = (valorVenda * quantidade) - investimentoProduto;


        const novoProduto = {
            id: Date.now(),
            nome: nome,
            categoria: categoria,
            quantidade: quantidade,
            valorLote: valorLote,
            valorUnidadeCompra: valorUnidadeCompra,
            valorVenda: valorVenda,
            lucroBrutoEstimado: lucroBrutoEstimado
        };

        EmpresaData.produtos.push(novoProduto);


        EmpresaData.financeiro.investimento = EmpresaData.produtos.reduce((acc, p) => acc + p.valorLote, 0);
        EmpresaData.financeiro.lucro = EmpresaData.produtos.reduce((acc, p) => acc + p.lucroBrutoEstimado, 0);

        if (EmpresaData.financeiro.lucro < 0) {
            EmpresaData.financeiro.prejuizo = Math.abs(EmpresaData.financeiro.lucro);
        } else {
            EmpresaData.financeiro.prejuizo = 0;
        }

        salvarBancoDeDados();


        renderizarResumoEstoque();
    }

    function renderizarResumoEstoque() {
        resultado.innerHTML = '';
        const totalItens = EmpresaData.produtos.reduce((acc, p) => acc + p.quantidade, 0);
        const ultimoAdicionado = EmpresaData.produtos[EmpresaData.produtos.length - 1];


        let statusFinanceiro = '';
        if (EmpresaData.financeiro.lucro < 0) {
            statusFinanceiro = `<p class="msg-erro">⚠️ Atenção: O estoque está operando com prejuízo estimado!</p>`;
        } else if (EmpresaData.financeiro.lucro === 0) {
            statusFinanceiro = `<p class="msg-alerta">Ponto de Equilíbrio Estimado.</p>`;
        } else {
            statusFinanceiro = `<p class="msg-sucesso">✅ Estoque operando com Lucratividade Alta!</p>`;
        }


        const cardProduto = `
            <div class="card-relatorio">
                <p class="msg-sucesso"><strong>📦 ${ultimoAdicionado.nome}</strong> adicionado com sucesso!</p>
                <p>Lote de ${ultimoAdicionado.quantidade} unidades adicionadas.</p>
                <p>Custo Unitário Média: ${formatarMoeda(ultimoAdicionado.valorUnidadeCompra)}</p>
                <p>Previsto Lucro neste Lote: ${formatarMoeda(ultimoAdicionado.lucroBrutoEstimado)}</p>
            </div>
        `;


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

    form.addEventListener('submit', recebeEventoForm);
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
    const btnUsuarios = document.querySelector('#btnUsuarios');
    const btnPermissoes = document.querySelector('#btnPermissoes');

    const boxInicio = document.querySelector('#boxInicio');
    const boxProdutos = document.querySelector('#boxProdutos');
    const boxVendas = document.querySelector('#boxVendas');
    const boxVerEstoque = document.querySelector('#boxVerEstoque');
    const boxCategorias = document.querySelector('#boxCategorias');
    const boxSaidaEstoque = document.querySelector('#boxSaidaEstoque');
    const boxGerenciamento = document.querySelector('#boxGerenciamento');
    const boxPermissoes = document.querySelector('#boxPermissoes');
    const listaEstoque = document.querySelector('#listaEstoque');
    const listaCategorias = document.querySelector('#listaCategorias');
    const dashboardContent = document.querySelector('#dashboardContent');

    const todosDropdowns = document.querySelectorAll('.dropdown > a');

    function applyAccessRules() {
        const user = getCurrentUser();
        const isVendedor = user && user.role === 'vendedor';
        const isGerente = user && user.role === 'gerente';


        const liProdutos = document.querySelector('a[href="#produtos"]')?.closest('li');
        const liEstoque = document.querySelector('a[href="#estoque"]')?.closest('li');
        const liGerenciamento = document.querySelector('a[href="#gerenciamento"]')?.closest('li');


        if (isVendedor) {

            document.querySelectorAll('.menu > ul > li').forEach(li => {
                if (!li.querySelector('#btnVendas') && !li.querySelector('#btnHistorico')) {
                    li.remove();
                }
            });


            if (boxInicio) boxInicio.style.display = 'none';
            if (boxProdutos) boxProdutos.style.display = 'none';
            if (boxVerEstoque) boxVerEstoque.style.display = 'none';
            if (boxCategorias) boxCategorias.style.display = 'none';
            if (boxSaidaEstoque) boxSaidaEstoque.style.display = 'none';
        }


        if (isGerente) {
            if (btnInicio) btnInicio.style.display = 'inline-block';
            if (liProdutos) liProdutos.style.display = 'block';
            if (liEstoque) liEstoque.style.display = 'block';
            if (liGerenciamento) liGerenciamento.style.display = 'block';
        }


        if (!user) {
            if (btnInicio) btnInicio.style.display = 'none';
            if (liProdutos) liProdutos.style.display = 'none';
            if (liEstoque) liEstoque.style.display = 'none';
            if (liGerenciamento) liGerenciamento.style.display = 'none';
        }


        applySalesFormUserContext();
    }

    function applySalesFormUserContext() {
        const vendedorVenda = document.querySelector('#vendedorVenda');
        const matriculaVendedor = document.querySelector('#matriculaVendedor');
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


    todosDropdowns.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();


            const parentLi = this.parentElement;
            const submenu = parentLi.querySelector('.submenu');

            document.querySelectorAll('.submenu.ativo').forEach(sub => {
                if (sub !== submenu) sub.classList.remove('ativo');
            });

            if (submenu) submenu.classList.toggle('ativo');
        });
    });


    function abrirFormulario(elementoAtivar) {
        const user = getCurrentUser();
        const isVendedor = user && user.role === 'vendedor';


        if (isVendedor && elementoAtivar !== boxVendas && elementoAtivar !== boxSaidaEstoque) {
            return;
        }


        if (boxInicio) boxInicio.style.display = 'none';
        if (boxProdutos) boxProdutos.style.display = 'none';
        if (boxVendas) boxVendas.style.display = 'none';
        if (boxVerEstoque) boxVerEstoque.style.display = 'none';
        if (boxCategorias) boxCategorias.style.display = 'none';
        if (boxSaidaEstoque) boxSaidaEstoque.style.display = 'none';
        if (boxGerenciamento) boxGerenciamento.style.display = 'none';
        if (boxPermissoes) boxPermissoes.style.display = 'none';


        document.querySelectorAll('.submenu.ativo').forEach(sub => sub.classList.remove('ativo'));


        if (elementoAtivar) {
            elementoAtivar.style.display = 'flex';
        }
    }


    if (btnInicio) {
        btnInicio.addEventListener('click', function (e) {
            e.preventDefault();
            renderDashboard();
            abrirFormulario(boxInicio);
        });
    }


    if (btnAddProduto) {
        btnAddProduto.addEventListener('click', function (e) {
            e.preventDefault();
            abrirFormulario(boxProdutos);
        });
    }


    if (btnVendas) {
        btnVendas.addEventListener('click', function (e) {
            e.preventDefault();
            atualizarSelectVendas();
            applySalesFormUserContext();
            abrirFormulario(boxVendas);
        });
    }


    if (btnHistorico) {
        btnHistorico.addEventListener('click', function (e) {
            e.preventDefault();
            renderHistoricoVendas();
            abrirFormulario(boxSaidaEstoque);
        });
    }


    if (btnUsuarios) {
        btnUsuarios.addEventListener('click', function (e) {
            e.preventDefault();
            renderListaUsuarios();
            abrirFormulario(boxGerenciamento);
        });
    }


    if (btnPermissoes) {
        btnPermissoes.addEventListener('click', function (e) {
            e.preventDefault();
            renderPermissoes();
            abrirFormulario(boxPermissoes);
        });
    }

    const btnSaidaEstoque = document.querySelector('#btnSaidaEstoque');



    if (btnVerEstoque) {
        btnVerEstoque.addEventListener('click', function (e) {
            e.preventDefault();
            renderTableEstoque();
            abrirFormulario(boxVerEstoque);
        });
    }


    if (btnCategorias) {
        btnCategorias.addEventListener('click', function (e) {
            e.preventDefault();
            renderCategorias();
            abrirFormulario(boxCategorias);
        });
    }


    const formSaida = document.querySelector('.formSaida');
    const selectProdutoVenda = document.querySelector('#selectProdutoVenda');
    const quantidadeVenda = document.querySelector('#quantidadeVenda');
    const descontoVenda = document.querySelector('#descontoVenda');
    const vendedorVenda = document.querySelector('#vendedorVenda');
    const matriculaVendedor = document.querySelector('#matriculaVendedor');
    const resultadoVenda = document.querySelector('.resultadoVenda');
    const historicoVendas = document.querySelector('#historicoVendas');

    function atualizarSelectVendas() {
        if (!selectProdutoVenda) return;
        selectProdutoVenda.innerHTML = '<option value="" disabled selected style="color: black;">Selecione um produto</option>';

        EmpresaData.produtos.forEach(p => {
            if (p.quantidade > 0) {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.style.color = "black";
                opt.textContent = `${p.nome} (Disponível: ${p.quantidade} un.) - R$ ${p.valorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                selectProdutoVenda.appendChild(opt);
            }
        });
    }

    function renderHistoricoVendas() {
        if (!historicoVendas) return;

        const user = getCurrentUser();
        const allLogsVenda = EmpresaData.logsVenda || [];

        if (user && user.role === 'gerente') {

            if (allLogsVenda.length === 0) {
                historicoVendas.innerHTML = '<p style="text-align: center; color: #a1a0a0; padding: 20px;">Nenhuma saída registrada ainda.</p>';
                return;
            }

            let html = '<h4 style="color:#ffaa00; margin-top:20px; border-bottom:1px solid rgba(255,170,0,0.3); padding-bottom:5px;">Saídas de Estoque (Vendas)</h4>';

            allLogsVenda.slice().reverse().forEach((v, idx) => {
                const dataStr = new Date(v.id).toLocaleString();
                const vendedor = v.vendedor || '—';
                const produto = v.nomeProduto || '—';
                const quantidade = v.quantidadeTrancionada || 0;

                html += `
                    <div style="background: rgba(255,255,255,0.05); padding: 14px; margin-top: 10px; border-radius: 8px; border-left: 4px solid #ffaa00;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <small style="color: #a1a0a0;">Data: ${dataStr}</small>
                            <strong style="color: #fff;">Vendedor: ${vendedor}</strong>
                        </div>
                        <p style="margin: 6px 0; font-size: 0.95rem;">
                            <strong style="color:#fff">${quantidade}x ${produto}</strong>
                        </p>
                    </div>
                `;
            });

            historicoVendas.innerHTML = html;
            return;
        }


        const logsVenda = (user && user.role === 'vendedor')
            ? allLogsVenda.filter(v => v.matricula === user.matricula)
            : allLogsVenda;

        if (logsVenda.length === 0) {
            historicoVendas.innerHTML = '<p style="text-align: center; color: #a1a0a0; padding: 20px;">Ainda não há vendas registradas para este usuário.</p>';
            return;
        }

        const hoje = new Date().toDateString();
        const vendasHoje = logsVenda.filter(v => new Date(v.id).toDateString() === hoje);
        const totalHoje = vendasHoje.reduce((sum, v) => sum + (v.receitaLiquida || 0), 0);

        let html = `
            <div style="background: rgba(255,255,255,0.05); padding: 14px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #00f529;">
                <h4 style="color: #00f529; margin-bottom: 6px;">Suas vendas hoje</h4>
                <p style="margin: 0; color: #fff;">Total de vendas: <strong>${vendasHoje.length}</strong></p>
                <p style="margin: 4px 0 0; color: #a1a0a0;">Receita líquida: <strong>R$ ${totalHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
            </div>
            <h4 style="color:#ffaa00; margin-top:20px; border-bottom:1px solid rgba(255,170,0,0.3); padding-bottom:5px;">Últimas Vendas Realizadas</h4>
        `;

        logsVenda.slice().reverse().forEach((v, idx) => {
            const dataStr = new Date(v.id).toLocaleString();
            const receitaBruta = typeof v.receitaBruta === 'number' ? v.receitaBruta : (typeof v.receitaVenda === 'number' ? v.receitaVenda : 0);
            const descontoValor = typeof v.descontoValor === 'number' ? v.descontoValor : 0;
            const descontoPercentual = typeof v.descontoPercentual === 'number' ? v.descontoPercentual : 0;
            const receitaLiquida = typeof v.receitaLiquida === 'number' ? v.receitaLiquida : receitaBruta - descontoValor;
            const lucroEmpresa = typeof v.lucroEmpresa === 'number' ? v.lucroEmpresa : 0;
            const comissaoVendedor = typeof v.comissaoVendedor === 'number' ? v.comissaoVendedor : 0;
            const vendedor = v.vendedor || '—';
            const matricula = v.matricula || '—';

            html += `
                <div style="background: rgba(255,255,255,0.05); padding: 14px; margin-top: 10px; border-radius: 8px; border-left: 4px solid #ffaa00;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <small style="color: #a1a0a0;">Data: ${dataStr}</small>
                        <strong style="color: #fff;">Vendedor: ${vendedor} (Matr.: ${matricula})</strong>
                    </div>

                    <p style="margin: 6px 0; font-size: 0.95rem;">
                        <strong style="color:#fff">${v.quantidadeTrancionada}x ${v.nomeProduto}</strong>
                    </p>

                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-top: 6px;">
                        <span>Receita Bruta: <strong style="color:#00f529">R$ ${receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                        <span>Desconto: <strong style="color:#ff6b6b">R$ ${descontoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${descontoPercentual.toFixed(2)}%)</strong></span>
                    </div>

                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-top: 4px;">
                        <span>Receita Líquida: <strong style="color:#00f529">R$ ${receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                        <span>Lucro Empresa: <strong style="color:#00d623">R$ ${lucroEmpresa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                    </div>

                    <div style="text-align: right; margin-top: 4px; font-size: 0.85rem;">
                        Comissão: <strong style="color:#ffa500">R$ ${comissaoVendedor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                </div>
            `;
        });

        historicoVendas.innerHTML = html;
    }


    function renderDashboard() {
        if (!dashboardContent) return;

        const user = getCurrentUser();
        if (user && user.role === 'vendedor') {
            dashboardContent.innerHTML = '<p style="text-align: center; color: #a1a0a0; padding: 20px;">O dashboard está disponível apenas para gestores.</p>';
            return;
        }


        const produtosBaixoEstoque = EmpresaData.produtos.filter(p => p.quantidade <= 10);

        const logsVenda = EmpresaData.logsVenda || [];
        const hoje = new Date().toDateString();


        const vendasHoje = logsVenda.filter(log => new Date(log.id).toDateString() === hoje);


        const produtoVendas = {};
        logsVenda.forEach(log => {
            if (!produtoVendas[log.nomeProduto]) produtoVendas[log.nomeProduto] = 0;
            produtoVendas[log.nomeProduto] += log.quantidadeTrancionada;
        });
        const produtosMaisVendidos = Object.entries(produtoVendas).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const produtosMenosVendidos = Object.entries(produtoVendas).sort((a, b) => a[1] - b[1]).slice(0, 5);


        const vendedorVendas = {};
        logsVenda.forEach(log => {
            const key = log.vendedor + ' (' + (log.matricula || '—') + ')';
            if (!vendedorVendas[key]) vendedorVendas[key] = 0;
            vendedorVendas[key] += log.receitaLiquida || 0;
        });
        const vendedorTop = Object.entries(vendedorVendas).sort((a, b) => b[1] - a[1])[0];

        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">';


        if (produtosBaixoEstoque.length > 0) {
            html += `
                <div style="grid-column: 1 / -1; background: rgba(255,0,0,0.1); padding: 20px; border-radius: 8px; border-left: 4px solid #ff0000;">
                    <h4 style="color: #ff0000; margin-bottom: 10px;">⚠️ Alerta de Estoque Baixo</h4>
                    <p style="color: #fff; margin-bottom: 10px;">Os seguintes produtos estão com estoque baixo (10 ou menos unidades):</p>
                    <ul style="list-style: none; padding: 0; color: #fff;">
            `;
            produtosBaixoEstoque.forEach(produto => {
                html += `<li style="margin-bottom: 5px;">${produto.nome}: ${produto.quantidade} unidades restantes</li>`;
            });
            html += '</ul></div>';
        }


        html += `
            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #00f529;">
                <h4 style="color: #00f529; margin-bottom: 10px;">Vendas de Hoje</h4>
                <p style="font-size: 1.2rem; color: #fff;">${vendasHoje.length} vendas realizadas</p>
                <p style="font-size: 1rem; color: #a1a0a0;">Total: R$ ${vendasHoje.reduce((sum, v) => sum + (v.receitaLiquida || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
        `;


        html += `
            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #ffaa00;">
                <h4 style="color: #ffaa00; margin-bottom: 10px;">Produtos Mais Vendidos</h4>
                <ul style="list-style: none; padding: 0;">
        `;
        produtosMaisVendidos.forEach(([produto, qtd]) => {
            html += `<li style="margin-bottom: 5px; color: #fff;">${produto}: ${qtd} unidades</li>`;
        });
        html += '</ul></div>';


        html += `
            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #ff6b6b;">
                <h4 style="color: #ff6b6b; margin-bottom: 10px;">Produtos Menos Vendidos</h4>
                <ul style="list-style: none; padding: 0;">
        `;
        produtosMenosVendidos.forEach(([produto, qtd]) => {
            html += `<li style="margin-bottom: 5px; color: #fff;">${produto}: ${qtd} unidades</li>`;
        });
        html += '</ul></div>';


        if (vendedorTop) {
            html += `
                <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #ffa500;">
                    <h4 style="color: #ffa500; margin-bottom: 10px;">Vendedor Destaque</h4>
                    <p style="font-size: 1.1rem; color: #fff;">${vendedorTop[0]}</p>
                    <p style="font-size: 1rem; color: #a1a0a0;">Receita: R$ ${vendedorTop[1].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            `;
        }

        html += '</div>';
        dashboardContent.innerHTML = html;
    }

    if (formSaida) {
        formSaida.addEventListener('submit', function (e) {
            e.preventDefault();
            resultadoVenda.innerHTML = '';

            const produtoId = Number(selectProdutoVenda.value);
            const qtd = Number(quantidadeVenda.value);
            const descontoPct = Number(descontoVenda?.value) || 0;

            const currentUser = getCurrentUser();
            const vendedor = (currentUser && currentUser.role === 'vendedor')
                ? currentUser.nome
                : (vendedorVenda?.value.trim() || '');
            const matricula = (currentUser && currentUser.role === 'vendedor')
                ? currentUser.matricula
                : (matriculaVendedor?.value.trim() || '');

            if (!produtoId || isNaN(qtd) || qtd <= 0 || isNaN(descontoPct) || descontoPct < 0 || descontoPct > 100 || !vendedor || !matricula) {
                resultadoVenda.innerHTML = `<p class="msg-erro">Selecione o produto, informe quantidade válida, desconto entre 0% e 100%, nome do vendedor e matrícula.</p>`;
                return;
            }

            const produtoIndex = EmpresaData.produtos.findIndex(p => p.id === produtoId);
            if (produtoIndex === -1) return;

            const produto = EmpresaData.produtos[produtoIndex];

            if (qtd > produto.quantidade) {
                resultadoVenda.innerHTML = `<p class="msg-erro">Quantidade solicitada (${qtd}) excede o saldo em estoque (${produto.quantidade})!</p>`;
                return;
            }


            produto.quantidade -= qtd;


            const receitaBruta = produto.valorVenda * qtd;
            const descontoValor = receitaBruta * (descontoPct / 100);
            const receitaLiquida = receitaBruta - descontoValor;
            const custoTotal = produto.valorUnidadeCompra * qtd;
            const lucroEmpresa = receitaLiquida - custoTotal;
            const comissaoVendedor = receitaLiquida * 0.05;


            if (!EmpresaData.logsVenda) EmpresaData.logsVenda = [];

            const log = {
                id: Date.now(),
                nomeProduto: produto.nome,
                quantidadeTrancionada: qtd,
                vendedor: vendedor,
                matricula: matricula,
                descontoPercentual: descontoPct,
                descontoValor: descontoValor,
                receitaBruta: receitaBruta,
                receitaLiquida: receitaLiquida,
                custoAproximadoTotalVenda: custoTotal,
                lucroEmpresa: lucroEmpresa,
                comissaoVendedor: comissaoVendedor
            };

            EmpresaData.logsVenda.push(log);




            salvarBancoDeDados();


            resultadoVenda.innerHTML = `<p class="msg-sucesso">✅ Venda registrada com sucesso. Vendedor: <strong>${vendedor}</strong> | Receita líquida: R$ ${receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Lucro: R$ ${lucroEmpresa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Comissão: R$ ${comissaoVendedor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>`;


            atualizarSelectVendas();
            renderHistoricoVendas();


            quantidadeVenda.value = '';
            if (descontoVenda) descontoVenda.value = '';
            if (vendedorVenda) vendedorVenda.value = '';
        });
    }


    renderHistoricoVendas();


    function renderTableEstoque() {
        if (!listaEstoque) return;

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
                    </tr>
                </thead>
                <tbody>
        `;


        EmpresaData.produtos.forEach((p, idx) => {
            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); transition: background 0.2s;">
                    <td style="padding: 12px; color: #a1a0a0;">#${idx + 1}</td>
                    <td style="padding: 12px;"><span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">${p.categoria}</span></td>
                    <td style="padding: 12px; font-weight: bold;">${p.nome}</td>
                    <td style="padding: 12px;">${p.quantidade} un.</td>
                    <td style="padding: 12px; color: #00f529;">R$ ${p.valorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        listaEstoque.innerHTML = html;
    }


    function renderCategorias() {
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

        EmpresaData.produtos.forEach(p => {
            if (categoriasMap[p.categoria]) {
                categoriasMap[p.categoria].push(p);
            } else {
                categoriasMap['Outros'].push(p);
            }
        });

        let html = '';

        for (const [catName, prods] of Object.entries(categoriasMap)) {
            if (prods.length > 0) {
                html += `<h4 style="color: #00d0ff; margin-top: 20px; border-bottom: 1px solid rgba(0, 208, 255, 0.3); padding-bottom: 5px;">📂 ${catName} <span style="color:#a1a0a0; font-size:0.8rem;">(${prods.length} itens)</span></h4>`;
                html += `<ul style="list-style: none; padding: 0; margin-top: 10px;">`;
                prods.forEach(p => {
                    html += `
                        <li style="background: rgba(255,255,255,0.05); padding: 10px; margin-bottom: 8px; border-radius: 6px; border-left: 3px solid #00f529; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: #fff; display:block;">${p.nome}</strong>
                                <small style="color: #a1a0a0;">Estoque: ${p.quantidade} un.</small>
                            </div>
                            <div style="color: #00f529; font-weight:bold;">
                                R$ ${p.valorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </li>
                    `;
                });
                html += `</ul>`;
            }
        }

        if (html === '') {
            html = '<p style="text-align: center; color: #a1a0a0; padding: 20px;">Não há produtos classificados.</p>';
        }

        listaCategorias.innerHTML = html;
    }




    document.addEventListener('click', function (e) {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.submenu.ativo').forEach(sub => sub.classList.remove('ativo'));
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    initAuthentication();
    initModuloProdutos();
    initMenuNavigation();
});


document.addEventListener('click', function (e) {
    if (e.target.id === 'btnAddUsuario') {
        adicionarUsuario();
    }
});

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

    const currentUser = getCurrentUser();

    function applyUserUI() {
        const logged = getCurrentUser();
        if (!logged) {
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
            btnLogout.addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
        }


        initMenuNavigation();
    }

    function doLogin(event) {
        event.preventDefault();
        const matricula = loginMatricula.value.trim();
        const senha = loginSenha.value.trim();

        if (!matricula || !senha) {
            loginError.textContent = 'Informe matrícula e senha.';
            loginError.style.display = 'block';
            return;
        }

        const found = getSavedUsers().find(u => u.matricula === matricula && u.senha === senha);
        if (!found) {
            loginError.textContent = 'Matrícula ou senha inválidos.';
            loginError.style.display = 'block';
            return;
        }

        if (found.status === 'pendente') {
            loginError.textContent = 'Seu cadastro ainda está pendente de aprovação pelo gerente.';
            loginError.style.display = 'block';
            return;
        }

        if (found.status === 'reprovado') {
            loginError.textContent = 'Sentimos muito, mas não será possível prosseguir, quem sabe em uma próxima oportunidade';
            loginError.style.display = 'block';
            return;
        }

        alert('Seja bem vindo ao time');

        setCurrentUser(found);
        loginError.style.display = 'none';
        loginMatricula.value = '';
        loginSenha.value = '';
        applyUserUI();
    }

    if (loginForm) {
        loginForm.addEventListener('submit', doLogin);
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

    function doRegister(event) {
        event.preventDefault();
        const nome = registerNome.value.trim();
        const matricula = registerMatricula.value.trim();
        const senha = registerSenha.value.trim();

        if (!nome || !matricula || !senha) {
            registerError.textContent = 'Preencha todos os campos.';
            registerError.style.display = 'block';
            return;
        }

        const currentUsers = getSavedUsers();
        if (currentUsers.find(u => u.matricula === matricula)) {
            registerError.textContent = 'Matrícula já está em uso.';
            registerError.style.display = 'block';
            return;
        }

        const newUser = { matricula, senha, nome, role: 'vendedor', status: 'pendente' };
        currentUsers.push(newUser);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(currentUsers));

        registerError.style.display = 'none';
        registerNome.value = '';
        registerMatricula.value = '';
        registerSenha.value = '';

        alert('Cadastro realizado com sucesso. Seu acesso está pendente de aprovação.');
        showLoginLink.click();
    }

    if (registerForm) {
        registerForm.addEventListener('submit', doRegister);
    }

    applyUserUI();
}

