// ==========================================
// MÓDULO DE GASTOS
// ==========================================
function initModuloGastos() {
    const formGasto = document.querySelector('.formGastos');
    const resultadoGasto = document.querySelector('.resultadoGasto');

    // Função auxiliar de formatação BRL
    const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    function recebeEventoFormGasto(evento) {
        evento.preventDefault();
        resultadoGasto.innerHTML = '';

        const prejuizos = Number(formGasto.querySelector('.prejuizos').value) || 0;
        const investimentos = Number(formGasto.querySelector('.investimentos').value) || 0;
        const descontos = Number(formGasto.querySelector('.desconto').value) || 0;

        if (isNaN(prejuizos) || isNaN(investimentos) || isNaN(descontos) || prejuizos < 0 || investimentos < 0 || descontos < 0) {
            resultadoGasto.innerHTML = `<p class="msg-erro">⚠️ Insira valores válidos para todos os campos numéricos!</p>`;
            return;
        }

        // SALVA DADOS NO STATE CONFIGURADO NO SCRIPT_1 E PERSISTE
        EmpresaData.gastos.push({
            id: Date.now(),
            prejuizos: prejuizos,
            investimentos: investimentos,
            descontos: descontos
        });

        // Chamada da função global (criada no script_1.js)
        salvarBancoDeDados();

        // CALCULOS TOTAIS (Usando || 0 para evitar erro de NaN se o array estiver vazio)
        const financeiroInvestimento = EmpresaData.financeiro.investimento || 0;
        const financeiroPrejuizo = EmpresaData.financeiro.prejuizo || 0;

        const totalInvestimentos = investimentos + financeiroInvestimento;
        const totalPrejuizos = prejuizos + descontos + financeiroPrejuizo;
        const balancoParcial = totalInvestimentos - totalPrejuizos;

        // Feedback de Status Financeiro
        let statusFinanceiro = '';
        if (totalPrejuizos > totalInvestimentos) {
            statusFinanceiro = `<p class="msg-erro">⚠️ Alerta Vermelho! As Perdas Locais ultrapassaram os Investimentos.</p>`;
        } else if (totalInvestimentos > totalPrejuizos) {
            statusFinanceiro = `<p class="msg-sucesso">✅ Situação Financeira Estável e Crescente.</p>`;
        } else {
            statusFinanceiro = `<p class="msg-alerta">📉 Balanço Neutro: Ganhos propostos cobrem prejuízos com exatidão.</p>`;
        }

        // Card do Relatório de Custos
        const cardGasto = `
            <div class="card-relatorio">
                <p><strong>CUSTOS REGISTRADOS COM SUCESSO</strong></p>
                <p>Ocorrências Adicionadas Localmente:</p>
                <p style="color:#ffaa00;">Prejuízos Reportados: ${formatarMoeda(prejuizos)}</p>
                <p style="color:#00f529;">Novos Investimentos: ${formatarMoeda(investimentos)}</p>
                <p style="color:#ff4c4c;">Descontos Concedidos: ${formatarMoeda(descontos)}</p>
                <br>
                <p><strong>Balanço de Fluxo Corrente: ${formatarMoeda(balancoParcial)}</strong></p>
            </div>
        `;

        resultadoGasto.innerHTML = statusFinanceiro + cardGasto;
        renderHistoricoGastos();
    }

    function renderHistoricoGastos() {
        const divHistory = document.querySelector('#historicoGastos');
        if (!divHistory) return;

        if (EmpresaData.gastos.length === 0) {
            divHistory.innerHTML = '';
            return;
        }

        let html = `
            <table style="width:100%; border-collapse: collapse; text-align: left; margin-top: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;">
                <thead>
                    <tr style="border-bottom: 2px solid #00d0ff;">
                        <th style="padding: 12px; color: #00d0ff;">Data / Hora</th>
                        <th style="padding: 12px; color: #00f529;">Investimento</th>
                        <th style="padding: 12px; color: #ffaa00;">Prejuízo</th>
                        <th style="padding: 12px; color: #ff4c4c;">Desconto</th>
                    </tr>
                </thead>
                <tbody>
        `;

        EmpresaData.gastos.slice().reverse().forEach((g, idx) => {
            const dataStr = new Date(g.id).toLocaleString();
            const desc = g.descontos || 0;
            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); transition: background 0.2s;">
                    <td style="padding: 12px; font-size: 0.85rem; color: #a1a0a0;">${dataStr}</td>
                    <td style="padding: 12px; color: #00f529;">R$ ${g.investimentos.toFixed(2)}</td>
                    <td style="padding: 12px; color: #ffaa00;">R$ ${g.prejuizos.toFixed(2)}</td>
                    <td style="padding: 12px; color: #ff4c4c;">R$ ${desc.toFixed(2)}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';

        divHistory.innerHTML = html;
    }

    formGasto.addEventListener('submit', recebeEventoFormGasto);

    // Renderiza ao carregar a página para quem já tem gastos salvos
    renderHistoricoGastos();
}

// Inicializar Módulos do Script 2
document.addEventListener('DOMContentLoaded', () => {
    initModuloGastos();
});
