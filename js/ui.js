import { db, save } from "./database.js";
import { sendManualWA } from "./api.js";

export let isRegisterMode = false;
let financeChart;
let appsDonutChart;

// EXPORTS NAVEGAÇÃO / MODAIS
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
    const hoje = new Date().toISOString().split('T')[0];
    const otr = clientes.filter(c => c.vencimento <= hoje).length;

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
        clientes.sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(cli => {
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
                        <button onclick="openModalRenovar(${cli.id})" class="w-7 h-7 flex items-center justify-center bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-xs hover:bg-green-500 hover:text-white transition"><i class="fas fa-check-circle"></i></button>
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
        chart: { type: 'donut', height: '100%', background: 'transparent' },
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

    const clientesFiltrados = [];

    db.clientes.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(cli => {
        const p = db.planos.find(x => x.id == cli.plano_id) || { nome: 'N/A' };
        const app = db.apps.find(x => x.id == cli.app_id) || { nome: 'N/A' };
        const diff = Math.ceil((new Date(cli.vencimento) - hoje) / (1000 * 60 * 60 * 24));
        const isOverdue = cli.vencimento < hojeS;
        const isInadimplente = diff < -20;
        const isWarning = diff >= 0 && diff <= 3;

        // Se o checkbox Inadimplente estiver desmarcado e o cliente for inadimplente, oculta.
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

        clientesFiltrados.push(cli);

        let rCls = isInadimplente ? 'row-inadimplente' : (isOverdue ? 'row-overdue' : (isWarning ? 'row-warning' : ''));

        tableBody.innerHTML += `<tr class="border-t border-gray-800/50 text-xs hover:bg-white/5 ${rCls}">
            <td class="p-2.5 text-center w-10"><input type="checkbox" class="client-checkbox" value="${cli.id}" onchange="window.atualizarBarraAcoes()"></td>
            <td class="p-2.5 font-bold text-white uppercase">${cli.nome}</td>
            <td class="p-2.5 uppercase text-[10px] text-gray-400">${p.nome}<br><span class="text-purple-400 font-bold">${app.nome}</span></td>
            <td class="p-2.5 text-center font-bold ${isOverdue ? 'text-red-500' : (isWarning ? 'text-yellow-500' : 'text-green-500')}">${cli.vencimento.split('-').reverse().join('/')}</td>
            <td class="p-2.5 text-center font-mono text-gray-400">${cli.whatsapp}</td>
            <td class="p-2.5 text-center">
                <div class="flex items-center justify-center gap-3">
                    <button onclick="sendManualWA(${cli.id}, 'renew')" class="text-purple-400 hover:scale-110 transition"><i class="fas fa-redo"></i></button>
                    <button onclick="sendManualWA(${cli.id}, 'welcome')" class="text-green-500 hover:scale-110 transition"><i class="fas fa-star"></i></button>
                    <button onclick="sendManualWA(${cli.id}, 'suspended')" class="text-red-500 hover:scale-110 transition"><i class="fas fa-ban"></i></button>
                </div>
            </td>
            <td class="p-2.5 text-right space-x-1 whitespace-nowrap">
                <button onclick="openModalHistory(${cli.id})" title="Histórico" class="text-blue-400 hover:bg-blue-500/20 hover:text-white p-1.5 rounded transition"><i class="fas fa-history"></i></button>
                <button onclick="copyFullAccess(${cli.id})" title="Copiar Acesso" class="text-purple-400 hover:bg-purple-500/20 hover:text-white p-1.5 rounded transition"><i class="fas fa-copy"></i></button>
                <button onclick="addThreeDays(${cli.id})" title="+3 Dias Extras" class="text-purple-400 hover:bg-purple-500/20 hover:text-white p-1.5 rounded font-bold transition">+3</button>
                <button onclick="openModalRenovar(${cli.id})" class="px-2 py-1 ml-1 bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white rounded text-[9px] font-black transition">PAGO</button>
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
                <span class="text-[10px] text-purple-400 uppercase font-bold truncate max-w-[100px]">${p.nome}</span>
                <div class="flex gap-2">
                    <button onclick="openModalHistory(${cli.id})" class="text-blue-400 hover:scale-110 p-1"><i class="fas fa-history"></i></button>
                    <button onclick="sendManualWA(${cli.id}, 'renew')" class="text-purple-400 hover:scale-110 p-1"><i class="fab fa-whatsapp"></i></button>
                    <button onclick="addThreeDays(${cli.id})" class="text-purple-400 font-bold hover:scale-110 p-1">+3</button>
                    <button onclick="openModalClienteEdit(${cli.id})" class="text-gray-400 hover:scale-110 p-1"><i class="fas fa-edit"></i></button>
                    <button onclick="openModalRenovar(${cli.id})" class="bg-green-600/20 text-green-500 px-2 py-0.5 rounded font-bold hover:bg-green-600 hover:text-white transition">PAGO</button>
                </div>
            </div>
        </div>`;
    });
}

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

        let d = new Date(db.clientes[idx].vencimento);
        d.setDate(d.getDate() + 3);
        db.clientes[idx].vencimento = d.toISOString().split('T')[0];
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
    const hBody = document.getElementById('table-faturas-body');
    if (!pBody || !hBody) return;
    const hoje = new Date().toISOString().split('T')[0];
    const pendentes = (db.clientes || []).filter(c => c.vencimento <= hoje).sort((a, b) => new Date(b.vencimento) - new Date(a.vencimento));

    pBody.innerHTML = pendentes.map(cli => {
        const plano = db.planos.find(p => p.id == cli.plano_id) || { nome: 'N/A', valor: 0 };
        return `<tr class="border-t border-gray-800 text-xs">
            <td class="p-3 font-bold text-red-400">${cli.vencimento.split('-').reverse().join('/')}</td>
            <td class="p-3 text-white uppercase font-bold">${cli.nome}</td>
            <td class="p-3 text-gray-400 uppercase">${plano.nome}</td>
            <td class="p-3 text-white">R$ ${plano.valor.toFixed(2)}</td>
            <td class="p-3 text-right"><button onclick="openModalRenovar(${cli.id})" class="px-2 py-0.5 bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white transition border border-green-500/20 rounded font-black text-[9px]">RECEBER</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" class="p-3 text-center text-gray-500">Nenhuma fatura em aberto.</td></tr>';

    let totalLucro = 0;
    hBody.innerHTML = (db.faturas || []).map(f => {
        totalLucro += (f.lucro || 0);
        return `<tr class="border-t border-gray-800 text-[10px]">
            <td class="p-3 text-gray-500">${f.data_pgto}</td>
            <td class="p-3 font-bold text-white uppercase">${f.cliente}</td>
            <td class="p-3 text-green-500 font-bold">R$ ${(f.valor || 0).toFixed(2)}</td>
            <td class="p-3 text-purple-400 font-bold">R$ ${(f.lucro || 0).toFixed(2)}</td>
            <td class="p-3 text-right"><button onclick="deleteFatura(${f.id})" class="text-gray-600 hover:text-red-500 transition"><i class="fas fa-undo"></i> Estornar</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" class="p-3 text-center text-gray-500">Sem histórico de pagamentos.</td></tr>';

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
    if (confirm("Apagar este cliente?")) {
        db.clientes = db.clientes.filter(c => c.id != id);
        save(); renderClientes(); updateDashboard(); showNotify('Removido', 'Cliente apagado.');
    }
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
    if (confirm("Apagar este plano?")) {
        db.planos = db.planos.filter(p => p.id != id);
        save(); renderPlanos(); showNotify('Removido', 'Plano apagado.');
    }
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
    if (confirm("Apagar esta aplicação?")) {
        db.apps = db.apps.filter(a => a.id != id);
        save(); renderApps(); showNotify('Removido', 'Aplicação apagada.');
    }
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
    save(); closeModal('modalRenovar'); renderClientes(); renderFaturas(); updateDashboard(); showNotify('Pago!', 'Vencimento atualizado.');
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

// LOGICA DE CANCELAMENTO DE ENVIOS
window.cancelarDisparo = false;
window.cancelarEnvioMassa = function() { window.cancelarDisparo = true; };

window.dispararAlertaGeral = async function(tipoAlerta) {
    window.cancelarDisparo = false;
    const hoje = new Date();
    const ativos = (db.clientes || []).filter(cli => {
        const diff = Math.ceil((new Date(cli.vencimento) - hoje) / (1000 * 60 * 60 * 24));
        return diff >= -20;
    });
    if (ativos.length === 0) return;
    if (!confirm(`Transmitir alerta para ${ativos.length} clientes ativos?`)) return;

    const miniBadge = document.getElementById('badgeProgressoFlutuante');
    if (miniBadge) miniBadge.classList.remove('hidden');

    for (let i = 0; i < ativos.length; i++) {
        if (window.cancelarDisparo) { showNotify("Cancelado", "Transmissão interrompida.", "warning"); break; }
        
        const pct = Math.round(((i + 1) / ativos.length) * 100);
        document.getElementById('progresso-texto-mini').innerText = `Aviso: ${ativos[i].nome} (${i+1}/${ativos.length})`;
        document.getElementById('progresso-barra-mini').style.width = `${pct}%`;
        document.getElementById('progresso-porcentagem-mini').innerText = `${pct}%`;

        sendManualWA(ativos[i].id, tipoAlerta);
        await new Promise(r => setTimeout(r, 3000));
    }
    if (miniBadge) miniBadge.classList.add('hidden');
    if (!window.cancelarDisparo) showNotify("Concluído", "Alerta transmitido!");
};

window.dispararNotificacaoEmMassa = async function() {
    window.cancelarDisparo = false;
    const selecionados = Array.from(document.querySelectorAll('.client-checkbox:checked')).map(cb => cb.value);
    if (selecionados.length === 0) return;
    const miniBadge = document.getElementById('badgeProgressoFlutuante');
    if (miniBadge) miniBadge.classList.remove('hidden');

    for (let i = 0; i < selecionados.length; i++) {
        if (window.cancelarDisparo) { showNotify("Cancelado", "Cobranças interrompidas.", "warning"); break; }

        const cli = db.clientes.find(c => c.id == selecionados[i]);
        const pct = Math.round(((i + 1) / selecionados.length) * 100);
        document.getElementById('progresso-texto-mini').innerText = `Enviando: ${cli.nome} (${i+1}/${selecionados.length})`;
        document.getElementById('progresso-barra-mini').style.width = `${pct}%`;
        document.getElementById('progresso-porcentagem-mini').innerText = `${pct}%`;

        sendManualWA(selecionados[i], 'renew');
        await new Promise(r => setTimeout(r, 3000));
    }
    if (miniBadge) miniBadge.classList.add('hidden');
    document.querySelectorAll('.client-checkbox').forEach(cb => cb.checked = false);
    window.atualizarBarraAcoes();
};

// VINCULAÇÃO GLOBAL PARA O HTML
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
