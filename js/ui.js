import { db, save } from "./database.js";
import { sendManualWA } from "./api.js";

export let isRegisterMode = false;
let financeChart;

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
}

export function updateDashboard() {
    const faturas = db.faturas || [];
    const clientes = db.clientes || [];
    const config = db.config || { aviso_dias: 3 };

    const b = faturas.reduce((acc, f) => acc + (f.valor || 0), 0);
    const l = faturas.reduce((acc, f) => acc + (f.lucro || 0), 0);
    const hj = new Date().toISOString().split('T')[0];
    const otr = clientes.filter(c => c.vencimento <= hj).length;

    if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = clientes.length;
    if (document.getElementById('stat-bruto')) document.getElementById('stat-bruto').innerText = `R$ ${b.toFixed(2)}`;
    if (document.getElementById('stat-lucro')) document.getElementById('stat-lucro').innerText = `R$ ${l.toFixed(2)}`;
    if (document.getElementById('stat-atrasados')) document.getElementById('stat-atrasados').innerText = otr;

    const list = document.getElementById('alerts-list');
    if (list) {
        list.innerHTML = '';
        clientes.forEach(cli => {
            const diff = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));
            if (diff <= config.aviso_dias) {
                list.innerHTML += `<div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
            <p class="text-xs text-white font-bold tracking-tight">${cli.nome} <br>
            <span class="${diff <= 0 ? 'text-red-500' : 'text-yellow-500'} text-[9px] uppercase font-black">${diff <= 0 ? 'Atrasado' : 'Em ' + diff + ' d'}</span></p>
            <div class="flex gap-2">
                <button onclick="openModalRenovar(${cli.id})" class="text-green-500"><i class="fas fa-check-circle"></i></button>
                <button onclick="sendManualWA(${cli.id}, 'renew')" class="text-purple-400"><i class="fab fa-whatsapp"></i></button>
            </div>
        </div>`;
            }
        });
        renderChartEvolucao();
    }
}

export function renderChartEvolucao() {
    const el = document.querySelector("#chart-financeiro");
    if (!el || !window.ApexCharts) return;
    const faturas = db.faturas || [];
    const dadosRecentes = faturas.slice(0, 7).reverse();
    const options = {
        series: [{ name: 'Lucro', data: dadosRecentes.map(f => f.lucro || 0) }],
        chart: { type: 'bar', height: 200, toolbar: { show: false }, background: 'transparent' },
        theme: { mode: 'dark' },
        colors: ['#a855f7'],
        xaxis: { categories: dadosRecentes.map(f => f.data_pgto ? f.data_pgto.slice(0, 5) : "") }
    };
    if (financeChart) financeChart.destroy();
    financeChart = new ApexCharts(el, options);
    financeChart.render();
}
export function renderClientes() {
    const tableBody = document.getElementById('table-clientes-body'); 
    if (!tableBody) return; 

    tableBody.innerHTML = '';
    const checkMestre = document.getElementById('select-all-clients');
    if (checkMestre) checkMestre.checked = false;
    
    if (window.atualizarBarraAcoes) {
        setTimeout(() => window.atualizarBarraAcoes(), 50);
    }

    const elName = document.getElementById('filter-name');
    const elApp = document.getElementById('filter-app');
    const elPlano = document.getElementById('filter-plano');
    const elStatus = document.getElementById('filter-status');
    const elInad = document.getElementById('filter-inadimplentes');

    // FILTROS BLINDADOS CONTRA ERROS DE ELEMENTO NULL
    const nF = (elName && elName.value) ? elName.value.toLowerCase() : "";
    const aF = (elApp && elApp.value) ? elApp.value : "";
    const pF = (elPlano && elPlano.value) ? elPlano.value : "";
    const sF = (elStatus && elStatus.value) ? elStatus.value : "";
    const iF = elInad ? elInad.checked : true;
    
    const hoje = new Date(); 
    const hojeS = hoje.toISOString().split('T')[0];

    // Array para guardar os clientes filtrados
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
        if (!iF && isInadimplente) return;
        if (sF === 'warning' && !isWarning) return;
        if (sF === 'overdue' && !isOverdue) return;
        if (sF === 'inadimplente' && !isInadimplente) return;

        // Guarda o cliente válido
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

    // RENDERIZAÇÃO DOS CARDS EM AMBIENTE MOBILE (DENTRO DA FUNÇÃO!)
    const mobileContainer = document.getElementById('lista-clientes-mobile');
    if (mobileContainer) {
        mobileContainer.innerHTML = ''; 

        if (clientesFiltrados.length === 0) {
            mobileContainer.innerHTML = `<div class="text-center p-6 text-gray-500 text-xs uppercase font-bold">Nenhum cliente encontrado</div>`;
        } else {
            clientesFiltrados.forEach(cli => {
                const p = db.planos.find(x => x.id == cli.plano_id) || { nome: 'Sem Plano' };
                const app = db.apps.find(x => x.id == cli.app_id) || { nome: 'Sem App' };
                
                const isOverdue = cli.vencimento < hojeS;
                const statusBorder = isOverdue ? 'border-red-500/30' : 'border-green-500/30';
                const badgeColor = isOverdue ? 'bg-red-600/20 text-red-400 border border-red-500/30' : 'bg-green-600/20 text-green-400 border border-green-500/30';

                mobileContainer.innerHTML += `
                    <div class="card p-4 rounded-2xl border ${statusBorder} bg-[#16162d] flex flex-col gap-3.5 shadow-xl mx-1 mb-3">
                        <div class="flex items-center justify-between gap-2 w-full">
                            <div class="truncate flex-1">
                                <h4 class="font-black text-white text-sm uppercase tracking-tight truncate">${cli.nome}</h4>
                                <p class="text-[10px] text-gray-400 mt-0.5 uppercase truncate">${p.nome} • <span class="text-purple-400 font-bold">${app.nome}</span></p>
                            </div>
                            <span class="px-2.5 py-1 rounded-xl text-[10px] font-mono font-black uppercase tracking-tighter shrink-0 ${badgeColor}">
                                ${cli.vencimento.split('-').reverse().join('/')}
                            </span>
                        </div>

                        <div class="flex items-center justify-between border-t border-white/5 pt-3 gap-2 w-full">
                            <div class="flex flex-col">
                                <span class="text-[9px] text-gray-500 uppercase font-black tracking-wider">WhatsApp</span>
                                <span class="text-xs text-gray-300 font-mono font-bold">${cli.whatsapp}</span>
                            </div>
                            <div class="flex gap-4 bg-black/30 px-3.5 py-2 rounded-xl border border-white/5 shrink-0">
                                <button onclick="sendManualWA(${cli.id}, 'renew')" title="Aviso" class="text-purple-400 text-sm active:scale-75 transition"><i class="fas fa-redo"></i></button>
                                <button onclick="sendManualWA(${cli.id}, 'welcome')" title="Boas-vindas" class="text-green-400 text-sm active:scale-75 transition"><i class="fas fa-star"></i></button>
                                <button onclick="sendManualWA(${cli.id}, 'suspended')" title="Suspender" class="text-red-400 text-sm active:scale-75 transition"><i class="fas fa-ban"></i></button>
                            </div>
                        </div>

                        <div class="flex items-center justify-between gap-1.5 border-t border-white/5 pt-3 mt-0.5 w-full">
                            <div class="flex gap-1">
                                <button onclick="copyFullAccess(${cli.id})" title="Copiar Acesso" class="w-9 h-9 flex items-center justify-center text-purple-400 bg-purple-500/10 rounded-xl text-xs active:scale-90 transition"><i class="fas fa-copy"></i></button>
                                <button onclick="openModalEdit(${cli.id})" title="Editar" class="w-9 h-9 flex items-center justify-center text-gray-400 bg-white/5 rounded-xl text-xs active:scale-90 transition"><i class="fas fa-edit"></i></button>
                                <button onclick="deleteCliente(${cli.id})" title="Excluir" class="w-9 h-9 flex items-center justify-center text-red-400 bg-red-500/10 rounded-xl text-xs active:scale-90 transition"><i class="fas fa-trash"></i></button>
                            </div>
                            <div class="flex gap-1 flex-1 justify-end">
                                <button onclick="addThreeDays(${cli.id})" class="h-9 px-3 bg-purple-600/20 text-purple-400 border border-purple-500/20 rounded-xl text-[11px] font-black active:scale-95 transition">+3 DIAS</button>
                                <button onclick="openModalRenovar(${cli.id})" class="h-9 px-5 bg-green-600 text-white rounded-xl text-[11px] font-black shadow-lg shadow-green-500/10 text-center active:scale-95 transition">PAGO</button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
    }
} // <--- FIM REAL DA FUNÇÃO
export function addThreeDays(id) {
    const idx = db.clientes.findIndex(c => c.id == id);
    if (idx !== -1) {
        let d = new Date(db.clientes[idx].vencimento);
        d.setDate(d.getDate() + 3);
        db.clientes[idx].vencimento = d.toISOString().split('T')[0];
        save();
        renderClientes();
        showNotify('+3 Dias', 'Vencimento adiado em 3 dias.');
    }
}

export function renderFaturas() {
    const pBody = document.getElementById('table-faturas-pendentes-body');
    const hBody = document.getElementById('table-faturas-body');
    if (!pBody || !hBody) return;

    const hoje = new Date().toISOString().split('T')[0];
    const clientes = db.clientes || [];
    const faturas = db.faturas || [];

    const pendentes = clientes.filter(c => c.vencimento <= hoje);
    pBody.innerHTML = pendentes.map(cli => {
        const plano = db.planos.find(p => p.id == cli.plano_id) || { nome: 'N/A', valor: 0 };
        return `<tr class="border-t border-gray-800 text-[10px] hover:bg-white/5">
    <td class="p-4 font-bold text-red-400">${cli.vencimento.split('-').reverse().join('/')}</td>
    <td class="p-4 text-white uppercase font-bold">${cli.nome}</td>
    <td class="p-4 text-gray-400 uppercase">${plano.nome}</td>
    <td class="p-4 text-white">R$ ${plano.valor.toFixed(2)}</td>
    <td class="p-4 text-right">
        <button onclick="openModalRenovar(${cli.id})" class="px-3 py-1 bg-green-600/20 text-green-500 border border-green-500/30 rounded text-[9px] font-black hover:bg-green-600 hover:text-white transition">RECEBER AGORA</button>
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

export function renderPlanos() {
    const list = document.getElementById('planos-list'); if (!list) return;
    list.innerHTML = db.planos.map(p => `
        <div class="card p-4 rounded-xl relative shadow-xl border border-white/5 bg-gray-900/40">
            <div class="absolute top-2 right-2 flex gap-2">
                <button onclick="openModalPlanoEdit(${p.id})" class="text-gray-500 hover:text-white transition"><i class="fas fa-edit"></i></button>
                <button onclick="deletePlano(${p.id})" class="text-gray-700 hover:text-red-500 transition"><i class="fas fa-trash"></i></button>
            </div>
            <h4 class="font-bold text-white text-sm uppercase">${p.nome}</h4>
            <p class="text-[9px] text-gray-500 font-black">${p.dias} DIAS</p>
            <div class="mt-2 text-[10px] flex justify-between border-t border-gray-800 pt-2">
                <span>Preço: R$ ${p.valor.toFixed(2)}</span>
                <span class="text-purple-400 font-bold">Lucro: R$ ${(p.valor - p.custo).toFixed(2)}</span>
            </div>
        </div>`).join('');
    
    if (document.getElementById('cli_plano_id')) {
        document.getElementById('cli_plano_id').innerHTML = db.planos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
    }

    if (document.getElementById('filter-plano')) {
        document.getElementById('filter-plano').innerHTML = `<option value="">Planos</option>` + 
            db.planos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
    }
}

export function renderApps() {
    const list = document.getElementById('apps-list'); if (!list) return;
    list.innerHTML = db.apps.map(a => `
        <div class="card p-3 flex justify-between items-center shadow border border-white/5 rounded-xl bg-gray-900/40">
            <div><p class="font-bold text-xs uppercase text-purple-400">${a.nome}</p></div>
            <div class="flex gap-3">
                <button onclick="openModalAppEdit(${a.id})" class="text-gray-500 hover:text-white transition"><i class="fas fa-edit"></i></button>
                <button onclick="deleteApp(${a.id})" class="text-gray-700 hover:text-red-500 transition"><i class="fas fa-trash"></i></button>
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

export function renderConfig() {
    const config = db.config || {};
    const elAviso = document.getElementById('cfg_aviso_dias');
    const elBoasVindas = document.getElementById('cfg_msg_boas_vindas');
    const elRenovacao = document.getElementById('cfg_msg_renovacao');
    const elSucesso = document.getElementById('cfg_msg_sucesso');
    const elSuspensa = document.getElementById('cfg_msg_suspensa');

    if(elAviso) elAviso.value = config.aviso_dias || 3;
    if(elBoasVindas) elBoasVindas.value = config.msg_boas_vindas || "";
    if(elRenovacao) elRenovacao.value = config.msg_renovacao || "";
    if(elSucesso) elSucesso.value = config.msg_sucesso || "";
    if(elSuspensa) elSuspensa.value = config.msg_suspensa || "";
}

export function updateConfig() {
    const elAviso = document.getElementById('cfg_aviso_dias');
    const elBoasVindas = document.getElementById('cfg_msg_boas_vindas');
    const elRenovacao = document.getElementById('cfg_msg_renovacao');
    const elSucesso = document.getElementById('cfg_msg_sucesso');
    const elSuspensa = document.getElementById('cfg_msg_suspensa');

    db.config = {
        aviso_dias: elAviso ? parseInt(elAviso.value) : 3,
        msg_boas_vindas: elBoasVindas ? elBoasVindas.value : "",
        msg_renovacao: elRenovacao ? elRenovacao.value : "",
        msg_sucesso: elSucesso ? elSucesso.value : "",
        msg_suspensa: elSuspensa ? elSuspensa.value : ""
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

// INTERFACE DE NOTIFICAÇÃO CORRIGIDA (SEM ERRO DE SINTAXE)
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

    setTimeout(() => {
        toast.classList.remove('translate-x-20', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('translate-x-20', 'opacity-0');
        setTimeout(() => { toast.remove(); }, 300);
    }, 4000);
}

// 2. Tornamos ela global aqui embaixo para os botões antigos funcionarem
window.showNotify = showNotify;

// ====== ADICIONE ESSAS FUNÇÕES DENTRO DO SEU js/ui.js ======

export function toggleFiltrosGaveta(open) {
    const gaveta = document.getElementById('gaveta-filtros');
    const fundo = document.getElementById('fundo-gaveta');
    
    if (!gaveta || !fundo) return;

    if (open) {
        gaveta.classList.remove('translate-y-full');
        fundo.classList.remove('hidden');
    } else {
        gaveta.classList.add('translate-y-full');
        fundo.classList.add('hidden');
    }
}

// Tornamos a função global para o HTML enxergar o clique
window.toggleFiltrosGaveta = toggleFiltrosGaveta;