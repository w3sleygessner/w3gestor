import { db, save } from "./database.js";
import { sendManualWA } from "./api.js";

export let isRegisterMode = false;
let financeChart;
let appsDonutChart;

// --- NAVEGAÇÃO E MODAIS ---

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

    if (tab === 'admin') {
        import('./admin.js').then(moduloAdmin => {
            moduloAdmin.carregarAssinantes();
        }).catch(err => console.error("Erro ao carregar o arquivo admin.js:", err));
    }

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

export function openModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
export function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
export function checkCustomDays(v) { const el = document.getElementById('plan_dias_custom'); if (el) el.classList.toggle('hidden', v !== 'custom'); }

// --- DASHBOARD E GRÁFICOS ---
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

    // Cálculo Real de Faturamento Estimado (Previsão do Mês)
    const previsaoFaturamento = clientes.reduce((acc, cli) => {
        const plano = db.planos.find(p => p.id == cli.plano_id) || { valor: 0 };
        return acc + (plano.valor || 0);
    }, 0);

    if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = clientes.length;
    if (document.getElementById('stat-bruto')) document.getElementById('stat-bruto').innerText = `R$ ${b.toFixed(2)}`;
    if (document.getElementById('stat-lucro')) document.getElementById('stat-lucro').innerText = `R$ ${l.toFixed(2)}`;
    if (document.getElementById('stat-previsao')) document.getElementById('stat-previsao').innerText = `R$ ${previsaoFaturamento.toFixed(2)}`;
    if (document.getElementById('stat-atrasados')) document.getElementById('stat-atrasados').innerText = otr;

    const list = document.getElementById('alerts-list');
    if (list) {
        list.innerHTML = '';
        clientes.forEach(cli => {
            const diff = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));
            if (diff <= config.aviso_dias) {
                list.innerHTML += `
                <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                    <p class="text-xs text-white font-bold tracking-tight">${cli.nome} <br>
                    <span class="${diff <= 0 ? 'text-red-500' : 'text-yellow-500'} text-[9px] uppercase font-black">${diff <= 0 ? 'Atrasado' : 'Em ' + diff + ' d'}</span></p>
                    <div class="flex gap-2">
                        <button onclick="openModalRenovar(${cli.id})" class="text-green-500"><i class="fas fa-check-circle"></i></button>
                        <button onclick="sendManualWA(${cli.id}, 'renew')" class="text-purple-400"><i class="fab fa-whatsapp"></i></button>
                    </div>
                </div>`;
            }
        });
        if (list.innerHTML === '') {
            list.innerHTML = `<div class="p-3 text-center text-gray-500 text-xs italic col-span-full">Sem vencimentos críticos.</div>`;
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
    
    // Transformado em gráfico de linha fluida para mostrar picos reais de entradas de caixa
    const options = {
        series: [{ name: 'Faturamento Diário', data: dadosRecentes.map(f => f.lucro || 0) }],
        chart: { type: 'area', height: 200, toolbar: { show: false }, background: 'transparent', sparkline: { enabled: false } },
        theme: { mode: 'dark' },
        stroke: { curve: 'smooth', width: 3 },
        colors: ['#a855f7'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
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

    const seriesData = Object.values(contagem);
    const labelsData = Object.keys(contagem);

    const options = {
        series: seriesData.length > 0 ? seriesData : [0],
        labels: labelsData.length > 0 ? labelsData : ["Sem Clientes"],
        chart: { type: 'donut', height: 200, background: 'transparent' },
        theme: { mode: 'dark' },
        colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
        stroke: { show: false },
        legend: { position: 'bottom', labels: { colors: '#9ca3af' } },
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

    const elName = document.getElementById('filter-name');
    const elApp = document.getElementById('filter-app');
    const elPlano = document.getElementById('filter-plano');
    const elStatus = document.getElementById('filter-status');
    const elInad = document.getElementById('filter-inadimplentes');

    const nF = (elName && elName.value) ? elName.value.toLowerCase() : "";
    const aF = (elApp && elApp.value) ? elApp.value : "";
    const pF = (elPlano && elPlano.value) ? elPlano.value : "";
    const sF = (elStatus && elStatus.value) ? elStatus.value : "";
    const iF = elInad ? elInad.checked : false;
    
    const hoje = new Date(); 
    const hojeS = hoje.toISOString().split('T')[0];

    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    const fimSemanaS = fimSemana.toISOString().split('T')[0];

    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const clientesFiltrados = [];

    db.clientes.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(cli => {
        const p = db.planos.find(x => x.id == cli.plano_id) || { nome: 'N/A' };
        const app = db.apps.find(x => x.id == cli.app_id) || { nome: 'N/A' };
        const diff = Math.ceil((new Date(cli.vencimento) - hoje) / (1000 * 60 * 60 * 24));
        const isOverdue = cli.vencimento < hojeS;
        const isInadimplente = diff < -20;
        const isWarning = diff >= 0 && diff <= 3;

        if (nF && !cli.nome.toLowerCase().includes(nF)) return;
        if (aF && (!cli.app_id || cli.app_id.toString() !== aF.toString())) return;
        if (pF && (!cli.plano_id || cli.plano_id.toString() !== pF.toString())) return;
        if (iF && !isInadimplente) return;

        if (sF === 'warning' && !isWarning) return;
        if (sF === 'overdue' && !isOverdue) return;
        if (sF === 'inadimplente' && !isInadimplente) return;
        if (sF === 'hoje' && cli.vencimento !== hojeS) return;
        if (sF === 'semana' && (cli.vencimento < hojeS || cli.vencimento > fimSemanaS)) return;
        if (sF === 'mes') {
            const dateParts = cli.vencimento.split('-');
            if (parseInt(dateParts[1]) !== (mesAtual + 1) || parseInt(dateParts[0]) !== anoAtual) return;
        }

        clientesFiltrados.push(cli);

        let rCls = '';
        if (isInadimplente) rCls = 'row-inadimplente';
        else if (isOverdue) rCls = 'row-overdue';
        else if (isWarning) rCls = 'row-warning';

        tableBody.innerHTML += `<tr class="border-t border-gray-800/50 transition hover:bg-white/5 ${rCls}">
            <td class="p-3 text-center w-10">
                <input type="checkbox" class="client-checkbox" value="${cli.id}" onchange="window.atualizarBarraAcoes()"
                       style="appearance: none; -webkit-appearance: none; width: 16px; height: 16px; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; background: rgba(255,255,255,0.05); cursor: pointer; display: inline-grid; place-content: center; transition: all 0.2s;">
            </td>
            <td class="p-3"><p class="font-bold text-white text-xs uppercase tracking-tight">${cli.nome}</p></td>
            <td class="p-3 text-[9px] uppercase"><span class="text-gray-400">${p.nome}</span><br><span class="text-purple-400 font-bold">${app.nome}</span></td>
            <td class="p-3 text-center text-[10px] font-bold ${isOverdue ? 'text-red-500' : (isWarning ? 'text-yellow-500' : 'text-green-500')}">${cli.vencimento.split('-').reverse().join('/')}</td>
            <td class="p-3 text-center">
                <div class="flex flex-col items-center gap-1">
                    <span class="text-[9px] text-gray-500 font-mono tracking-tighter">${cli.whatsapp}</span>
                    <div class="flex gap-2">
                        <button onclick="sendManualWA(${cli.id}, 'renew')" title="Aviso" class="text-purple-400 text-xs"><i class="fas fa-redo"></i></button>
                        <button onclick="sendManualWA(${cli.id}, 'welcome')" title="Boas-vindas" class="text-green-500 text-xs"><i class="fas fa-star"></i></button>
                        <button onclick="sendManualWA(${cli.id}, 'suspended')" title="Suspender" class="text-red-500 text-xs"><i class="fas fa-ban"></i></button>
                    </div>
                </div>
            </td>
            <td class="p-3 text-right space-x-1">
                <button onclick="copyFullAccess(${cli.id})" title="Copiar Dados" class="p-2 text-purple-400 hover:scale-110"><i class="fas fa-copy"></i></button>
                <button onclick="openModalRenovar(${cli.id})" class="px-3 py-1 bg-green-600 text-white rounded text-[8px] font-black hover:bg-green-700 shadow shadow-green-500/20">PAGO</button>
                <button onclick="addThreeDays(${cli.id})" class="p-2 bg-purple-600/20 text-purple-400 rounded btn-plus-days"><i class="fas fa-plus"></i></button>
                <button onclick="openModalEdit(${cli.id})" class="p-2 text-gray-500 hover:text-white"><i class="fas fa-edit"></i></button>
                <button onclick="deleteCliente(${cli.id})" class="p-2 text-gray-700 hover:text-red-500"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });

    if (clientesFiltrados.length === 0) {
        mobileContainer.innerHTML = `<div class="text-center p-6 text-gray-500 text-xs uppercase font-bold bg-[#16162d] rounded-2xl border border-white/5">Nenhum cliente corresponde aos filtros</div>`;
    } else {
        clientesFiltrados.forEach(cli => {
            const p = db.planos.find(x => x.id == cli.plano_id) || { nome: 'N/A' };
            const app = db.apps.find(x => x.id == cli.app_id) || { nome: 'N/A' };
            const diff = Math.ceil((new Date(cli.vencimento) - hoje) / (1000 * 60 * 60 * 24));
            
            const isOverdue = cli.vencimento < hojeS;
            const isInadimplente = diff < -20;
            const isWarning = diff >= 0 && diff <= 3;

            let cardBorder = 'border-white/5 bg-[#16162d]';
            let statusBadge = '<span class="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[9px] font-bold uppercase tracking-wider">Ativo</span>';

            if (isInadimplente) {
                cardBorder = 'border-purple-500/20 bg-purple-950/5';
                statusBadge = '<span class="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-[9px] font-bold uppercase tracking-wider">Inadimplente</span>';
            } else if (isOverdue) {
                cardBorder = 'border-red-500/20 bg-red-950/5';
                statusBadge = '<span class="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[9px] font-bold uppercase tracking-wider">Atrasado</span>';
            } else if (isWarning) {
                cardBorder = 'border-yellow-500/20 bg-yellow-950/5';
                statusBadge = '<span class="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded text-[9px] font-bold uppercase tracking-wider">Vence logo</span>';
            }

            mobileContainer.innerHTML += `
                <div class="card p-4 rounded-2xl border ${cardBorder} flex flex-col gap-3 shadow-xl mx-0.5 mb-3">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <input type="checkbox" value="${cli.id}" onchange="window.atualizarBarraAcoes()" class="client-checkbox w-4 h-4 rounded border-white/10 bg-white/5 text-purple-600 focus:ring-purple-500/50 cursor-pointer transition shrink-0"
                                   style="appearance: none; -webkit-appearance: none; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; background: rgba(255,255,255,0.05); display: inline-grid; place-content: center;">
                            <div class="min-w-0">
                                <h4 class="font-black text-white uppercase text-xs tracking-tight truncate">${cli.nome}</h4>
                                <div class="flex items-center gap-2 mt-1.5">${statusBadge}</div>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="text-[9px] text-gray-500 uppercase block font-bold tracking-wider">Vencimento</span>
                            <strong class="text-xs font-mono text-white block mt-0.5">${cli.vencimento.split('-').reverse().join('/')}</strong>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 my-1 bg-black/20 p-2.5 rounded-xl border border-white/5 text-[10px]">
                        <div><span class="text-gray-500 font-bold uppercase text-[8px] block tracking-wide">Plano</span> <strong class="text-purple-400 font-black uppercase">${p.nome}</strong></div>
                        <div><span class="text-gray-500 font-bold uppercase text-[8px] block tracking-wide">Aplicativo</span> <strong class="text-gray-300 font-bold uppercase">${app.nome}</strong></div>
                    </div>
                    <div class="flex gap-2 w-full mt-1">
                        <button onclick="openModalNotifyMenu(${cli.id})" class="flex-1 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider text-center shadow-md active:scale-95 transition"><i class="fas fa-bell mr-1"></i> Cobrar</button>
                        <a href="https://wa.me/${cli.whatsapp.replace(/\D/g,'')}" target="_blank" class="w-10 h-9 flex items-center justify-center bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/20 rounded-xl transition active:scale-95"><i class="fab fa-whatsapp text-sm"></i></a>
                        <button onclick="openModalEdit(${cli.id})" class="w-10 h-9 flex items-center justify-center bg-white/5 text-gray-400 rounded-xl border border-white/5 transition active:scale-95"><i class="fas fa-edit text-xs"></i></button>
                        <button onclick="deleteCliente(${cli.id})" class="w-10 h-9 flex items-center justify-center bg-red-600/5 text-red-500/70 rounded-xl border border-red-500/10 transition active:scale-95"><i class="fas fa-trash text-xs"></i></button>
                    </div>
                </div>`;
        });
    }
}

export function renderPlanos() {
    const list = document.getElementById('planos-list'); if (!list) return;
    list.innerHTML = db.planos.map(p => {
        const valorLucro = p.valor - p.custo;
        const margemPorcentagem = p.valor > 0 ? Math.round((valorLucro / p.valor) * 100) : 0;
        return `
        <div class="card p-4 rounded-xl relative shadow-xl border border-white/5 bg-gray-900/40">
            <div class="absolute top-2 right-2 flex gap-2 z-20">
                <button onclick="openModalPlanoEdit(${p.id})" class="text-gray-500 hover:text-white transition"><i class="fas fa-edit"></i></button>
                <button onclick="deletePlano(${p.id})" class="text-gray-700 hover:text-red-500 transition"><i class="fas fa-trash"></i></button>
            </div>
            <span class="absolute bottom-12 right-4 bg-green-500/10 text-green-400 border border-green-500/20 text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">+${margemPorcentagem}% Margem</span>
            <h4 class="font-bold text-white text-sm uppercase">${p.nome}</h4>
            <p class="text-[9px] text-gray-500 font-black">${p.dias} DIAS</p>
            <div class="mt-2 text-[10px] flex justify-between border-t border-gray-800 pt-2 w-full">
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

window.copyAllAppInfo = function(nome, url, pin) {
    const textoParaCopiar = `*Aplicativo:* ${nome}\n*DNS/URL:* ${url || 'N/A'}\n*PIN:* ${pin || 'N/A'}`;
    const el = document.createElement('textarea');
    el.value = textoParaCopiar;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showNotify("Copiado!", `Dados do ${nome} copiados com sucesso!`);
};

export function renderApps() {
    const list = document.getElementById('apps-list'); 
    if (!list) return;
    
    list.innerHTML = db.apps.map(a => `
        <div onclick="window.copyAllAppInfo('${a.nome}', '${a.url || ''}', '${a.pin || ''}')" class="card p-4 rounded-xl relative shadow-xl border border-white/5 bg-gray-900/40 cursor-pointer hover:border-purple-500/30 transition-all active:scale-95 duration-100">
            <div class="absolute top-3 right-3 flex gap-2.5 z-20" onclick="event.stopPropagation();">
                <button onclick="openModalAppEdit(${a.id})" class="text-gray-500 hover:text-white transition"><i class="fas fa-edit"></i></button>
                <button onclick="deleteApp(${a.id})" class="text-gray-700 hover:text-red-500 transition"><i class="fas fa-trash"></i></button>
            </div>
            <h4 class="font-black text-purple-400 text-sm uppercase tracking-tight">${a.nome}</h4>
            <p class="text-[10px] text-gray-400 mt-1 truncate uppercase"><span class="text-gray-600 font-bold">DNS:</span> ${a.url || 'N/A'}</p>
            <div class="mt-3 text-[9px] font-mono flex justify-between border-t border-white/5 pt-2.5 text-gray-500">
                <span>PIN: <strong class="text-white font-bold">${a.pin || 'N/A'}</strong></span>
                <span class="text-purple-400 uppercase font-black tracking-wider"><i class="fas fa-copy text-[8px] mr-1"></i> Copiar Tudo</span>
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
    const hBody = document.getElementById('table-faturas-body');
    if (!pBody || !hBody) return;

    const hoje = new Date().toISOString().split('T')[0];
    const clientes = db.clientes || [];
    const faturas = db.faturas || [];

    const pendentes = clientes
        .filter(c => c.vencimento <= hoje)
        .sort((a, b) => new Date(b.vencimento) - new Date(a.vencimento));

    pBody.innerHTML = pendentes.map(cli => {
        const plano = db.planos.find(p => p.id == cli.plano_id) || { nome: 'N/A', valor: 0 };
        return `<tr class="border-t border-gray-800 text-[10px] hover:bg-white/5">
    <td class="p-4 font-bold text-red-400">${cli.vencimento.split('-').reverse().join('/')}</td>
    <td class="p-4 text-white uppercase font-bold">${cli.nome}</td>
    <td class="p-4 text-gray-400 uppercase">${plano.nome}</td>
    <td class="p-4 text-white">R$ ${plano.valor.toFixed(2)}</td>
    <td class="p-4 text-right">
        <button onclick="openModalRenovar(${cli.id})" class="px-3 py-1 bg-green-600/20 text-green-400 border border-green-500/30 rounded text-[9px] font-black hover:bg-green-600 hover:text-white transition">RECEBER AGORA</button>
    </td>
</tr>`;
    }).join('') || '<tr><td colspan="5" class="p-4 text-center text-gray-500 italic">Nenhuma fatura em aberto.</td></tr>';

    let totalLucro = 0;
    hBody.innerHTML = faturas.map(f => {
        totalLucro += (f.lucro || 0);
        return `<tr class="border-t border-gray-800 text-[10px]">
    <td class="p-4 text-gray-500">${f.data_pgto}</td>
    <td class="p-4 font-bold text-white uppercase">${f.cliente}</td>
    <td class="p-4 text-green-500 font-bold">R$ ${(f.valor || 0).toFixed(2)}</td>
    <td class="p-4 text-purple-400 font-bold">R$ ${(f.lucro || 0).toFixed(2)}</td>
    <td class="p-4 text-right">
        <button onclick="deleteFatura(${f.id})" class="text-red-500 hover:text-red-400 transition"><i class="fas fa-undo"></i></button>
    </td>
</tr>`;
    }).join('') || '<tr><td colspan="5" class="p-4 text-center text-gray-500 italic">Sem histórico de pagamentos.</td></tr>';

    if (document.getElementById('fatura-total-lucro')) {
        document.getElementById('fatura-total-lucro').innerText = `R$ ${totalLucro.toFixed(2)}`;
    }
}

export function renderConfig() {
    const config = db.config || {};
    const elAviso = document.getElementById('cfg_aviso_dias');
    const elBoasVindas = document.getElementById('cfg_msg_boas_vindas');
    const elRenovacao = document.getElementById('cfg_msg_renovacao');
    const elSucesso = document.getElementById('cfg_msg_sucesso');
    const elSuspensa = document.getElementById('cfg_msg_suspensa');
    const elOscilacao = document.getElementById('cfg_msg_oscilacao');
    const elManutencao = document.getElementById('cfg_msg_manutencao');

    if(elAviso) elAviso.value = config.aviso_dias || 3;
    if(elBoasVindas) elBoasVindas.value = config.msg_boas_vindas || "";
    if(elRenovacao) elRenovacao.value = config.msg_renovacao || "";
    if(elSucesso) elSucesso.value = config.msg_sucesso || "";
    if(elSuspensa) elSuspensa.value = config.msg_suspensa || "";
    if(elOscilacao) elOscilacao.value = config.msg_oscilacao || "";
    if(elManutencao) elManutencao.value = config.msg_manutencao || "";
}

export function updateConfig() {
    db.config = {
        aviso_dias: document.getElementById('cfg_aviso_dias') ? parseInt(document.getElementById('cfg_aviso_dias').value) : 3,
        msg_boas_vindas: document.getElementById('cfg_msg_boas_vindas') ? document.getElementById('cfg_msg_boas_vindas').value : "",
        msg_renovacao: document.getElementById('cfg_msg_renovacao') ? document.getElementById('cfg_msg_renovacao').value : "",
        msg_sucesso: document.getElementById('cfg_msg_sucesso') ? document.getElementById('cfg_msg_sucesso').value : "",
        msg_suspensa: document.getElementById('cfg_msg_suspensa') ? document.getElementById('cfg_msg_suspensa').value : "",
        msg_oscilacao: document.getElementById('cfg_msg_oscilacao') ? document.getElementById('cfg_msg_oscilacao').value : "",
        msg_manutencao: document.getElementById('cfg_msg_manutencao') ? document.getElementById('cfg_msg_manutencao').value : ""
    };
    save(); showNotify('Sucesso', 'Configurações salvas!');
}

export function openModalAdd() { 
    if (db.account && db.account.type !== 'vip' && db.clientes.length >= 3) {
        openModal('modalLimiteClientes'); 
        return; 
    }
    document.getElementById('formCliente').reset(); 
    document.getElementById('cli_edit_id').value = ""; 
    document.getElementById('modalClienteTitle').innerText = "Novo Cliente"; 
    renderPlanos(); 
    renderApps(); 
    openModal('modalCliente'); 
}

export function openModalEdit(id) {
    const cli = db.clientes.find(c => c.id == id);
    document.getElementById('cli_edit_id').value = cli.id; document.getElementById('cli_nome').value = cli.nome; document.getElementById('cli_whatsapp').value = cli.whatsapp; document.getElementById('cli_plano_id').value = cli.plano_id; document.getElementById('cli_app_id').value = cli.app_id; document.getElementById('cli_vencimento').value = cli.vencimento; document.getElementById('cli_credenciais').value = cli.credenciais || "";
    document.getElementById('modalClienteTitle').innerText = "Editar Cliente"; openModal('modalCliente');
}

export function deleteCliente(id) {
    Swal.fire({
        title: 'Excluir Cliente?',
        text: "Tem certeza que deseja apagar este cliente? Esta ação não pode ser desfeita.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#374151',
        confirmButtonText: 'Sim, apagar!',
        cancelButtonText: 'Cancelar',
        background: '#16162d',
        color: '#ffffff',
        iconColor: '#ef4444'
    }).then((result) => {
        if (result.isConfirmed) {
            db.clientes = db.clientes.filter(c => c.id != id);
            save();
            renderClientes();
            updateDashboard();
            showNotify('Removido', 'O cliente foi excluído com sucesso.', 'success');
        }
    });
}

export function openModalAppAdd() { document.getElementById('formApp').reset(); document.getElementById('app_edit_id').value = ""; document.getElementById('modalAppTitle').innerText = "Novo App"; openModal('modalApp'); }

export function openModalAppEdit(id) {
    const a = db.apps.find(x => x.id == id);
    document.getElementById('app_edit_id').value = a.id; document.getElementById('app_nome').value = a.nome; document.getElementById('app_url').value = a.url || ""; document.getElementById('app_host').value = a.host || ""; document.getElementById('app_pin').value = a.pin || ""; document.getElementById('app_links').value = a.links || "";
    document.getElementById('modalAppTitle').innerText = "Editar App"; openModal('modalApp');
}

export function deleteApp(id) {
    Swal.fire({
        title: 'Excluir Esta Aplicação?',
        text: "Os clientes que usam este app perderão as credenciais e dados de acesso vinculados.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#374151',
        confirmButtonText: 'Sim, remover!',
        cancelButtonText: 'Cancelar',
        background: '#16162d',
        color: '#ffffff',
        iconColor: '#ef4444'
    }).then((result) => {
        if (result.isConfirmed) {
            db.apps = db.apps.filter(a => a.id != id);
            save();
            renderApps();
            showNotify('App Removido', 'A aplicação foi excluída com sucesso.', 'success');
        }
    });
}

export function openModalPlanoAdd() { document.getElementById('formPlano').reset(); document.getElementById('plan_edit_id').value = ""; document.getElementById('modalPlanoTitle').innerText = "Novo Plano"; openModal('modalPlano'); }

export function openModalPlanoEdit(id) {
    const p = db.planos.find(pl => pl.id == id);
    document.getElementById('plan_edit_id').value = p.id; document.getElementById('plan_nome').value = p.nome; document.getElementById('plan_valor').value = p.valor; document.getElementById('plan_custo').value = p.custo;
    document.getElementById('plan_dias_select').value = [30, 60, 90].includes(p.dias) ? p.dias : 'custom';
    if (p.dias != 30 && p.dias != 60 && p.dias != 90) document.getElementById('plan_dias_custom').value = p.dias;
    checkCustomDays(document.getElementById('plan_dias_select').value); document.getElementById('modalPlanoTitle').innerText = "Editar Plano"; openModal('modalPlano');
}

export function deletePlano(id) {
    Swal.fire({
        title: 'Excluir Este Plano?',
        text: "Os clientes vinculados a este plano perderão a referência de preço.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#374151',
        confirmButtonText: 'Sim, remover!',
        cancelButtonText: 'Cancelar',
        background: '#16162d',
        color: '#ffffff',
        iconColor: '#ef4444'
    }).then((result) => {
        if (result.isConfirmed) {
            db.planos = db.planos.filter(p => p.id != id);
            save();
            renderPlanos();
            showNotify('Plano Removido', 'O plano foi excluído com sucesso.', 'success');
        }
    });
}

export function openModalRenovar(id) {
    const cli = db.clientes.find(c => c.id == id);
    const p = db.planos.find(pl => pl.id == cli.plano_id) || { valor: 0 };
    document.getElementById('renovar-cli-id').value = id;
    document.getElementById('renovar-info').innerText = `Marcar R$ ${p.valor.toFixed(2)} pagos por ${cli.nome}?`;
    openModal('modalRenovar');
}

export function confirmarRenovacao() {
    const id = document.getElementById('renovar-cli-id').value;
    const cliIdx = db.clientes.findIndex(c => c.id == id);
    const cli = db.clientes[cliIdx];
    const p = db.planos.find(pl => pl.id == cli.plano_id);
    let base = new Date(); const vAtual = new Date(cli.vencimento);
    if (vAtual > base) base = vAtual;
    base.setDate(base.getDate() + parseInt(p.dias));
    db.clientes[cliIdx].vencimento = base.toISOString().split('T')[0];
    db.faturas.unshift({ id: Date.now(), cliId: cli.id, data_pgto: new Date().toLocaleDateString(), cliente: cli.nome, valor: p.valor, lucro: p.valor - p.custo, dias_somados: p.dias });
    save(); closeModal('modalRenovar'); renderClientes(); renderFaturas(); updateDashboard(); showNotify('Pago!', 'Vencimento updated.');
    setTimeout(() => sendManualWA(id, 'success'), 500);
}

export function deleteFatura(fid) {
    if (!confirm("Estornar pagamento? O vencimento voltará ao anterior.")) return;
    const f = db.faturas.find(x => x.id == fid);
    const cIdx = db.clientes.findIndex(c => c.id == f.cliId);
    if (cIdx !== -1) {
        let d = new Date(db.clientes[cIdx].vencimento);
        d.setDate(d.getDate() - parseInt(f.dias_somados));
        db.clientes[cIdx].vencimento = d.toISOString().split('T')[0];
    }
    db.faturas = db.faturas.filter(x => x.id != fid); save(); renderFaturas(); updateDashboard(); showNotify('Estornado', 'Vencimento corrigido.');
}

export function processCredentials(text) {
    if (!text) return { clean: "", user: "", pass: "" };
    const uM = text.match(/(?:Usuário|Usuario|User):\s*([^\n\r\s✅✨⭐👤]+)/i);
    const sM = text.match(/(?:Senha|Pass):\s*([^\n\r\s🔑🔒]+)/i);
    let lines = text.split('\n').filter(l => !l.includes('superc.space') && !l.includes('Assinar') && !l.includes('Vencimento:') && !l.includes('🗓️'));
    return { clean: lines.join('\n').trim(), user: uM ? uM[1].trim() : "", pass: sM ? sM[1].trim() : "" };
}

export function copyFullAccess(id) {
    const cli = db.clientes.find(c => c.id == id); if (!cli) return;
    const app = db.apps.find(a => a.id == cli.app_id) || { nome: 'N/A' };
    const plano = db.planos.find(p => p.id == cli.plano_id) || { nome: 'N/A' };
    const txt = `👤 Usuário: ${cli.usuario || 'N/A'}\n🔑 Senha: ${cli.senha || 'N/A'}\n📱 App: ${app.nome}\n🌐 Host/DNS: ${app.url || app.host || 'N/A'}\n🗓️ Vencimento: ${cli.vencimento.split('-').reverse().join('/')}\n📦 Plano: ${plano.nome}`;
    const el = document.createElement('textarea'); el.value = txt; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    showNotify('Copiado!', 'Dados copiados.');
}

export function showNotify(titulo, message, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let bgIcon = 'bg-green-500/20 text-green-400 border-green-500/30';
    let icon = 'fas fa-check-circle';
    
    if (tipo === 'error' || tipo === 'danger') {
        bgIcon = 'bg-red-500/20 text-red-400 border-red-500/30';
        icon = 'fas fa-times-circle';
    } else if (tipo === 'warning') {
        bgIcon = 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
        icon = 'fas fa-exclamation-triangle';
    } else if (tipo === 'info') {
        bgIcon = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        icon = 'fas fa-info-circle';
    }

    const toast = document.createElement('div');
    toast.className = "pointer-events-auto w-full bg-[#16162d]/95 backdrop-blur-md border border-white/5 p-4 rounded-xl shadow-2xl flex items-start gap-3 transform translate-x-20 opacity-0 transition-all duration-300";
    
    toast.innerHTML = `
        <div class="h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${bgIcon}">
            <i class="${icon} text-sm"></i>
        </div>
        <div class="flex-1">
            <h4 class="text-xs font-bold text-white uppercase tracking-wider">${titulo}</h4>
            <p class="text-[11px] text-gray-400 mt-0.5 leading-relaxed">${message}</p>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-x-20', 'opacity-0'); }, 10);
    setTimeout(() => {
        toast.classList.add('translate-x-20', 'opacity-0');
        setTimeout(() => { toast.remove(); }, 300);
    }, 4000);
}

window.showNotify = showNotify;

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
        setTimeout(() => {
            if (window.innerWidth < 1024) gaveta.classList.add('hidden');
        }, 300);
    }
}

window.toggleFiltrosGaveta = toggleFiltrosGaveta;

window.alternarAbasAuth = function(irParaCadastro) {
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
};

// ====== NOTIFICAÇÃO EM MASSA GRÁFICA ======
window.dispararNotificacaoEmMassa = async function() {
    const selecionados = Array.from(document.querySelectorAll('.client-checkbox:checked')).map(cb => cb.value);
    if (selecionados.length === 0) return;

    const modalProgresso = document.getElementById('modalProgressoEnvio');
    const textoProgresso = document.getElementById('progresso-texto');
    const barraProgresso = document.getElementById('progresso-barra-interna');
    const txtPorcentagem = document.getElementById('progresso-porcentagem');

    if (modalProgresso) modalProgresso.classList.remove('hidden');
    const total = selecionados.length;

    for (let i = 0; i < total; i++) {
        const idCliente = selecionados[i];
        const clienteObj = db.clientes.find(c => c.id == idCliente) || { nome: "Cliente" };
        
        if (textoProgresso) textoProgresso.innerText = `Enviando para: ${clienteObj.nome.toUpperCase()} (${i + 1} de ${total})`;
        const pct = Math.round(((i + 1) / total) * 100);
        if (barraProgresso) barraProgresso.style.width = `${pct}%`;
        if (txtPorcentagem) txtPorcentagem.innerText = `${pct}% Concluído`;

        if (typeof sendManualWA === "function") {
            sendManualWA(idCliente, 'renew');
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (modalProgresso) modalProgresso.classList.add('hidden');
    showNotify("Concluído", "Todos os disparos em massa foram processados com sucesso!", "success");
    document.querySelectorAll('.client-checkbox').forEach(cb => cb.checked = false);
    const checkMestre = document.getElementById('select-all-clients');
    if (checkMestre) checkMestre.checked = false;
    window.atualizarBarraAcoes();
};

// ====== DISPARO DE MENSAGENS DE MANUTENÇÃO / OSCILAÇÃO GERAL ======
window.dispararAlertaGeral = async function(tipoAlerta) {
    const hoje = new Date();
    const hojeS = hoje.toISOString().split('T')[0];
    
    // Filtra apenas clientes que não estão inadimplentes com mais de 20 dias de atraso
    const ativos = (db.clientes || []).filter(cli => {
        const diff = Math.ceil((new Date(cli.vencimento) - hoje) / (1000 * 60 * 60 * 24));
        return diff >= -20;
    });

    if (ativos.length === 0) {
        showNotify("Aviso", "Não existem clientes ativos cadastrados para receber alertas no momento.", "warning");
        return;
    }

    if (!confirm(`Deseja disparar o alerta de ${tipoAlerta.toUpperCase()} para todos os ${ativos.length} clientes ativos?`)) return;

    const modalProgresso = document.getElementById('modalProgressoEnvio');
    const textoProgresso = document.getElementById('progresso-texto');
    const barraProgresso = document.getElementById('progresso-barra-interna');
    const txtPorcentagem = document.getElementById('progresso-porcentagem');

    if (modalProgresso) modalProgresso.classList.remove('hidden');
    const total = ativos.length;

    for (let i = 0; i < total; i++) {
        const cli = ativos[i];
        if (textoProgresso) textoProgresso.innerText = `Alertando: ${cli.nome.toUpperCase()} (${i + 1} de ${total})`;
        
        const pct = Math.round(((i + 1) / total) * 100);
        if (barraProgresso) barraProgresso.style.width = `${pct}%`;
        if (txtPorcentagem) txtPorcentagem.innerText = `${pct}% Concluído`;

        if (typeof sendManualWA === "function") {
            sendManualWA(cli.id, tipoAlerta);
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (modalProgresso) modalProgresso.classList.add('hidden');
    showNotify("Transmissão Concluída", "O alerta geral do servidor foi processado com sucesso!", "success");
};
