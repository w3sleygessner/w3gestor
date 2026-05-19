import { db, save } from "./database.js";
import { sendManualWA } from "./api.js";

// Exportações essenciais
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

// Correção: Agora dispara as mensagens corretas via API
window.dispararAlertaGeral = async function(tipoAlerta) {
    const ativos = (db.clientes || []).filter(cli => {
        const diff = Math.ceil((new Date(cli.vencimento) - new Date()) / (1000 * 60 * 60 * 24));
        return diff >= -20;
    });
    if (ativos.length === 0) {
        showNotify("Aviso", "Nenhum cliente ativo para notificar.", "warning");
        return;
    }

    // Usando Swal.fire no lugar de confirm()
    const result = await Swal.fire({
        title: 'Confirmar Transmissão',
        text: `Enviar alerta de ${tipoAlerta} para ${ativos.length} clientes?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, enviar',
        background: '#16162d', color: '#fff'
    });

    if (!result.isConfirmed) return;

    const miniBadge = document.getElementById('badgeProgressoFlutuante');
    if (miniBadge) miniBadge.classList.remove('hidden');

    for (let i = 0; i < ativos.length; i++) {
        sendManualWA(ativos[i].id, tipoAlerta);
        await new Promise(r => setTimeout(r, 3000));
    }
    if (miniBadge) miniBadge.classList.add('hidden');
    showNotify("Concluído", "Alerta geral enviado com sucesso!");
};

// Restante das funções (renderClientes, renderPlanos, etc) vão aqui...
// IMPORTANTE: Mantenha as funções que você já tinha, apenas certifique-se de que não há "}" extras no final.
