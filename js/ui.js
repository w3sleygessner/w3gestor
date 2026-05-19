import { db, save } from "./database.js";
import { sendManualWA } from "./api.js";

export let isRegisterMode = false;
let financeChart;
let appsDonutChart;

// --- EXPORTS DE NAVEGAÇÃO E MODAIS ---
export function openModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
export function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
window.openModal = openModal;
window.closeModal = closeModal;

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

export function initApp() {
    renderPlanos(); renderApps(); renderClientes(); renderFaturas(); updateDashboard(); renderConfig();
}

export function updateDashboard() {
    const clientes = db.clientes || [];
    const faturas = db.faturas || [];
    const hoje = new Date().toISOString().split('T')[0];
    
    const previsaoLucro = clientes.reduce((acc, cli) => {
        const diffDias = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));
        if (diffDias < -20) return acc;
        const plano = db.planos.find(p => p.id == cli.plano_id) || { valor: 0, custo: 0 };
        return acc + ((plano.valor || 0) - (plano.custo || 0));
    }, 0);

    if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = clientes.length;
    if (document.getElementById('stat-bruto')) document.getElementById('stat-bruto').innerText = `R$ ${faturas.reduce((acc, f) => acc + (f.valor || 0), 0).toFixed(2)}`;
    if (document.getElementById('stat-lucro')) document.getElementById('stat-lucro').innerText = `R$ ${faturas.reduce((acc, f) => acc + (f.lucro || 0), 0).toFixed(2)}`;
    if (document.getElementById('stat-previsao')) document.getElementById('stat-previsao').innerText = `R$ ${previsaoLucro.toFixed(2)}`;
    if (document.getElementById('stat-atrasados')) document.getElementById('stat-atrasados').innerText = clientes.filter(c => c.vencimento <= hoje).length;
}

export function renderClientes() {
    const tableBody = document.getElementById('table-clientes-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    db.clientes.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(cli => {
        const p = db.planos.find(x => x.id == cli.plano_id) || { nome: 'N/A' };
        tableBody.innerHTML += `<tr class="border-t border-gray-800 text-xs">
            <td class="p-3">${cli.nome}</td>
            <td class="p-3">${p.nome}</td>
            <td class="p-3 text-center">${cli.vencimento.split('-').reverse().join('/')}</td>
            <td class="p-3 text-right">
                <button onclick="openModalRenovar(${cli.id})" class="bg-green-600/20 text-green-500 px-2 py-1 rounded text-[9px]">PAGO</button>
                <button onclick="openModalClienteEdit(${cli.id})" class="text-gray-500 ml-2"><i class="fas fa-edit"></i></button>
            </td>
        </tr>`;
    });
}

export function openModalRenovar(id) {
    const cli = db.clientes.find(c => c.id == id);
    const p = db.planos.find(pl => pl.id == cli.plano_id) || { valor: 0 };
    document.getElementById('renovar-cli-id').value = id;
    document.getElementById('renovar-info').innerText = `Confirmar pagamento de ${cli.nome}?`;
    openModal('modalRenovar');
}
window.openModalRenovar = openModalRenovar;

export function openModalClienteEdit(id) {
    const cli = db.clientes.find(c => c.id == id);
    document.getElementById('cli_edit_id').value = cli.id;
    document.getElementById('cli_nome').value = cli.nome;
    openModal('modalCliente');
}
window.openModalClienteEdit = openModalClienteEdit;

export function showNotify(titulo, message, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = "bg-[#16162d] border border-white/10 p-3 rounded-lg shadow-xl text-xs text-white mb-2";
    toast.innerHTML = `<strong>${titulo}</strong><p>${message}</p>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
window.showNotify = showNotify;

window.dispararAlertaGeral = async function(tipoAlerta) {
    const ativos = (db.clientes || []).filter(cli => {
        const diff = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));
        return diff >= -20;
    });
    if (ativos.length === 0) return;
    if (!confirm(`Transmitir alerta para ${ativos.length} clientes?`)) return;
    for (let i = 0; i < ativos.length; i++) {
        sendManualWA(ativos[i].id, tipoAlerta);
        await new Promise(r => setTimeout(r, 3000));
    }
    showNotify("Concluído", "Alerta geral transmitido!");
};
