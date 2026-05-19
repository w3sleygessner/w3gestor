import { db, save } from "./database.js";
import { sendManualWA } from "./api.js";

// --- EXPORTAÇÕES GLOBAIS ---
export function openModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
export function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
window.openModal = openModal;
window.closeModal = closeModal;

export function showNotify(titulo, message, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = "bg-[#16162d] border border-white/10 p-3 rounded-lg shadow-xl text-xs text-white mb-2 transform transition-all duration-300";
    toast.innerHTML = `<strong>${titulo}</strong><p class="text-gray-400">${message}</p>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
window.showNotify = showNotify;

// --- FUNÇÕES DA DASHBOARD ---
export function updateDashboard() {
    const clientes = db.clientes || [];
    const faturas = db.faturas || [];
    const hoje = new Date().toISOString().split('T')[0];
    const config = db.config || { aviso_dias: 3 };

    // Cálculo Financeiro
    const totalBruto = faturas.reduce((acc, f) => acc + (f.valor || 0), 0);
    const totalLucro = faturas.reduce((acc, f) => acc + (f.lucro || 0), 0);
    
    // Previsão de Lucro Líquido
    const previsaoLucro = clientes.reduce((acc, cli) => {
        const diffDias = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));
        if (diffDias < -20) return acc;
        const plano = db.planos.find(p => p.id == cli.plano_id) || { valor: 0, custo: 0 };
        return acc + ((plano.valor || 0) - (plano.custo || 0));
    }, 0);

    // Atualiza Stats
    if (document.getElementById('stat-total')) document.getElementById('stat-total').innerText = clientes.length;
    if (document.getElementById('stat-bruto')) document.getElementById('stat-bruto').innerText = `R$ ${totalBruto.toFixed(2)}`;
    if (document.getElementById('stat-lucro')) document.getElementById('stat-lucro').innerText = `R$ ${totalLucro.toFixed(2)}`;
    if (document.getElementById('stat-previsao')) document.getElementById('stat-previsao').innerText = `R$ ${previsaoLucro.toFixed(2)}`;
    if (document.getElementById('stat-atrasados')) document.getElementById('stat-atrasados').innerText = clientes.filter(c => c.vencimento <= hoje).length;

    // Vencimentos Críticos
    const list = document.getElementById('alerts-list');
    if (list) {
        list.innerHTML = '';
        clientes.sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento)).forEach(cli => {
            const diff = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));
            if (diff <= config.aviso_dias && diff >= -20) {
                list.innerHTML += `
                <div class="flex items-center justify-between p-2 bg-white/[0.02] border border-white/5 rounded-xl mb-2">
                    <div class="min-w-0 pr-2">
                        <p class="text-[10px] text-white font-bold uppercase truncate">${cli.nome}</p>
                        <span class="text-[9px] text-gray-500 font-mono">${cli.vencimento.split('-').reverse().join('/')}</span>
                    </div>
                    <div class="flex gap-1">
                        <button onclick="window.openModalRenovar(${cli.id})" class="text-green-500 p-1 text-xs"><i class="fas fa-check"></i></button>
                    </div>
                </div>`;
            }
        });
    }
}

// --- FUNÇÕES DE CLIENTES (CORRIGIDAS) ---
export function renderClientes() {
    const tableBody = document.getElementById('table-clientes-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    db.clientes.forEach(cli => {
        const p = db.planos.find(x => x.id == cli.plano_id) || { nome: 'N/A' };
        tableBody.innerHTML += `
        <tr class="border-t border-gray-800 text-xs hover:bg-white/5">
            <td class="p-3">${cli.nome}</td>
            <td class="p-3 text-[10px]">${cli.whatsapp}</td>
            <td class="p-3">${p.nome}</td>
            <td class="p-3">${cli.vencimento.split('-').reverse().join('/')}</td>
            <td class="p-3 text-right">
                <button onclick="window.addThreeDays(${cli.id})" class="text-purple-400 hover:text-purple-300 p-1">+3</button>
                <button onclick="window.openModalRenovar(${cli.id})" class="text-green-500 ml-2">PAGO</button>
                <button onclick="window.openModalClienteEdit(${cli.id})" class="text-gray-500 ml-2"><i class="fas fa-edit"></i></button>
                <button onclick="window.deleteCliente(${cli.id})" class="text-red-500 ml-2"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
}

// Vinculação global para os botões do HTML
window.addThreeDays = (id) => {
    const cli = db.clientes.find(c => c.id == id);
    if(cli) {
        let d = new Date(cli.vencimento);
        d.setDate(d.getDate() + 3);
        cli.vencimento = d.toISOString().split('T')[0];
        save();
        renderClientes();
        showNotify("Sucesso", "+3 dias adicionados.");
    }
};

window.deleteCliente = (id) => {
    if(confirm("Apagar cliente?")) {
        db.clientes = db.clientes.filter(c => c.id != id);
        save();
        renderClientes();
    }
};

window.openModalRenovar = (id) => {
    document.getElementById('renovar-cli-id').value = id;
    openModal('modalRenovar');
};

window.openModalClienteEdit = (id) => {
    const cli = db.clientes.find(c => c.id == id);
    document.getElementById('cli_edit_id').value = cli.id;
    document.getElementById('cli_nome').value = cli.nome;
    openModal('modalCliente');
};

// --- FUNÇÕES DE APOIO ---
export function renderPlanos() {}
export function renderApps() {}
export function renderFaturas() {}
export function renderConfig() {}
