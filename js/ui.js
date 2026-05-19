import { db, save } from "./database.js";
import { sendManualWA } from "./api.js";

export let isRegisterMode = false;
let financeChart;
let appsDonutChart;

// ====== FUNÇÃO PARA RECOLHER / EXPANDIR SIDEBAR NO DESKTOP ======
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
window.controlarSidebarGeral = controlarSidebarGeral;

window.exportarParaTexto = function() {
    const dadosStr = btoa(unescape(encodeURIComponent(JSON.stringify(window.db))));
    const textarea = document.createElement('textarea');
    textarea.value = dadosStr;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showNotify("Copiado!", "Código de backup copiado para a sua área de transferência!");
};

window.importarDeTexto = function() {
    const codigo = prompt("Cole o código de backup gerado pelo w3Gestor aqui:");
    if (!codigo) return;
    try {
        const dadosDecodificados = JSON.parse(decodeURIComponent(escape(atob(codigo))));
        if (confirm("Isso vai mesclar com seus dados atuais. Continuar?")) {
            if(dadosDecodificados.clientes) window.db.clientes = [...window.db.clientes, ...dadosDecodificados.clientes];
            if(dadosDecodificados.planos) window.db.planos = dadosDecodificados.planos;
            if(dadosDecodificados.apps) window.db.apps = dadosDecodificados.apps;
            window.save();
            location.reload();
        }
    } catch (err) {
        showNotify("Erro", "Código de backup inválido ou corrompido.", "error");
    }
};

window.toggleAuthMode = function() { 
    isRegisterMode = !isRegisterMode; 
    document.getElementById('auth-title').innerText = isRegisterMode ? "Criar Conta Local" : "Aceder ao Painel"; 
    document.getElementById('btn-auth-action').innerText = isRegisterMode ? "Registar" : "Entrar"; 
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
}

export function toggleSidebar() { 
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
    } else {
        sidebar.classList.add('-translate-x-full');
    }
}

// EXPORTS TÉCNICOS EXIGIDOS COM ESCOPO GLOBAL WINDOW
export function openModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
export function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
export function checkCustomDays(v) { const el = document.getElementById('plan_dias_custom'); if (el) el.classList.toggle('hidden', v !== 'custom'); }

window.openModal = openModal;
window.closeModal = closeModal;

export function initApp() {
    renderPlanos(); renderApps(); renderClientes(); renderFaturas(); updateDashboard(); renderConfig();
    const inputWhatsapp = document.getElementById('cli_whatsapp');
    if (inputWhatsapp) {
        inputWhatsapp.addEventListener('input', (e) => {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });
    }
}

export function updateDashboard() {
    const faturas = db.faturas || [];
    const clientes = db.clientes || [];
    const config = db.config || { aviso_dias: 3 };

    const b = faturas.reduce((acc, f) => acc + (f.valor || 0), 0);
    const l = faturas.reduce((acc, f) => acc + (f.lucro || 0), 0);
    const hj = new Date().toISOString().split('T')[0];
    const otr = clientes.filter(c => c.vencimento <= hj).length;

    const previsaoLucroLiquido = clientes.reduce((acc, cli) => {
        const diffDias = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));
        if (diffDias < -20) return acc;
        const plano = db.planos.find(p => p.id == cli.plano_id) || { valor: 0, custo: 0 };
        return acc + ((plano.valor || 0) - (plano.custo || 0));
    }, 0);

    if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = clientes.length;
    if (document.getElementById('stat-bruto')) document.getElementById('stat-bruto').innerText = `R$ ${b.toFixed(2)}`;
    if (document.getElementById('stat-lucro')) document.getElementById('stat-lucro').innerText = `R$ ${l.toFixed(2)}`;
    if (document.getElementById('stat-previsao')) document.getElementById('stat-previsao').innerText = `R$ ${previsaoLucroLiquido.toFixed(2)}`;
    if (document.getElementById('stat-atrasados')) document.getElementById('stat-atrasados').innerText = otr;

    const list = document.getElementById('alerts-list');
    if (list) {
        list.innerHTML = '';
        clientes.forEach(cli => {
            const diff = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));
            if (diff <= config.aviso_dias) {
                list.innerHTML += `
                <div class="flex items-center justify-between p-2 bg-white/[0.02] border border-white/5 shadow-inner rounded-xl min-w-[220px] shrink-0 lg:shrink lg:min-w-0">
                    <div class="min-w-0 flex-1 pr-2">
                        <p class="text-[11px] text-white font-black uppercase tracking-tight truncate">${cli.nome}</p>
                        <span class="mt-0.5 inline-block ${diff <= 0 ? 'text-red-400 bg-red-500/10' : 'text-yellow-500 bg-yellow-500/10'} border border-current rounded text-[8px] font-black px-1.5 py-0.5 uppercase">${diff <= 0 ? 'Atrasado' : 'Em ' + diff + ' d'}</span>
                    </div>
                    <div class="flex gap-1 shrink-0">
                        <button onclick="openModalRenovar(${cli.id})" class="w-7 h-7 flex items-center justify-center bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-xs active:scale-75 transition"><i class="fas fa-check-circle"></i></button>
                        <button onclick="sendManualWA(${cli.id}, 'renew')" class="w-7 h-7 flex items-center justify-center bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-xs active:scale-75 transition"><i class="fab fa-whatsapp"></i></button>
                    </div>
                </div>`;
            }
        });
        if (list.innerHTML === '') {
            list.innerHTML = `<div class="p-2 text-center text-gray-500 text-xs italic w-full">Nenhum vencimento crítico.</div>`;
        }
        renderChartEvolucao();
        renderChartAppsDonut();
    }
}

export function renderChartEvolucao() {
    const el = document.querySelector("#chart-financeiro");
    if (!el || !window.ApexCharts) return;
    const faturas = db.faturas || [];
    const dadosRecentes = faturas.slice(0, 7).reverse();
    
    const options = {
        series: [{ name: 'Faturamento Diário', data: dadosRecentes.map(f => f.lucro || 0) }],
        chart: { type: 'area', height: 140, toolbar: { show: false }, background: 'transparent' },
        theme: { mode: 'dark' },
        stroke: { curve: 'smooth', width: 2.5 },
        colors: ['#a855f7'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.02 } },
        xaxis: { categories: dadosRecentes.map(f => f.data_pgto ? f.data_pgto.slice(0, 5) : "") }
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

    const options = {
        series: Object.values(contagem).length > 0 ? Object.values(contagem) : [0],
        labels: Object.keys(contagem).length > 0 ? Object.keys(contagem) : ["Sem Clientes"],
        chart: { type: 'donut', height: 140, background: 'transparent' },
        theme: { mode: 'dark' },
        colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
        stroke: { show: false },
        legend: { position: 'bottom', fontSize: '10px', labels: { colors: '#9ca3af' } },
        dataLabels: { enabled: false }
    };

    if (appsDonutChart) appsDonutChart.destroy();
    appsDonutChart = new ApexCharts(el, options);
    appsDonutChart.render();
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
        tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-500 italic">Nenhum cliente cadastrado ainda.</td></tr>';
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
    const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6);
    const fimSemanaS = fimSemana.toISOString().split('T')[0];
    const mesBy = hoje.getMonth(), anoBy = hoje.getFullYear();

    db.clientes.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(cli => {
        const p = db.planos.find(x => x.id == cli.plano_id) || { nome: 'N/A' };
        const app = db.apps.find(x => x.id == cli.app_id) || { nome: 'N/A' };
        const diff = Math.ceil((new Date(cli.vencimento) - hoje) / (1000 * 60 * 60 * 24));
        const isOverdue = cli.vencimento < hojeS;
        const isInadimplente = diff < -20;
        const isWarning = diff >= 0 && diff <= 3;

        if (nF && !cli.nome.toLowerCase().includes(nF)) return;
        if (aF && cli.app_id != aF) return;
        if (pF && cli.plano_id != pF) return;
        if (iF && !isInadimplente) return;

        if (sF === 'warning' && !isWarning) return;
        if (sF === 'overdue' && !isOverdue) return;
        if (sF === 'inadimplente' && !isInadimplente) return;
        if (sF === 'hoje' && cli.vencimento !== hojeS) return;
        if (sF === 'semana' && (cli.vencimento < hojeS || cli.vencimento > fimSemanaS)) return;
        if (sF === 'mes') {
            const dP = cli.vencimento.split('-');
            if (parseInt(dP[1]) !== (mesBy + 1) || parseInt(dP[0]) !== anoBy) return;
        }

        let rCls = isInadimplente ? 'row-inadimplente' : (isOverdue ? 'row-overdue' : (isWarning ? 'row-warning' : ''));

        tableBody.innerHTML += `<tr class="border-t border-gray-800/50 text-xs hover:bg-white/5 ${rCls}">
            <td class="p-2.5 text-center w-10"><input type="checkbox" class="client-checkbox" value="${cli.id}" onchange="window.atualizarBarraAcoes()"></td>
            <td class="p-2.5 font-bold text-white uppercase">${cli.nome}</td>
            <td class="p-2.5 uppercase text-[10px] text-gray-400">${p.nome}<br><span class="text-purple-400 font-bold">${app.nome}</span></td>
            <td class="p-2.5 text-center font-bold ${isOverdue ? 'text-red-500' : (isWarning ? 'text-yellow-500' : 'text-green-500')}">${cli.vencimento.split('-').reverse().join('/')}</td>
            <td class="p-2.5 text-center">
                <div class="flex items-center justify-center gap-3">
                    <button onclick="sendManualWA(${cli.id}, 'renew')" class="text-purple-400"><i class="fas fa-redo"></i></button>
                    <button onclick="sendManualWA(${cli.id}, 'welcome')" class="text-green-500"><i class="fas fa-star"></i></button>
                    <button onclick="sendManualWA(${cli.id}, 'suspended')" class="text-red-500"><i class="fas fa-ban"></i></button>
                </div>
            </td>
            <td class="p-2.5 text-right space-x-1 whitespace-nowrap">
                <button onclick="copyFullAccess(${cli.id})" class="text-purple-400 p-1"><i class="fas fa-copy"></i></button>
                <button onclick="openModalRenovar(${cli.id})" class="px-2 py-0.5 bg-green-600 text-white rounded text-[9px] font-black">PAGO</button>
                <button onclick="addThreeDays(${cli.id})" class="p-1 text-purple-400"><i class="fas fa-plus"></i></button>
                <button onclick="openModalClienteEdit(${cli.id})" class="text-gray-500 p-1"><i class="fas fa-edit"></i></button>
                <button onclick="deleteCliente(${cli.id})" class="text-gray-700 p-1"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;

        mobileContainer.innerHTML += `
        <div class="card p-3 rounded-xl border border-white/5 bg-[#16162d] mb-2 text-xs">
            <div class="flex justify-between items-start">
                <h4 class="font-black text-white uppercase truncate max-w-[150px]">${cli.nome}</h4>
                <span class="font-mono text-[11px] text-gray-400">${cli.vencimento.split('-').reverse().join('/')}</span>
            </div>
            <div class="flex justify-between items-center mt-2.5 pt-2 border-t border-white/5">
                <span class="text-[10px] text-purple-400 uppercase font-bold">${p.nome} • ${app.nome}</span>
                <div class="flex gap-3">
                    <button onclick="openModalNotifyMenu(${cli.id})" class="text-purple-400"><i class="fas fa-bell"></i></button>
                    <button onclick="openModalClienteEdit(${cli.id})" class="text-gray-400"><i class="fas fa-edit"></i></button>
                    <button onclick="openModalRenovar(${cli.id})" class="text-green-400 font-bold">PAGO</button>
                </div>
            </div>
        </div>`;
    });
    if(tableBody.innerHTML==='') tableBody.innerHTML='<tr><td colspan="6" class="p-4 text-center text-gray-500">Nenhum cliente.</td></tr>';
    if(mobileContainer.innerHTML==='') mobileContainer.innerHTML='<div class="text-center p-4 text-gray-500">Nenhum cliente.</div>';
}

export function openModalRenovar(id) {
    const cli = db.clientes.find(c => c.id == id);
    const p = db.planos.find(pl => pl.id == cli.plano_id) || { valor: 0 };
    document.getElementById('renovar-cli-id').value = id;
    document.getElementById('renovar-info').innerText = `Marcar R$ ${p.valor.toFixed(2)} pagos por ${cli.nome}?`;
    openModal('modalRenovar');
}
window.openModalRenovar = openModalRenovar;

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
window.openModalClienteEdit = openModalClienteEdit;

export function renderPlanos() {
    const list = document.getElementById('planos-list'); if (!list) return;
    list.innerHTML = db.planos.map(p => `
        <div class="card p-4 rounded-xl relative shadow-xl border border-white/5 bg-gray-900/40 text-xs">
            <div class="absolute top-2 right-2 flex gap-2">
                <button onclick="openModalPlanoEdit(${p.id})" class="text-gray-500"><i class="fas fa-edit"></i></button>
                <button onclick="deletePlano(${p.id})" class="text-gray-700"><i class="fas fa-trash"></i></button>
            </div>
            <h4 class="font-bold text-white uppercase">${p.nome}</h4>
            <p class="text-[9px] text-gray-500 font-black mt-0.5">${p.dias} DIAS</p>
            <div class="mt-2 flex justify-between border-t border-gray-800 pt-2">
                <span>Preço: R$ ${p.valor.toFixed(2)}</span>
                <span class="text-purple-400 font-bold">Lucro: R$ ${(p.valor - p.custo).toFixed(2)}</span>
            </div>
        </div>`).join('');
}

export function renderApps() {
    const list = document.getElementById('apps-list'); if (!list) return;
    list.innerHTML = db.apps.map(a => `
        <div onclick="window.copyAllAppInfo('${a.nome}', '${a.url || ''}', '${a.pin || ''}')" class="card p-3 rounded-xl border border-white/5 bg-gray-900/40 cursor-pointer text-xs">
            <div class="flex justify-between items-center">
                <h4 class="font-black text-purple-400 uppercase">${a.nome}</h4>
                <div class="flex gap-2" onclick="event.stopPropagation();">
                    <button onclick="openModalAppEdit(${a.id})" class="text-gray-500"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteApp(${a.id})" class="text-gray-700"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>`).join('');
}

export function renderFaturas() {
    const pBody = document.getElementById('table-faturas-pendentes-body');
    const hBody = document.getElementById('table-faturas-body');
    if (!pBody || !hBody) return;
    const hoje = new Date().toISOString().split('T')[0];
    const pendentes = (db.clientes || []).filter(c => c.vencimento <= hoje);

    pBody.innerHTML = pendentes.map(cli => {
        const plano = db.planos.find(p => p.id == cli.plano_id) || { nome: 'N/A', valor: 0 };
        return `<tr class="border-t border-gray-800 text-xs">
            <td class="p-3 font-bold text-red-400">${cli.vencimento.split('-').reverse().join('/')}</td>
            <td class="p-3 text-white uppercase font-bold">${cli.nome}</td>
            <td class="p-3 text-gray-400 uppercase">${plano.nome}</td>
            <td class="p-3 text-white">R$ ${plano.valor.toFixed(2)}</td>
            <td class="p-3 text-right"><button onclick="openModalRenovar(${cli.id})" class="px-2 py-0.5 bg-green-600/20 text-green-500 border border-green-500/20 rounded font-black text-[9px]">RECEBER</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" class="p-3 text-center text-gray-500">Nenhuma fatura em aberto.</td></tr>';
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
}

export function showNotify(titulo, message, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = "pointer-events-auto w-full bg-[#16162d]/95 backdrop-blur-md border border-white/5 p-3 rounded-xl shadow-2xl flex items-start gap-3 transform translate-x-20 opacity-0 transition-all duration-300 text-xs";
    toast.innerHTML = `<div><h4 class="font-bold text-white uppercase tracking-wider">${titulo}</h4><p class="text-gray-400 mt-0.5">${message}</p></div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-x-20', 'opacity-0'); }, 10);
    setTimeout(() => { toast.classList.add('translate-x-20', 'opacity-0'); setTimeout(() => { toast.remove(); }, 300); }, 4000);
}
window.showNotify = showNotify;

export function toggleFiltrosGaveta(open) {
    const gaveta = document.getElementById('gaveta-filtros');
    const fundo = document.getElementById('fundo-gaveta');
    if (!gaveta || !fundo) return;
    if (open) {
        gaveta.classList.remove('hidden', 'translate-y-full');
    } else {
        gaveta.classList.add('translate-y-full', 'hidden');
    }
}
window.toggleFiltrosGaveta = toggleFiltrosGaveta;

window.dispararNotificacaoEmMassa = async function() {
    const selecionados = Array.from(document.querySelectorAll('.client-checkbox:checked')).map(cb => cb.value);
    if (selecionados.length === 0) return;
    const miniBadge = document.getElementById('badgeProgressoFlutuante');
    if (miniBadge) miniBadge.classList.remove('hidden');

    for (let i = 0; i < selecionados.length; i++) {
        if (typeof sendManualWA === "function") sendManualWA(selecionados[i], 'renew');
        await new Promise(r => setTimeout(r, 3000));
    }
    if (miniBadge) miniBadge.classList.add('hidden');
    showNotify("Concluído", "Fila de cobranças disparada!");
};

window.dispararAlertaGeral = async function(tipoAlerta) {
    const ativos = (db.clientes || []).filter(cli => {
        const diff = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));
        return diff >= -20;
    });
    if (ativos.length === 0) return;
    if (!confirm(`Transmitir alerta de ${tipoAlerta.toUpperCase()} para ${ativos.length} clientes?`)) return;

    const miniBadge = document.getElementById('badgeProgressoFlutuante');
    if (miniBadge) miniBadge.classList.remove('hidden');

    for (let i = 0; i < ativos.length; i++) {
        if (typeof sendManualWA === "function") sendManualWA(ativos[i].id, tipoAlerta);
        await new Promise(r => setTimeout(r, 3000));
    }
    if (miniBadge) miniBadge.classList.add('hidden');
    showNotify("Concluído", "Alerta geral transmitido!");
};
