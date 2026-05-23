import { db, save } from "./database.js";
import { sendManualWA, sendCustomWA, conectarWhatsAppPorCodigo } from "./api.js";

export let isRegisterMode = false;
let financeChart;
let appsDonutChart;
let planosDonutChart; 

function formatarDataBR_ISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// ==========================================
// FUNÇÃO DE CONFIRMAÇÃO MODERNA (SWEETALERT2)
// ==========================================
window.meuConfirm = function(titulo, mensagem, acaoSim, icone = 'warning') {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: titulo,
            text: mensagem,
            icon: icone,
            showCancelButton: true,
            confirmButtonColor: '#9333ea', 
            cancelButtonColor: '#374151',  
            confirmButtonText: 'Confirmar',
            cancelButtonText: 'Cancelar',
            background: '#16162d',
            color: '#ffffff'
        }).then((result) => {
            if (result.isConfirmed && typeof acaoSim === 'function') {
                acaoSim();
            }
        });
    } else {
        if (confirm(titulo + "\n\n" + mensagem)) {
            if (typeof acaoSim === 'function') acaoSim();
        }
    }
};

export function openModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
export function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
export function checkCustomDays(v) { const el = document.getElementById('plan_dias_custom'); if (el) el.classList.toggle('hidden', v !== 'custom'); }

export function controlarSidebarGeral() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    if (!sidebar || !mainContent) return;
    if (window.innerWidth >= 1024) {
        sidebar.classList.toggle('lg:hidden');
        mainContent.classList.toggle('lg:ml-64');
    } else {
        sidebar.classList.toggle('-translate-x-full');
    }
}

export function switchTab(tab) {
    const bottomButtons = document.querySelectorAll('#bottom-nav button');
    bottomButtons.forEach(btn => {
        const isCurrent = btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tab);
        if (isCurrent) {
            btn.classList.remove('text-gray-400');
            btn.classList.add('text-purple-400');
        } else {
            btn.classList.remove('text-purple-400');
            btn.classList.add('text-gray-400');
        }
    });

    document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.add('hidden'));
    if (document.getElementById('tab-' + tab)) document.getElementById('tab-' + tab).classList.remove('hidden');
    
    document.querySelectorAll('.sidebar .nav-link').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar .nav-link').forEach(l => { 
        if (l.getAttribute('onclick') && l.getAttribute('onclick').includes(tab)) l.classList.add('active'); 
    });
    
    if (tab === 'clientes') renderClientes();
    if (tab === 'faturas') renderFaturas();
    if (tab === 'planos') renderPlanos();
    if (tab === 'apps') renderApps();
    if (tab === 'configuracoes') renderConfig();
    if (tab === 'dashboard') updateDashboard();

    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
        sidebar.classList.add('-translate-x-full');
    }

    localStorage.setItem('w3gestor_aba_ativa', tab);
}

export function toggleAuthMode() { 
    isRegisterMode = !isRegisterMode; 
    document.getElementById('auth-title').innerText = isRegisterMode ? "Criar Conta Local" : "Aceder ao Painel"; 
    document.getElementById('btn-auth-action').innerText = isRegisterMode ? "Registar" : "Entrar"; 
}

export function toggleFiltrosGaveta(open) {
    const gaveta = document.getElementById('gaveta-filtros');
    const fundo = document.getElementById('fundo-gaveta');
    if (!gaveta || !fundo) return;
    if (open) {
        gaveta.classList.remove('hidden');
        fundo.classList.remove('hidden');
        setTimeout(() => {
            gaveta.classList.remove('translate-y-full');
            gaveta.classList.add('translate-y-0');
        }, 10);
    } else {
        gaveta.classList.remove('translate-y-0');
        gaveta.classList.add('translate-y-full');
        fundo.classList.add('hidden');
        setTimeout(() => { if (window.innerWidth < 1024) gaveta.classList.add('hidden'); }, 300);
    }
}

export function alternarAbasAuth(irParaCadastro) {
    const wrapLogin = document.getElementById('wrapper-login');
    const wrapRegister = document.getElementById('wrapper-register');
    if (!wrapLogin || !wrapRegister) return;
    if (irParaCadastro) {
        wrapLogin.classList.add('hidden');
        wrapRegister.classList.remove('hidden');
    } else {
        wrapRegister.classList.add('hidden');
        wrapLogin.classList.remove('hidden');
    }
}

// ==========================================
// EXPOSIÇÃO GLOBAL DOS FILTROS DO DASHBOARD
// ==========================================
window.filtroDashboardAtual = 'mes'; 

window.filtrarDashboard = function(periodo) {
    window.filtroDashboardAtual = periodo;
    
    // Atualiza as cores dos botões
    ['hoje', '7dias', 'mes', 'tudo'].forEach(p => {
        const btn = document.getElementById(`btn-dash-${p}`);
        if (!btn) return;
        
        if (p === periodo) {
            btn.className = "px-4 py-1.5 rounded-full text-[10px] font-bold bg-purple-600 border border-purple-500 text-white transition-all whitespace-nowrap uppercase tracking-wider shadow-lg shadow-purple-500/20";
        } else {
            btn.className = "px-4 py-1.5 rounded-full text-[10px] font-bold border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap uppercase tracking-wider";
        }
    });

    if (typeof updateDashboard === 'function') {
        updateDashboard();
    }
};

export function initApp() {
    rodarAutomacaoDiaria(); 
    const abaSalva = localStorage.getItem('w3gestor_aba_ativa') || 'dashboard';
    switchTab(abaSalva);

    // Força o filtro do mês ao iniciar o app para mostrar os botões corretos
    if(window.filtrarDashboard) window.filtrarDashboard('mes');
    
    renderPlanos(); renderApps(); renderClientes(); renderFaturas(); renderConfig();
    gerarFaturasAutomaticas();

    const inputWhatsapp = document.getElementById('cli_whatsapp');
    if (inputWhatsapp) {
        inputWhatsapp.addEventListener('input', (e) => {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });
    }
}

export function gerarFaturasAutomaticas() {
    if (!db.invoices_pending) db.invoices_pending = [];
    
    const hojeObj = new Date();
    hojeObj.setHours(0,0,0,0);
    let gerouAlgo = false;

    db.clientes.forEach(cli => {
        const [y, m, d] = cli.vencimento.split('-').map(Number);
        const cliVencObj = new Date(y, m - 1, d, 12, 0, 0);
        
        const diffDias = Math.ceil((cliVencObj.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDias <= (db.config.aviso_dias || 3)) {
            const jaTem = db.invoices_pending.find(i => i.cliId == cli.id && i.vencimento === cli.vencimento);
            if (!jaTem) {
                const plano = db.planos.find(p => p.id == cli.plano_id) || { valor: 0, nome: 'Plano' };
                db.invoices_pending.push({
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    cliId: cli.id,
                    cliente: cli.nome,
                    plano: plano.nome,
                    vencimento: cli.vencimento,
                    valor: plano.valor,
                    data_geracao: new Date().toLocaleDateString('pt-BR')
                });
                gerouAlgo = true;
            }
        }
    });

    if (gerouAlgo) {
        save();
        renderFaturas();
    }
}

export function updateDashboard() {
    if (!db.clientes) db.clientes = [];
    if (!db.faturas) db.faturas = [];
    const config = db.config || { aviso_dias: 3 };
    
    // ==========================================
    // 1. MOTOR DE FILTROS DE DATA (Para Bruto e Lucro)
    // ==========================================
    const periodo = window.filtroDashboardAtual || 'mes';
    const dataHoje = new Date();
    dataHoje.setHours(0,0,0,0);

    const faturasFiltradas = db.faturas.filter(f => {
        if (periodo === 'tudo') return true;
        
        const partes = f.data_pgto.split('/');
        if(partes.length !== 3) return true; 
        
        const dataFatura = new Date(partes[2], partes[1] - 1, partes[0]);
        dataFatura.setHours(0,0,0,0);

        if (periodo === 'hoje') {
            return dataFatura.getTime() === dataHoje.getTime();
        } else if (periodo === '7dias') {
            const seteDiasAtras = new Date(dataHoje);
            seteDiasAtras.setDate(dataHoje.getDate() - 7);
            return dataFatura >= seteDiasAtras && dataFatura <= dataHoje;
        } else if (periodo === 'mes') {
            return dataFatura.getMonth() === dataHoje.getMonth() && dataFatura.getFullYear() === dataHoje.getFullYear();
        }
        return true;
    });

    let bruto = 0, lucro = 0;
    faturasFiltradas.forEach(f => {
        bruto += (f.valor || 0);
        lucro += (f.lucro || 0);
    });

    // ==========================================
    // 2. CÁLCULO DA ESTIMATIVA LÍQUIDA (MÊS ATUAL)
    // ==========================================
    let lucroRealizadoNesteMes = 0;
    db.faturas.forEach(f => {
        const partes = f.data_pgto.split('/');
        if(partes.length === 3) {
            const dataFatura = new Date(partes[2], partes[1] - 1, partes[0]);
            if (dataFatura.getMonth() === dataHoje.getMonth() && dataFatura.getFullYear() === dataHoje.getFullYear()) {
                lucroRealizadoNesteMes += (f.lucro || 0);
            }
        }
    });

    let lucroPendenteNesteMes = 0;
    const hojeIso = new Date().toISOString().split('T')[0];
    const anoAtual = dataHoje.getFullYear();
    const mesAtual = dataHoje.getMonth();
    const ultimoDiaDoMesIso = new Date(anoAtual, mesAtual + 1, 0).toISOString().split('T')[0];

    const atrasadosCount = db.clientes.filter(c => c.vencimento <= hojeIso).length;

    db.clientes.forEach(cli => {
        const diffDias = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));
        if (cli.vencimento <= ultimoDiaDoMesIso && diffDias >= -20) {
            const plano = (db.planos || []).find(p => p.id == cli.plano_id) || { valor: 0, custo: 0 };
            lucroPendenteNesteMes += ((plano.valor || 0) - (plano.custo || 0));
        }
    });

    const previsaoLucroLiquido = lucroRealizadoNesteMes + lucroPendenteNesteMes;

    // ==========================================
    // 3. ATUALIZA OS CARTÕES SUPERIORES
    // ==========================================
    if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = db.clientes.length;
    if (document.getElementById('stat-bruto')) document.getElementById('stat-bruto').innerText = `R$ ${bruto.toFixed(2)}`;
    if (document.getElementById('stat-lucro')) document.getElementById('stat-lucro').innerText = `R$ ${lucro.toFixed(2)}`;
    if (document.getElementById('stat-previsao')) document.getElementById('stat-previsao').innerText = `R$ ${previsaoLucroLiquido.toFixed(2)}`;
    if (document.getElementById('stat-atrasados')) document.getElementById('stat-atrasados').innerText = atrasadosCount;

    // ==========================================
    // 4. RESTAURA A LISTA DE VENCIMENTOS E OS GRÁFICOS
    // ==========================================
    const list = document.getElementById('alerts-list');
    if (list) {
        list.innerHTML = '';
        db.clientes.sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(cli => {
            const diff = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));
            if (diff <= config.aviso_dias && diff >= -20) {
                list.innerHTML += `
                <div class="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 shadow-inner rounded-xl mb-2">
                    <div class="min-w-0 pr-2">
                        <p class="text-[11px] text-white font-black uppercase tracking-tight truncate">${cli.nome}</p>
                        <div class="flex items-center gap-1.5 mt-1">
                            <span class="text-[9px] text-gray-400 font-mono">${cli.vencimento.split('-').reverse().join('/')}</span>
                            <span class="${diff <= 0 ? 'text-red-400 bg-red-500/10' : 'text-yellow-500 bg-yellow-500/10'} rounded text-[8px] font-black px-1.5 py-0.5 uppercase">${diff <= 0 ? 'Atrasado' : 'Em ' + diff + ' d'}</span>
                        </div>
                    </div>
                    <div class="flex gap-1 shrink-0">
                        <button onclick="gerarFaturaManual(${cli.id})" title="Gerar Fatura" class="w-7 h-7 flex items-center justify-center bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg text-xs hover:bg-yellow-500 hover:text-black transition"><i class="fas fa-file-invoice-dollar"></i></button>
                        <button onclick="sendManualWA(${cli.id}, 'renew')" class="w-7 h-7 flex items-center justify-center bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-xs hover:bg-purple-500 hover:text-white transition"><i class="fab fa-whatsapp"></i></button>
                    </div>
                </div>`;
            }
        });
        
        if (list.innerHTML === '') {
            list.innerHTML = `<div class="p-2 text-center text-gray-500 text-xs italic w-full">Nenhum vencimento crítico.</div>`;
        }
        
        renderChartEvolucao();
        renderChartAppsDonut();
        renderChartPlanosDonut();
    }
}

export function renderChartEvolucao() {
    const el = document.querySelector("#chart-financeiro");
    if (!el || !window.ApexCharts) return;
    const faturas = db.faturas || [];
    const dadosRecentes = faturas.slice(0, 7).reverse();
    const options = {
        series: [{ name: 'Faturamento Diário', data: dadosRecentes.map(f => f.lucro || 0) }],
        chart: { type: 'area', height: '100%', toolbar: { show: false }, background: 'transparent' },
        theme: { mode: 'dark' },
        stroke: { curve: 'smooth', width: 2.5 },
        colors: ['#a855f7'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.02 } },
        xaxis: { categories: dadosRecentes.map(f => f.data_pgto ? f.data_pgto.slice(0, 5) : "") },
        dataLabels: { enabled: false }
    };
    if (financeChart) financeChart.destroy();
    financeChart = new ApexCharts(el, options);
    financeChart.render();
}

export function renderChartAppsDonut() {
    const el = document.querySelector("#chart-apps-donut");
    if (!el || !window.ApexCharts) return;
    const clientes = db.clientes || [];
    const apps = db.apps || [];
    const contagem = {};
    apps.forEach(a => { contagem[a.nome] = 0; });
    clientes.forEach(c => {
        const appObj = apps.find(a => a.id == c.app_id);
        if (appObj) contagem[appObj.nome] = (contagem[appObj.nome] || 0) + 1;
    });

    const labelsArray = Object.keys(contagem).length > 0 ? Object.keys(contagem) : ["Sem Clientes"];
    const options = {
        series: Object.values(contagem).length > 0 ? Object.values(contagem) : [0],
        labels: labelsArray,
        chart: { 
            type: 'donut', height: '100%', background: 'transparent',
            events: {
                dataPointSelection: function(event, chartContext, config) {
                    window.abrirModalFiltroGrafico('app', labelsArray[config.dataPointIndex]);
                }
            }
        },
        theme: { mode: 'dark' },
        colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
        stroke: { show: false },
        legend: { position: 'right', fontSize: '10px', labels: { colors: '#9ca3af' } },
        dataLabels: { enabled: false }
    };

    if (appsDonutChart) appsDonutChart.destroy();
    appsDonutChart = new ApexCharts(el, options);
    appsDonutChart.render();
}

export function renderChartPlanosDonut() {
    const el = document.querySelector("#chart-planos-donut");
    if (!el || !window.ApexCharts) return;
    const clientes = db.clientes || [];
    const planos = db.planos || [];
    const contagem = {};
    planos.forEach(p => { contagem[p.nome] = 0; });
    clientes.forEach(c => {
        const pObj = planos.find(p => p.id == c.plano_id);
        if (pObj) contagem[pObj.nome] = (contagem[pObj.nome] || 0) + 1;
    });

    const labelsArray = Object.keys(contagem).length > 0 ? Object.keys(contagem) : ["Sem Clientes"];
    const options = {
        series: Object.values(contagem).length > 0 ? Object.values(contagem) : [0],
        labels: labelsArray,
        chart: { 
            type: 'donut', height: '100%', background: 'transparent',
            events: {
                dataPointSelection: function(event, chartContext, config) {
                    window.abrirModalFiltroGrafico('plano', labelsArray[config.dataPointIndex]);
                }
            }
        },
        theme: { mode: 'dark' },
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7'],
        stroke: { show: false },
        legend: { position: 'right', fontSize: '10px', labels: { colors: '#9ca3af' } },
        dataLabels: { enabled: false }
    };

    if (planosDonutChart) planosDonutChart.destroy();
    planosDonutChart = new ApexCharts(el, options);
    planosDonutChart.render();
}

export function gerarFaturaManual(cliId) {
    const cli = db.clientes.find(c => c.id == cliId);
    if (!cli) return;
    
    const plano = db.planos.find(p => p.id == cli.plano_id) || { valor: 0, nome: "Plano Genérico" };
    
    if (!db.invoices_pending) db.invoices_pending = [];

    const jaTem = db.invoices_pending.find(i => i.cliId == cli.id && i.vencimento === cli.vencimento);
    if (jaTem) {
        showNotify('Aviso', 'A fatura para este cliente já está nas Cobranças em Aberto.', 'warning');
        switchTab('faturas');
        return;
    }

    db.invoices_pending.push({
        id: Date.now() + Math.floor(Math.random() * 10000),
        cliId: cli.id,
        cliente: cli.nome,
        plano: plano.nome,
        vencimento: cli.vencimento,
        valor: plano.valor,
        data_geracao: new Date().toLocaleDateString('pt-BR')
    });

    save();
    renderFaturas();
    showNotify('Sucesso', 'Fatura gerada com sucesso! Movendo para o Caixa.');
    switchTab('faturas');
}

export function renderClientes() {
    const tableBody = document.getElementById('table-clientes-body'); 
    const mobileContainer = document.getElementById('lista-clientes-mobile');
    const gavetaFiltros = document.getElementById('gaveta-filtros');
    const btnFiltrosMobile = document.querySelector('button[onclick="toggleFiltrosGaveta(true)"]');

    if (!tableBody || !mobileContainer) return; 

    tableBody.innerHTML = '';
    mobileContainer.innerHTML = '';
    const checkMestre = document.getElementById('select-all-clients');
    if (checkMestre) checkMestre.checked = false;
    
    if (window.atualizarBarraAcoes) {
        setTimeout(() => window.atualizarBarraAcoes(), 50);
    }

    const clientes = db.clientes || [];

    if (clientes.length === 0) {
        if (gavetaFiltros) gavetaFiltros.classList.add('hidden');
        if (btnFiltrosMobile) btnFiltrosMobile.classList.add('hidden');
        tableBody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-500 italic">Nenhum cliente cadastrado ainda.</td></tr>';
        mobileContainer.innerHTML = '<div class="p-6 text-center text-gray-500 text-xs uppercase font-bold bg-[#16162d] rounded-2xl border border-white/5">Nenhum cliente cadastrado ainda.</div>';
        return;
    } else {
        if (gavetaFiltros && window.innerWidth >= 1024) gavetaFiltros.classList.remove('hidden');
        if (btnFiltrosMobile) btnFiltrosMobile.classList.remove('hidden');
    }

    const nF = document.getElementById('filter-name')?.value.toLowerCase() || "";
    const aF = document.getElementById('filter-app')?.value || "";
    const pF = document.getElementById('filter-plano')?.value || "";
    const sF = document.getElementById('filter-status')?.value || "";
    const iF = document.getElementById('filter-inadimplentes')?.checked || false;
    
    const hoje = new Date(); 
    const hojeS = hoje.toISOString().split('T')[0];

    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    const fimSemanaS = fimSemana.toISOString().split('T')[0];

    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    db.clientes.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(cli => {
        const p = db.planos.find(x => x.id == cli.plano_id) || { nome: 'N/A' };
        const app = db.apps.find(x => x.id == cli.app_id) || { nome: 'N/A' };
        const diff = Math.ceil((new Date(cli.vencimento) - hoje) / (1000 * 60 * 60 * 24));
        const isOverdue = cli.vencimento < hojeS;
        const isInadimplente = diff < -20;
        const isWarning = diff >= 0 && diff <= 3;

        if (!iF && isInadimplente) return;
        if (nF && !cli.nome.toLowerCase().includes(nF)) return;
        if (aF && cli.app_id != aF) return;
        if (pF && cli.plano_id != pF) return;

        if (sF === 'warning' && !isWarning) return;
        if (sF === 'overdue' && !isOverdue) return;
        if (sF === 'inadimplente' && !isInadimplente) return;
        if (sF === 'hoje' && cli.vencimento !== hojeS) return;
        if (sF === 'semana' && (cli.vencimento < hojeS || cli.vencimento > fimSemanaS)) return;
        if (sF === 'mes') {
            const dateParts = cli.vencimento.split('-');
            if (parseInt(dateParts[1]) !== (mesAtual + 1) || parseInt(dateParts[0]) !== anoAtual) return;
        }

        let rCls = isInadimplente ? 'row-inadimplente' : (isOverdue ? 'row-overdue' : (isWarning ? 'row-warning' : ''));

        tableBody.innerHTML += `<tr class="border-t border-gray-800/50 text-xs hover:bg-white/5 ${rCls}">
            <td class="p-2.5 text-center w-10"><input type="checkbox" class="client-checkbox" value="${cli.id}" onchange="window.atualizarBarraAcoes()"></td>
            <td class="p-2.5 font-bold text-white uppercase">${cli.nome}</td>
            <td class="p-2.5 uppercase text-[10px] text-gray-400">${p.nome}<br><span class="text-purple-400 font-bold">${app.nome}</span></td>
            <td class="p-2.5 text-center font-bold ${isOverdue ? 'text-red-500' : (isWarning ? 'text-yellow-500' : 'text-green-500')}">${cli.vencimento.split('-').reverse().join('/')}</td>
            <td class="p-2.5 text-center font-mono text-gray-400">${cli.whatsapp}</td>
            <td class="p-2.5 text-center">
                <div class="flex items-center justify-center gap-3">
                    <button onclick="sendManualWA(${cli.id}, 'renew')" class="text-purple-400 hover:scale-110 transition" title="Cobrar"><i class="fas fa-redo"></i></button>
                    <button onclick="sendManualWA(${cli.id}, 'welcome')" class="text-green-500 hover:scale-110 transition" title="Boas Vindas"><i class="fas fa-star"></i></button>
                    <button onclick="sendManualWA(${cli.id}, 'suspended')" class="text-red-500 hover:scale-110 transition" title="Suspensão"><i class="fas fa-ban"></i></button>
                </div>
            </td>
            <td class="p-2.5 text-right space-x-1 whitespace-nowrap">
                <button onclick="openModalHistory(${cli.id})" title="Histórico" class="text-blue-400 hover:bg-blue-500/20 hover:text-white p-1.5 rounded transition"><i class="fas fa-history"></i></button>
                <button onclick="copyFullAccess(${cli.id})" title="Copiar Acesso" class="text-purple-400 hover:bg-purple-500/20 hover:text-white p-1.5 rounded transition"><i class="fas fa-copy"></i></button>
                <button onclick="addThreeDays(${cli.id})" title="+3 Dias Extras" class="text-purple-400 hover:bg-purple-500/20 hover:text-white p-1.5 rounded font-bold transition">+3</button>
                <button onclick="gerarFaturaManual(${cli.id})" title="Gerar Fatura" class="px-2 py-1 ml-1 bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600 hover:text-black rounded text-[9px] font-black transition">GERAR FATURA</button>
                <button onclick="openModalClienteEdit(${cli.id})" title="Editar" class="text-gray-500 hover:bg-white/10 hover:text-white p-1.5 rounded transition ml-1"><i class="fas fa-edit"></i></button>
                <button onclick="deleteCliente(${cli.id})" title="Excluir" class="text-gray-700 hover:bg-red-500/20 hover:text-red-500 p-1.5 rounded transition"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;

       let cardBorder = isInadimplente ? 'border-purple-500/20 bg-purple-950/5' : (isOverdue ? 'border-red-500/20 bg-red-950/5' : 'border-white/5 bg-[#16162d]');
        let statusBadge = isInadimplente ? '<span class="text-purple-400">Inadimplente</span>' : (isOverdue ? '<span class="text-red-400">Atrasado</span>' : '<span class="text-green-400">Ativo</span>');

        mobileContainer.innerHTML += `
        <div class="card p-3 rounded-xl border ${cardBorder} mb-2 text-xs">
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-black text-white uppercase truncate max-w-[150px]">${cli.nome}</h4>
                <span class="font-mono text-[11px] text-gray-400">${cli.vencimento.split('-').reverse().join('/')} ${statusBadge}</span>
            </div>
            <div class="flex gap-2 items-center text-[10px] text-gray-400 mb-2 font-mono"><i class="fab fa-whatsapp"></i> ${cli.whatsapp}</div>
            
            <div class="flex justify-between items-center mt-1 pt-2 border-t border-white/5">
                <span class="text-[10px] text-purple-400 uppercase font-bold truncate max-w-[60px]">${p.nome}</span>
                <div class="flex gap-1 flex-wrap justify-end">
                    <button onclick="sendManualWA(${cli.id}, 'renew')" class="text-purple-400 hover:bg-purple-500/20 bg-white/5 p-1.5 rounded transition" title="Cobrar"><i class="fas fa-redo"></i></button>
                    <button onclick="sendManualWA(${cli.id}, 'welcome')" class="text-green-500 hover:bg-green-500/20 bg-white/5 p-1.5 rounded transition" title="Boas Vindas"><i class="fas fa-star"></i></button>
                    <button onclick="sendManualWA(${cli.id}, 'suspended')" class="text-red-500 hover:bg-red-500/20 bg-white/5 p-1.5 rounded transition" title="Bloqueio"><i class="fas fa-ban"></i></button>
                    
                    <button onclick="openModalHistory(${cli.id})" class="text-blue-400 hover:bg-blue-500/20 bg-white/5 p-1.5 rounded ml-2" title="Histórico"><i class="fas fa-history"></i></button>
                    <button onclick="openModalClienteEdit(${cli.id})" class="text-gray-400 hover:bg-gray-500/20 bg-white/5 p-1.5 rounded" title="Editar"><i class="fas fa-edit"></i></button>
                    <button onclick="gerarFaturaManual(${cli.id})" class="bg-yellow-600/20 text-yellow-500 px-2 py-0.5 rounded font-bold hover:bg-yellow-600 hover:text-black transition ml-1">FATURA</button>
                </div>
            </div>
        </div>`;
    });
}

// ==========================================
// BUSCA INTELIGENTE (DEBOUNCE)
// ==========================================
let tempoBusca;
window.debounceBuscaClientes = function() {
    clearTimeout(tempoBusca);
    tempoBusca = setTimeout(() => {
        renderClientes();
    }, 300);
};

export function openModalHistory(id) {
    const cli = db.clientes.find(c => c.id == id);
    if (!cli) return;

    const historicoPagamentos = (db.faturas || []).filter(f => f.cliId == id);
    const historicoDias = cli.historico_dias || [];

    let htmlPagamentos = historicoPagamentos.map(f => `
        <div class="flex justify-between items-center text-xs border-b border-white/5 py-2">
            <span class="text-gray-400">${f.data_pgto}</span>
            <span class="text-green-400 font-bold">R$ ${f.valor.toFixed(2)}</span>
        </div>`).join('');
    if (!htmlPagamentos) htmlPagamentos = '<p class="text-xs text-gray-500 italic py-2">Nenhum pagamento registrado.</p>';

    let htmlDias = historicoDias.map(d => `
        <div class="flex justify-between items-center text-xs border-b border-white/5 py-2">
            <span class="text-gray-400">${d.data}</span>
            <span class="text-purple-400 font-bold">+${d.dias} dias</span>
        </div>`).join('');
    if (!htmlDias) htmlDias = '<p class="text-xs text-gray-500 italic py-2">Nenhum acréscimo de dias.</p>';

    document.getElementById('history-client-name').innerText = cli.nome;
    document.getElementById('history-payments-list').innerHTML = htmlPagamentos;
    document.getElementById('history-days-list').innerHTML = htmlDias;
    openModal('modalHistory');
}

export function addThreeDays(id) {
    const idx = db.clientes.findIndex(c => c.id == id);
    if (idx !== -1) {
        if (!db.clientes[idx].historico_dias) db.clientes[idx].historico_dias = [];
        db.clientes[idx].historico_dias.unshift({ data: new Date().toLocaleDateString(), dias: 3 });

        let [y, m, d] = db.clientes[idx].vencimento.split('-').map(Number);
        let base = new Date(y, m - 1, d, 12, 0, 0);
        base.setDate(base.getDate() + 3);
        db.clientes[idx].vencimento = formatarDataBR_ISO(base);
        save();
        renderClientes();
        showNotify('+3 Dias', 'Vencimento adiado em 3 dias.');
    }
}

export function renderPlanos() {
    const list = document.getElementById('planos-list'); if (!list) return;
    list.innerHTML = db.planos.map(p => {
        const valorLucro = p.valor - p.custo;
        const margemPorcentagem = p.valor > 0 ? Math.round((valorLucro / p.valor) * 100) : 0;
        return `
        <div class="card p-4 rounded-xl relative shadow-xl border border-white/5 bg-gray-900/40 text-xs">
            <div class="absolute top-2 right-2 flex gap-2 z-20">
                <button onclick="openModalPlanoEdit(${p.id})" class="text-gray-500 hover:text-white transition p-1"><i class="fas fa-edit"></i></button>
                <button onclick="deletePlano(${p.id})" class="text-gray-700 hover:text-red-500 transition p-1"><i class="fas fa-trash"></i></button>
            </div>
            <span class="absolute bottom-12 right-4 bg-green-500/10 text-green-400 border border-green-500/20 text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">+${margemPorcentagem}% Margem</span>
            <h4 class="font-bold text-white uppercase">${p.nome}</h4>
            <p class="text-[9px] text-gray-500 font-black mt-0.5">${p.dias} DIAS</p>
            <div class="mt-2 flex justify-between border-t border-gray-800 pt-2 w-full">
                <span>Preço: R$ ${p.valor.toFixed(2)}</span>
                <span class="text-purple-400 font-bold">Lucro: R$ ${valorLucro.toFixed(2)}</span>
            </div>
        </div>`;
    }).join('');
    
    if (document.getElementById('cli_plano_id')) {
        document.getElementById('cli_plano_id').innerHTML = db.planos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
    }
    if (document.getElementById('filter-plano')) {
        document.getElementById('filter-plano').innerHTML = `<option value="">Planos</option>` + 
            db.planos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
    }
}

export function copyAllAppInfo(nome, url, pin) {
    const el = document.createElement('textarea');
    el.value = `*Aplicativo:* ${nome}\n*DNS/URL:* ${url || 'N/A'}\n*PIN:* ${pin || 'N/A'}`;
    document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    showNotify("Copiado!", `Dados do app copiados com sucesso!`);
}

export function renderApps() {
    const list = document.getElementById('apps-list'); if (!list) return;
    list.innerHTML = db.apps.map(a => `
        <div onclick="window.copyAllAppInfo('${a.nome}', '${a.url || ''}', '${a.pin || ''}')" class="card p-3 rounded-xl border border-white/5 bg-gray-900/40 cursor-pointer hover:border-purple-500/30 hover:bg-purple-900/10 transition text-xs relative group">
            <div class="absolute top-2 right-2 flex gap-2" onclick="event.stopPropagation();">
                <button onclick="openModalAppEdit(${a.id})" class="text-gray-500 hover:text-white transition p-1"><i class="fas fa-edit"></i></button>
                <button onclick="deleteApp(${a.id})" class="text-gray-700 hover:text-red-500 transition p-1"><i class="fas fa-trash"></i></button>
            </div>
            <h4 class="font-black text-purple-400 uppercase tracking-tight pr-12">${a.nome}</h4>
            <p class="text-[10px] text-gray-400 mt-1 uppercase"><span class="font-bold">DNS:</span> ${a.url || 'N/A'}</p>
            <div class="mt-2 text-[9px] font-mono flex justify-between border-t border-white/5 pt-2 text-gray-500 group-hover:text-purple-400 transition">
                <span>PIN: <strong class="text-white">${a.pin || 'N/A'}</strong></span>
                <span class="uppercase font-black"><i class="fas fa-copy mr-1"></i> Copiar</span>
            </div>
        </div>`).join('');
    
    if (document.getElementById('cli_app_id')) {
        document.getElementById('cli_app_id').innerHTML = db.apps.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
    }
    if (document.getElementById('filter-app')) {
        document.getElementById('filter-app').innerHTML = `<option value="">Apps</option>` + 
            db.apps.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
    }
}

export function renderFaturas() {
    const pBody = document.getElementById('table-faturas-pendentes-body');
    const pMobile = document.getElementById('lista-faturas-pendentes-mobile');
    const hBody = document.getElementById('table-faturas-body');
    const hMobile = document.getElementById('lista-faturas-historico-mobile');
    
    if (!pBody && !pMobile) return;
    
    const pendentes = (db.invoices_pending || []).sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento));

    // --- COBRANÇAS EM ABERTO (DESKTOP) ---
    if (pBody) {
        pBody.innerHTML = pendentes.map(inv => {
            return `<tr class="border-t border-gray-800 text-xs hover:bg-white/5">
                <td class="p-3 font-bold text-yellow-400">${inv.vencimento.split('-').reverse().join('/')}</td>
                <td class="p-3 text-white uppercase font-bold">${inv.cliente}</td>
                <td class="p-3 text-gray-400 uppercase">${inv.plano}</td>
                <td class="p-3 text-white font-bold">R$ ${(inv.valor||0).toFixed(2)}</td>
                <td class="p-3 text-right flex justify-end gap-2 whitespace-nowrap">
                    <button onclick="confirmarRenovacao(${inv.id})" title="Receber" class="px-2 py-1.5 bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white transition border border-green-500/20 rounded font-black text-[9px]"><i class="fas fa-check mr-1"></i> PAGO</button>
                    <button onclick="window.excluirCobrancaPendente(${inv.id})" title="Excluir" class="px-2 py-1.5 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white transition border border-red-500/20 rounded font-black text-[9px]"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('') || '<tr><td colspan="5" class="p-4 text-center text-gray-500 italic border-t border-gray-800">Nenhuma fatura em aberto.</td></tr>';
    }

    if (pMobile) {
        pMobile.innerHTML = pendentes.map(inv => {
            return `<div class="p-4 bg-[#16162d] border border-yellow-500/30 rounded-2xl mb-2">
                <div class="flex justify-between mb-3">
                    <div><p class="text-xs font-bold text-white uppercase">${inv.cliente}</p><p class="text-[10px] text-gray-400">${inv.plano}</p></div>
                    <div class="text-right"><p class="text-xs font-black text-yellow-500">${inv.vencimento.split('-').reverse().join('/')}</p><p class="text-sm font-bold">R$ ${(inv.valor||0).toFixed(2)}</p></div>
                </div>
                <div class="flex gap-2">
                    <button onclick="confirmarRenovacao(${inv.id})" class="flex-1 py-2 bg-green-600/20 text-green-500 rounded-xl font-bold text-[10px]"><i class="fas fa-check mr-1"></i> PAGO</button>
                    <button onclick="window.excluirCobrancaPendente(${inv.id})" class="px-4 py-2 bg-red-600/20 text-red-500 rounded-xl font-bold text-[10px]"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }).join('') || '<div class="p-4 text-center text-gray-500 text-xs italic bg-[#16162d] rounded-xl border border-white/5">Nenhuma fatura em aberto.</div>';
    }

    // --- HISTÓRICO ---
    let totalLucro = 0;
    hBody.innerHTML = (db.faturas || []).map(f => {
        totalLucro += (f.lucro || 0);
        return `<tr class="border-t border-gray-800 text-[10px] hover:bg-white/5">
            <td class="p-3 text-gray-500">${f.data_pgto}</td>
            <td class="p-3 font-bold text-white uppercase">${f.cliente}</td>
            <td class="p-3 text-green-500 font-bold">R$ ${(f.valor || 0).toFixed(2)}</td>
            <td class="p-3 text-purple-400 font-bold">R$ ${(f.lucro || 0).toFixed(2)}</td>
            <td class="p-3 text-right flex justify-end gap-2 whitespace-nowrap">
                <button onclick="window.openModalEditFatura(${f.id})" title="Editar" class="text-blue-400 hover:text-white transition bg-blue-500/10 p-1.5 rounded"><i class="fas fa-edit mr-1"></i> Editar</button>
                <button onclick="deleteFatura(${f.id})" title="Estornar" class="text-orange-500 hover:text-white transition bg-orange-500/10 p-1.5 rounded"><i class="fas fa-undo mr-1"></i> Estornar</button>
                <button onclick="window.excluirFaturaHistorico(${f.id})" title="Excluir" class="text-red-500 hover:text-white transition bg-red-500/10 p-1.5 rounded"><i class="fas fa-trash mr-1"></i> Excluir</button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" class="p-4 text-center text-gray-500 italic">Sem histórico.</td></tr>';

    if (hMobile) {
        hMobile.innerHTML = (db.faturas || []).map(f => {
            return `<div class="p-4 bg-[#16162d] border border-white/5 rounded-2xl mb-2">
                <div class="flex justify-between mb-3">
                    <div><p class="text-[10px] text-gray-500 font-mono">${f.data_pgto}</p><p class="text-xs font-black text-white uppercase">${f.cliente}</p></div>
                    <div class="text-right"><p class="text-xs font-black text-green-500">R$ ${(f.valor||0).toFixed(2)}</p></div>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.openModalEditFatura(${f.id})" class="flex-1 py-2 bg-blue-600/20 text-blue-400 rounded-xl text-[10px] font-bold"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteFatura(${f.id})" class="flex-1 py-2 bg-orange-600/20 text-orange-500 rounded-xl text-[10px] font-bold"><i class="fas fa-undo"></i></button>
                    <button onclick="window.excluirFaturaHistorico(${f.id})" class="flex-1 py-2 bg-red-600/20 text-red-500 rounded-xl text-[10px] font-bold"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }).join('') || '<div class="p-4 text-center text-gray-500 text-xs italic bg-[#16162d] rounded-xl border border-white/5">Sem histórico.</div>';
    }

    if (document.getElementById('fatura-total-lucro')) document.getElementById('fatura-total-lucro').innerText = `R$ ${totalLucro.toFixed(2)}`;
}

export function renderConfig() {
    const config = db.config || {};
    if(document.getElementById('cfg_aviso_dias')) document.getElementById('cfg_aviso_dias').value = config.aviso_dias || 3;
    if(document.getElementById('cfg_msg_boas_vindas')) document.getElementById('cfg_msg_boas_vindas').value = config.msg_boas_vindas || "";
    if(document.getElementById('cfg_msg_renovacao')) document.getElementById('cfg_msg_renovacao').value = config.msg_renovacao || "";
    if(document.getElementById('cfg_msg_sucesso')) document.getElementById('cfg_msg_sucesso').value = config.msg_sucesso || "";
    if(document.getElementById('cfg_msg_suspensa')) document.getElementById('cfg_msg_suspensa').value = config.msg_suspensa || "";
    if(document.getElementById('cfg_msg_oscilacao')) document.getElementById('cfg_msg_oscilacao').value = config.msg_oscilacao || "";
    if(document.getElementById('cfg_msg_manutencao')) document.getElementById('cfg_msg_manutencao').value = config.msg_manutencao || "";
    
    // Checkboxes de Automação
    if(document.getElementById('cfg_usar_spintax')) document.getElementById('cfg_usar_spintax').checked = config.usar_spintax || false;
    if(document.getElementById('cfg_disparo_rapido')) document.getElementById('cfg_disparo_rapido').checked = config.disparo_rapido || false;

    // 🚀 PREENCHIMENTO AUTOMÁTICO DO COMPROVANTE
    const textoPadraoComprovante = "{Eba!|Show!|Maravilha!|Tudo certo,} {cliente}. {Pagamento confirmado|Recebemos seu pagamento|Sua fatura foi paga} com sucesso! {Sua assinatura|Seu acesso} no {app} já está {renovado|garantido|ativo por mais um ciclo}.\n\n📅 Vencimento: {vencimento}\n🌐 DNS: {dns}\n\n{Muito obrigado|Valeu demais} pela {confiança|preferência|parceria} de sempre!";
    
    if(document.getElementById('fatura-comprovante-texto')) {
        document.getElementById('fatura-comprovante-texto').value = config.msg_sucesso || textoPadraoComprovante;
    }

    if(document.getElementById('cfg_timer_comprovante')) {
        document.getElementById('cfg_timer_comprovante').value = config.timer_comprovante !== undefined ? config.timer_comprovante : 30;
    }
}

export function updateConfig() {
    db.config = {
        aviso_dias: document.getElementById('cfg_aviso_dias') ? parseInt(document.getElementById('cfg_aviso_dias').value) : 3,
        msg_boas_vindas: document.getElementById('cfg_msg_boas_vindas') ? document.getElementById('cfg_msg_boas_vindas').value : "",
        msg_renovacao: document.getElementById('cfg_msg_renovacao') ? document.getElementById('cfg_msg_renovacao').value : "",
        msg_sucesso: document.getElementById('cfg_msg_sucesso') ? document.getElementById('cfg_msg_sucesso').value : "",
        msg_suspensa: document.getElementById('cfg_msg_suspensa') ? document.getElementById('cfg_msg_suspensa').value : "",
        msg_oscilacao: document.getElementById('cfg_msg_oscilacao') ? document.getElementById('cfg_msg_oscilacao').value : "",
        msg_manutencao: document.getElementById('cfg_msg_manutencao') ? document.getElementById('cfg_msg_manutencao').value : "",
        
        usar_spintax: document.getElementById('cfg_usar_spintax') ? document.getElementById('cfg_usar_spintax').checked : false,
        disparo_rapido: document.getElementById('cfg_disparo_rapido') ? document.getElementById('cfg_disparo_rapido').checked : false,
        timer_comprovante: document.getElementById('cfg_timer_comprovante') ? parseInt(document.getElementById('cfg_timer_comprovante').value) : 30
    };
    save(); showNotify('Sucesso', 'Configurações salvas!');
}

export function openModalAdd() { 
    if (db.account && db.account.type !== 'vip' && db.clientes.length >= 3) {
        openModal('modalLimiteClientes'); return; 
    }
    document.getElementById('formCliente').reset(); 
    document.getElementById('cli_edit_id').value = ""; 
    document.getElementById('modalClienteTitle').innerText = "Novo Cliente"; 
    openModal('modalCliente'); 
}

export function openModalClienteEdit(id) {
    const cli = db.clientes.find(c => c.id == id);
    document.getElementById('cli_edit_id').value = cli.id; 
    document.getElementById('cli_nome').value = cli.nome; 
    document.getElementById('cli_whatsapp').value = cli.whatsapp; 
    document.getElementById('cli_plano_id').value = cli.plano_id; 
    document.getElementById('cli_app_id').value = cli.app_id; 
    document.getElementById('cli_vencimento').value = cli.vencimento; 
    document.getElementById('cli_credenciais').value = cli.credenciais || "";
    document.getElementById('modalClienteTitle').innerText = "Editar Cliente"; 
    openModal('modalCliente');
}

export function deleteCliente(id) {
    window.meuConfirm("Apagar Cliente", "Tem certeza que deseja apagar este cliente?", () => {
        db.clientes = db.clientes.filter(c => c.id != id);
        save(); renderClientes(); updateDashboard(); showNotify('Removido', 'Cliente apagado.');
    });
}

export function openModalPlanoAdd() { document.getElementById('formPlano').reset(); document.getElementById('plan_edit_id').value = ""; document.getElementById('modalPlanoTitle').innerText = "Novo Plano"; openModal('modalPlano'); }

export function openModalPlanoEdit(id) {
    const p = db.planos.find(pl => pl.id == id);
    document.getElementById('plan_edit_id').value = p.id; 
    document.getElementById('plan_nome').value = p.nome; 
    document.getElementById('plan_valor').value = p.valor; 
    document.getElementById('plan_custo').value = p.custo;
    document.getElementById('plan_dias_select').value = [30, 60, 90].includes(p.dias) ? p.dias : 'custom';
    if (p.dias != 30 && p.dias != 60 && p.dias != 90) document.getElementById('plan_dias_custom').value = p.dias;
    checkCustomDays(document.getElementById('plan_dias_select').value); 
    document.getElementById('modalPlanoTitle').innerText = "Editar Plano"; openModal('modalPlano');
}

export function deletePlano(id) {
    window.meuConfirm("Apagar Plano", "Tem certeza que deseja apagar este plano?", () => {
        db.planos = db.planos.filter(p => p.id != id);
        save(); renderPlanos(); showNotify('Removido', 'Plano apagado.');
    });
}

export function openModalAppAdd() { document.getElementById('formApp').reset(); document.getElementById('app_edit_id').value = ""; document.getElementById('modalAppTitle').innerText = "Novo App"; openModal('modalApp'); }

export function openModalAppEdit(id) {
    const a = db.apps.find(x => x.id == id);
    document.getElementById('app_edit_id').value = a.id; 
    document.getElementById('app_nome').value = a.nome; 
    document.getElementById('app_url').value = a.url || ""; 
    document.getElementById('app_host').value = a.host || ""; 
    document.getElementById('app_pin').value = a.pin || ""; 
    document.getElementById('app_links').value = a.links || "";
    document.getElementById('modalAppTitle').innerText = "Editar App"; openModal('modalApp');
}

export function deleteApp(id) {
    window.meuConfirm("Apagar App", "Tem certeza que deseja apagar esta aplicação?", () => {
        db.apps = db.apps.filter(a => a.id != id);
        save(); renderApps(); showNotify('Removido', 'Aplicação apagada.');
    });
}

export function openModalRenovar(id) {
    const inv = db.invoices_pending.find(i => i.id == id);
    if (!inv) return;
    document.getElementById('renovar-cli-id').value = id;
    document.getElementById('renovar-info').innerText = `Marcar R$ ${inv.valor.toFixed(2)} pagos por ${inv.cliente}?`;
    openModal('modalRenovar');
}

export function confirmarRenovacao(diretoId = null) {
    const id = diretoId || (document.getElementById('renovar-cli-id') ? document.getElementById('renovar-cli-id').value : null);
    if (!id) return;

    const inv = db.invoices_pending.find(i => i.id == id);
    if (!inv) return;

    const cliIdx = db.clientes.findIndex(c => c.id == inv.cliId);
    if (cliIdx === -1) return;
    
    const cli = db.clientes[cliIdx];
    const p = db.planos.find(pl => pl.id == cli.plano_id) || { valor: inv.valor, custo: 0, dias: 30 };
    const app = db.apps.find(a => a.id == cli.app_id) || { nome: 'N/A', url: 'N/A' };
    
    const vencimento_original_antes_de_pagar = cli.vencimento;

    let base = new Date(); 
    let [y, m, d] = cli.vencimento.split('-').map(Number);
    let vAtual = new Date(y, m - 1, d, 12, 0, 0); 
    
    if (vAtual > base) base = vAtual;
    
    base.setDate(base.getDate() + parseInt(p.dias));
    
    const novoAno = base.getFullYear();
    const novoMes = String(base.getMonth() + 1).padStart(2, '0');
    const novoDia = String(base.getDate()).padStart(2, '0');
    const novaDataFormatadaBR = `${novoDia}/${novoMes}/${novoAno}`;
    
    db.clientes[cliIdx].vencimento = formatarDataBR_ISO(base);
    
    db.faturas.unshift({ 
        id: Date.now(), 
        cliId: cli.id, 
        data_pgto: new Date().toLocaleDateString('pt-BR'), 
        cliente: cli.nome, 
        valor: p.valor, 
        lucro: p.valor - p.custo, 
        dias_somados: p.dias,
        vencimento_original: vencimento_original_antes_de_pagar 
    });
    
    db.invoices_pending = db.invoices_pending.filter(i => i.id != id);

    save(); 
    closeModal('modalRenovar'); 
    renderClientes(); 
    renderFaturas(); 
    updateDashboard(); 
    
    showNotify('Baixa Concluída!', `A fatura de ${cli.nome} foi paga.`, 'success');
    
    const numZap = cli.whatsapp.replace(/\D/g, ''); 
    const campoComprovante = document.getElementById('fatura-comprovante-texto');
    
    let templatePadrao = campoComprovante ? campoComprovante.value : (db.config.msg_sucesso || "✅ *Pagamento Confirmado!*\n\nOlá, *{cliente}*!\nA sua assinatura foi renovada.\n\n📅 *Vencimento:* {vencimento}");

    let textoFinal = templatePadrao
        .replace(/{cliente}/g, cli.nome)
        .replace(/{vencimento}/g, novaDataFormatadaBR)
        .replace(/{usuario}/g, cli.usuario || 'N/A')
        .replace(/{senha}/g, cli.senha || 'N/A')
        .replace(/{app}/g, app.nome)
        .replace(/{dns}/g, app.url || app.host || 'N/A')
        .replace(/{plano}/g, p.nome || 'N/A')
        .replace(/{valor}/g, p.valor ? `R$ ${p.valor.toFixed(2)}` : "0,00");

    textoFinal = textoFinal.replace(/\{([^{}]+)\}/g, function(match, contents) {
        if (contents.includes('|')) {
            const parts = contents.split('|');
            return parts[Math.floor(Math.random() * parts.length)];
        }
        return match; 
    });

    const tempoEspera = db.config.timer_comprovante !== undefined ? db.config.timer_comprovante : 30;
    dispararToastTemporizador(numZap, textoFinal, cli.nome, tempoEspera);
}

export function deleteFatura(fid) {
    window.meuConfirm("Estornar pagamento?", "O vencimento voltará ao estado exato antes do pagamento e a fatura volta para o aberto.", () => {
        const f = db.faturas.find(x => x.id == fid);
        if (!f) return;
        const cIdx = db.clientes.findIndex(c => c.id == f.cliId);
        
        if (cIdx !== -1) {
            if (f.vencimento_original) {
                db.clientes[cIdx].vencimento = f.vencimento_original;
            } else {
                let [y, m, d] = db.clientes[cIdx].vencimento.split('-').map(Number);
                let dObj = new Date(y, m - 1, d, 12, 0, 0);
                dObj.setDate(dObj.getDate() - parseInt(f.dias_somados || 30));
                db.clientes[cIdx].vencimento = formatarDataBR_ISO(dObj);
            }

            db.invoices_pending.push({
                id: Date.now(),
                cliId: f.cliId,
                cliente: f.cliente,
                plano: f.plano || "Plano Genérico",
                vencimento: db.clientes[cIdx].vencimento,
                valor: f.valor,
                data_geracao: new Date().toLocaleDateString('pt-BR')
            });
        }
        db.faturas = db.faturas.filter(x => x.id != fid); 
        save(); renderFaturas(); updateDashboard(); renderClientes(); showNotify('Estornado', 'Vencimento revertido e cliente devolvido.');
    });
}

window.excluirCobrancaPendente = function(invId) {
    window.meuConfirm("Ignorar Cobrança?", "Deseja ignorar esta cobrança? O cliente continuará a existir mas não registrará pagamento neste ciclo.", () => {
        db.invoices_pending = db.invoices_pending.filter(x => x.id != invId);
        save(); renderFaturas(); updateDashboard();
        showNotify('Apagado', 'Cobrança removida da lista.');
    });
};

window.excluirFaturaHistorico = function(fid) {
    window.meuConfirm("Excluir do Histórico?", "Excluir permanentemente do histórico? Isso NÃO altera o vencimento do cliente.", () => {
        db.faturas = db.faturas.filter(x => x.id != fid);
        save(); renderFaturas(); updateDashboard();
        showNotify('Apagado', 'Removido do histórico.');
    });
};

window.openModalEditFatura = function(fid) {
    const f = db.faturas.find(x => x.id == fid);
    if(!f) return;
    document.getElementById('edit_fatura_id').value = f.id;
    let part = f.data_pgto.split('/'); 
    if(part.length === 3) document.getElementById('edit_fatura_data').value = `${part[2]}-${part[1]}-${part[0]}`;
    openModal('modalEditFatura');
};

window.confirmarEdicaoFatura = function() {
    const id = document.getElementById('edit_fatura_id').value;
    const nvData = document.getElementById('edit_fatura_data').value;
    if(!nvData) return;
    const f = db.faturas.find(x => x.id == id);
    if(f) {
        let part = nvData.split('-');
        f.data_pgto = `${part[2]}/${part[1]}/${part[0]}`;
        save(); renderFaturas(); closeModal('modalEditFatura');
        showNotify('Sucesso', 'Data atualizada no histórico.');
    }
};

window.abrirModalFiltroGrafico = function(tipo, nomeItem) {
    if(!nomeItem || nomeItem === "Sem Clientes") return;
    const titulo = document.getElementById('chart-details-title');
    const lista = document.getElementById('chart-details-list');
    titulo.innerText = nomeItem;
    lista.innerHTML = '';
    
    const clientes = db.clientes || [];
    const filtrados = clientes.filter(c => {
        if(tipo === 'app') {
            const app = db.apps.find(a => a.id == c.app_id);
            return app && app.nome === nomeItem;
        } else {
            const plano = db.planos.find(p => p.id == c.plano_id);
            return plano && plano.nome === nomeItem;
        }
    });

    if(filtrados.length === 0) {
        lista.innerHTML = `<div class="p-4 text-center text-gray-500 text-xs italic">Nenhum cliente encontrado.</div>`;
    } else {
        lista.innerHTML = filtrados.map(c => `
            <div class="p-3 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center mb-2">
                <div>
                    <p class="text-xs font-bold text-white uppercase">${c.nome}</p>
                    <p class="text-[10px] text-gray-400 font-mono mt-0.5">Venc: ${c.vencimento.split('-').reverse().join('/')}</p>
                </div>
                <button onclick="closeModal('modalChartDetails'); switchTab('clientes'); setTimeout(() => openModalClienteEdit(${c.id}), 300)" class="text-blue-400 hover:text-white bg-blue-500/10 p-2 rounded transition"><i class="fas fa-edit"></i></button>
            </div>
        `).join('');
    }
    openModal('modalChartDetails');
};

export function copyFullAccess(id) {
    const cli = db.clientes.find(c => c.id == id); if (!cli) return;
    const app = db.apps.find(a => a.id == cli.app_id) || { nome: 'N/A' };
    const plano = db.planos.find(p => p.id == cli.plano_id) || { nome: 'N/A' };
    const txt = `👤 Usuário: ${cli.usuario || 'N/A'}\n🔑 Senha: ${cli.senha || 'N/A'}\n📱 App: ${app.nome}\n🌐 DNS: ${app.url || app.host || 'N/A'}\n🗓️ Vencimento: ${cli.vencimento.split('-').reverse().join('/')}`;
    const el = document.createElement('textarea'); el.value = txt; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    showNotify('Copiado!', 'Dados copiados.');
}

export function processCredentials(text) {
    if (!text) return { clean: "", user: "", pass: "" };
    const uM = text.match(/(?:Usuário|Usuario|User):\s*([^\n\r\s✅✨⭐👤]+)/i);
    const sM = text.match(/(?:Senha|Pass):\s*([^\n\r\s🔑🔒]+)/i);
    let lines = text.split('\n').filter(l => !l.includes('superc.space') && !l.includes('Assinar') && !l.includes('Vencimento:'));
    return { clean: lines.join('\n').trim(), user: uM ? uM[1].trim() : "", pass: sM ? sM[1].trim() : "" };
}

export function showNotify(titulo, message, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = "bg-[#16162d] border border-white/10 p-3 rounded-xl shadow-xl text-xs text-white mb-2 transform transition-all duration-300";
    toast.innerHTML = `<strong>${titulo}</strong><p class="text-gray-400">${message}</p>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

window.cancelarDisparo = false;
window.cancelarEnvioMassa = function() { window.cancelarDisparo = true; };

window.dispararNotificacaoEmMassa = async function() {
    window.cancelarDisparo = false;
    const selecionados = Array.from(document.querySelectorAll('.client-checkbox:checked')).map(cb => cb.value);
    if (selecionados.length === 0) return;

    if (typeof Swal === 'undefined') {
        showNotify('Erro', 'O sistema de alertas não carregou.', 'error');
        return;
    }

    const processarFilaEmLote = async (tipo, msgCustomizada) => {
        const miniBadge = document.getElementById('badgeProgressoFlutuante');
        if (miniBadge) miniBadge.classList.remove('hidden');

        for (let i = 0; i < selecionados.length; i++) {
            if (window.cancelarDisparo) { showNotify("Cancelado", "Envios interrompidos.", "warning"); break; }
            
            const cli = db.clientes.find(c => c.id == selecionados[i]);
            if (!cli) continue;

            const pct = Math.round(((i + 1) / selecionados.length) * 100);
            document.getElementById('progresso-texto-mini').innerText = `Enviando: ${cli.nome} (${i+1}/${selecionados.length})`;
            document.getElementById('progresso-barra-mini').style.width = `${pct}%`;
            document.getElementById('progresso-porcentagem-mini').innerText = `${pct}%`;

            if (tipo === 'custom') {
                const app = db.apps.find(a => a.id == cli.app_id) || { nome: '', url: '', host: '' };
                const plano = db.planos.find(p => p.id == cli.plano_id) || { nome: '', valor: 0 };
                const diasRestantes = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));

                let textoFinal = msgCustomizada.replace(/{cliente}/g, cli.nome || "")
                                    .replace(/{app}/g, app.nome)
                                    .replace(/{dns}/g, app.url || app.host || "N/A")
                                    .replace(/{plano}/g, plano.nome)
                                    .replace(/{vencimento}/g, cli.vencimento.split('-').reverse().join('/'))
                                    .replace(/{usuario}/g, cli.usuario || "N/A")
                                    .replace(/{senha}/g, cli.senha || "N/A")
                                    .replace(/{valor}/g, plano.valor ? `R$ ${plano.valor.toFixed(2)}` : "0,00")
                                    .replace(/{dias}/g, diasRestantes);
                
                if (db.config.usar_spintax) {
                    textoFinal = textoFinal.replace(/\{([^{}]+)\}/g, function(match, contents) {
                        if (['cliente', 'app', 'vencimento', 'valor', 'dias', 'usuario', 'senha', 'dns', 'plano'].includes(contents.toLowerCase().trim())) return match;
                        const parts = contents.split('|');
                        return parts[Math.floor(Math.random() * parts.length)];
                    });
                }
                await sendCustomWA(cli.whatsapp, textoFinal, cli.nome);
            } else {
                await sendManualWA(cli.id, tipo);
            }

            if (i < selecionados.length - 1) {
                const delayAntiBan = Math.floor(Math.random() * (10000 - 4000 + 1)) + 4000;
                await new Promise(r => setTimeout(r, delayAntiBan));
            }
        }

        if (miniBadge) miniBadge.classList.add('hidden');
        document.querySelectorAll('.client-checkbox').forEach(cb => cb.checked = false);
        if(window.atualizarBarraAcoes) window.atualizarBarraAcoes();
        
        if (!window.cancelarDisparo) showNotify("Concluído", "Todos os disparos foram realizados!");
    };

    if (db.config.disparo_rapido) {
        window.meuConfirm("Disparo 1-Clique", `Deseja notificar imediatamente os ${selecionados.length} clientes com o aviso padrão?`, () => {
            processarFilaEmLote('renew', '');
        }, 'question');
        return;
    }

    const optionsHtml = `
        <div class="text-left text-sm mt-2">
            <label class="block text-gray-400 mb-1 font-bold">Escolha o que enviar:</label>
            <select id="swal-tipo-msg" class="w-full bg-gray-800 text-white p-3 rounded mb-3 border border-gray-600 focus:border-purple-500 outline-none">
                <option value="renew">🔄 Cobrança de Renovação (Padrão)</option>
                <option value="welcome">⭐ Boas Vindas</option>
                <option value="suspended">🚫 Aviso de Suspensão</option>
                <option value="oscilacao">⚠️ Aviso de Oscilação</option>
                <option value="manutencao">🔧 Aviso de Manutenção</option>
                <option value="custom">💬 Digitar Mensagem Personalizada...</option>
            </select>
            <div id="box-custom-msg" class="hidden">
                <label class="block text-gray-400 mb-1 font-bold">Sua Mensagem Exclusiva:</label>
                <textarea id="swal-custom-msg" class="w-full bg-gray-800 text-white p-3 rounded border border-gray-600 focus:border-purple-500 outline-none text-xs" rows="5" placeholder="Escreva aqui..."></textarea>
            </div>
        </div>
    `;

    Swal.fire({
        title: `Disparo em Massa`,
        html: optionsHtml,
        showCancelButton: true,
        confirmButtonColor: '#9333ea',
        cancelButtonColor: '#374151',
        confirmButtonText: 'Iniciar Disparo',
        cancelButtonText: 'Cancelar',
        background: '#16162d',
        color: '#ffffff',
        didOpen: () => {
            const select = document.getElementById('swal-tipo-msg');
            const boxCustom = document.getElementById('box-custom-msg');
            select.addEventListener('change', () => {
                if(select.value === 'custom') boxCustom.classList.remove('hidden');
                else boxCustom.classList.add('hidden');
            });
        },
        preConfirm: () => {
            const tipo = document.getElementById('swal-tipo-msg').value;
            const msg = document.getElementById('swal-custom-msg').value;
            if(tipo === 'custom' && !msg.trim()) {
                Swal.showValidationMessage('Digite a sua mensagem personalizada.');
                return false;
            }
            return { tipo, msg };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            processarFilaEmLote(result.value.tipo, result.value.msg);
        }
    });
};

window.dispararAlertaGeral = async function(tipoAlerta) {
    window.cancelarDisparo = false;
    const hoje = new Date();
    const ativos = (db.clientes || []).filter(cli => {
        const diff = Math.ceil((new Date(cli.vencimento) - hoje) / (1000 * 60 * 60 * 24));
        return diff >= -20;
    });
    if (ativos.length === 0) return;
    
    const executarEnvioAlerta = () => {
        const miniBadge = document.getElementById('badgeProgressoFlutuante');
        if (miniBadge) miniBadge.classList.remove('hidden');

        (async function() {
            for (let i = 0; i < ativos.length; i++) {
                if (window.cancelarDisparo) { showNotify("Cancelado", "Transmissão interrompida.", "warning"); break; }
                const pct = Math.round(((i + 1) / ativos.length) * 100);
                document.getElementById('progresso-texto-mini').innerText = `Aviso: ${ativos[i].nome} (${i+1}/${ativos.length})`;
                document.getElementById('progresso-barra-mini').style.width = `${pct}%`;
                document.getElementById('progresso-porcentagem-mini').innerText = `${pct}%`;
                
                await sendManualWA(ativos[i].id, tipoAlerta);
                
                if (i < ativos.length - 1) {
                    const delayAntiBan = Math.floor(Math.random() * (10000 - 4000 + 1)) + 4000;
                    await new Promise(r => setTimeout(r, delayAntiBan));
                }
            }
            if (miniBadge) miniBadge.classList.add('hidden');
            if (!window.cancelarDisparo) showNotify("Concluído", "Alerta transmitido com sucesso!");
        })();
    };

    if (db.config.disparo_rapido) {
        executarEnvioAlerta();
    } else {
        window.meuConfirm("Transmitir Alerta Geral", `Deseja enviar este alerta para todos os ${ativos.length} clientes ativos no sistema?`, () => {
            executarEnvioAlerta();
        }, 'question');
    }
};

// ==========================================
// PREVIEW DO WHATSAPP EM TEMPO REAL
// ==========================================
window.atualizarPreviewWA = function(campoId, displayId = 'wa-preview-text') {
    const campo = document.getElementById(campoId);
    const display = document.getElementById(displayId);
    if (!campo || !display) return;

    let texto = campo.value;

    if (!texto.trim()) {
        display.innerHTML = "<i class='text-gray-400'>A mensagem está vazia. Escreva algo para visualizar.</i>";
        return;
    }

    texto = texto.replace(/\{([^{}]+)\}/g, function(match, contents) {
        if (['cliente', 'app', 'vencimento', 'valor', 'dias', 'usuario', 'senha', 'dns', 'plano'].includes(contents.toLowerCase().trim())) return match;
        if (contents.includes('|')) {
            const parts = contents.split('|');
            return `<span class="bg-yellow-500/20 text-yellow-300 px-1 rounded" title="Spintax Ativo">${parts[Math.floor(Math.random() * parts.length)]}</span>`;
        }
        return match;
    });

    const mockData = {
        '{cliente}': 'Wesley',
        '{app}': 'Mega TV',
        '{plano}': 'VIP Premium',
        '{vencimento}': '25/05/2026',
        '{valor}': 'R$ 35,00',
        '{dias}': '3',
        '{usuario}': 'wesley_123',
        '{senha}': 'senhaforte',
        '{dns}': 'http://painel.dns.com'
    };

    for (const [key, value] of Object.entries(mockData)) {
        const regex = new RegExp(key, 'gi'); 
        texto = texto.replace(regex, `<span class="bg-blue-500/20 text-blue-300 font-bold px-1 rounded" title="Variável ${key}">${value}</span>`);
    }

    texto = texto.replace(/\*(.*?)\*/g, "<strong>$1</strong>");
    texto = texto.replace(/_(.*?)_/g, "<em>$1</em>");

    display.innerHTML = texto;
};

window.switchTab = switchTab;
window.openModalAdd = openModalAdd;
window.openModalClienteEdit = openModalClienteEdit;
window.deleteCliente = deleteCliente;
window.addThreeDays = addThreeDays;
window.copyFullAccess = copyFullAccess;
window.copyAllAppInfo = copyAllAppInfo;
window.openModalPlanoAdd = openModalPlanoAdd;
window.openModalPlanoEdit = openModalPlanoEdit;
window.deletePlano = deletePlano;
window.openModalAppAdd = openModalAppAdd;
window.openModalAppEdit = openModalAppEdit;
window.deleteApp = deleteApp;
window.openModalRenovar = openModalRenovar;
window.confirmarRenovacao = confirmarRenovacao;
window.deleteFatura = deleteFatura;
window.updateConfig = updateConfig;
window.showNotify = showNotify;
window.checkCustomDays = checkCustomDays;
window.openModalHistory = openModalHistory;
window.toggleFiltrosGaveta = toggleFiltrosGaveta;
window.alternarAbasAuth = alternarAbasAuth;
window.gerarFaturaManual = gerarFaturaManual;
window.excluirFaturaHistorico = excluirFaturaHistorico;
window.excluirCobrancaPendente = excluirCobrancaPendente;
window.openModalEditFatura = openModalEditFatura;
window.confirmarEdicaoFatura = confirmarEdicaoFatura;
window.abrirModalFiltroGrafico = abrirModalFiltroGrafico;

const btnGerarCodigoWA = document.getElementById('btn-gerar-codigo-wa');
if (btnGerarCodigoWA) {
    btnGerarCodigoWA.addEventListener('click', conectarWhatsAppPorCodigo);
}

window.conectarWhatsAppPorCodigo = conectarWhatsAppPorCodigo;

export async function rodarAutomacaoDiaria() {
    const hoje = new Date().toISOString().split('T')[0]; 
    if (!db.config) db.config = {};
    if (db.config.ultimo_disparo_auto === hoje) return; 

    const diasAviso = db.config.aviso_dias || 3;
    const dataAlvo = new Date();
    dataAlvo.setDate(dataAlvo.getDate() + diasAviso);
    const dataAlvoStr = dataAlvo.toISOString().split('T')[0];

    const clientesParaCobrar = (db.clientes || []).filter(c => c.vencimento === dataAlvoStr);

    if (clientesParaCobrar.length > 0) {
        showNotify("Automação Diária", `Iniciando cobrança automática para ${clientesParaCobrar.length} clientes na régua...`, "info");
        for (let cli of clientesParaCobrar) {
            await sendManualWA(cli.id, 'renew'); 
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * (12000 - 5000 + 1)) + 5000));
        }
        showNotify("Concluído", "Todas as cobranças automáticas do dia foram enviadas.");
    }
    
    db.config.ultimo_disparo_auto = hoje;
    save();
}

window.dispararToastTemporizador = function(numero, mensagem, nomeCliente, segundos) {
    let container = document.getElementById('toast-timer-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-timer-container';
        container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }
    
    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = "bg-[#16162d] border border-green-500/30 p-3 rounded-xl shadow-2xl text-xs text-white transform transition-all duration-300 relative overflow-hidden flex flex-col w-72 sm:w-80 pointer-events-auto translate-y-10 opacity-0";
    
    toast.innerHTML = `
        <div class="flex justify-between items-center mb-2 relative z-10">
            <div class="flex-1 pr-2">
                <strong class="text-green-400 block text-sm mb-0.5"><i class="fas fa-paper-plane"></i> Fila de Envio</strong>
                <p class="text-gray-400 text-[10px]">Para <b class="text-white uppercase truncate">${nomeCliente}</b> em <span id="contagem-${toastId}" class="text-amber-400 font-bold text-sm">${segundos}</span>s</p>
            </div>
            <div class="flex gap-2">
                <button id="btn-enviar-agora-${toastId}" class="bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white p-2.5 rounded-lg font-bold transition shadow-sm" title="Enviar Imediatamente">
                    <i class="fas fa-forward"></i>
                </button>
                <button id="btn-cancelar-${toastId}" class="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white p-2.5 rounded-lg font-bold transition shadow-sm" title="Cancelar Envio">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
        <div class="h-1.5 bg-gray-800 rounded-full w-full mt-1 relative z-10 overflow-hidden">
            <div id="barra-${toastId}" class="h-full bg-green-500 transition-all duration-1000 ease-linear" style="width: 100%;"></div>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => { toast.classList.remove('translate-y-10', 'opacity-0'); }, 10);
    
    let tempoRestante = segundos;
    let finalizado = false;
    
    const intervalo = setInterval(() => {
        if (finalizado) return;
        tempoRestante--;
        
        const contadorEl = document.getElementById(`contagem-${toastId}`);
        const barraEl = document.getElementById(`barra-${toastId}`);
        
        if (contadorEl) contadorEl.innerText = tempoRestante;
        if (barraEl) barraEl.style.width = `${(tempoRestante / segundos) * 100}%`;
        
        if (tempoRestante <= 0) {
            finalizarEnvio();
        }
    }, 1000);

    function finalizarEnvio() {
        clearInterval(intervalo);
        finalizado = true;
        sendCustomWA(numero, mensagem, nomeCliente); 
        
        toast.innerHTML = `<strong class="text-blue-400 block p-2 text-center"><i class="fas fa-check mr-2"></i> Enviado com sucesso!</strong>`;
        toast.className = "bg-[#16162d] border border-blue-500/30 p-2 rounded-xl shadow-2xl text-xs transform transition-all duration-300 w-72 sm:w-80 pointer-events-auto";
        
        setTimeout(() => { 
            toast.classList.add('opacity-0', 'translate-x-full'); 
            setTimeout(() => toast.remove(), 300); 
        }, 2500);
    }
    
    document.getElementById(`btn-enviar-agora-${toastId}`).addEventListener('click', (e) => {
        e.preventDefault();
        if(!finalizado) finalizarEnvio();
    });

    document.getElementById(`btn-cancelar-${toastId}`).addEventListener('click', (e) => {
        e.preventDefault();
        if (finalizado) return;
        clearInterval(intervalo);
        finalizado = true;
        toast.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => toast.remove(), 300);
        showNotify('Cancelado', `Envio para ${nomeCliente} abortado.`, 'warning');
    });
};

export function salvarComprovanteFatura() {
    const texto = document.getElementById('fatura-comprovante-texto').value;
    const timerInput = document.getElementById('cfg_timer_comprovante');
    const timer = timerInput ? parseInt(timerInput.value) : 30;
    
    if (!db.config) db.config = {};
    
    db.config.msg_sucesso = texto;
    db.config.timer_comprovante = timer >= 5 ? timer : 30; 
    
    save();
    closeModal('modalTemplateComprovante'); 
    showNotify('Salvo', 'Template e tempo de envio atualizados!');
}
window.salvarComprovanteFatura = salvarComprovanteFatura;

window.abrirModalComprovante = function() {
    const modal = document.getElementById('modalTemplateComprovante');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        showNotify('Erro', 'O código HTML do modal não foi encontrado.', 'error');
    }
};