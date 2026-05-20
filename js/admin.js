import { firebaseConfig, db_firebase } from "./firebase-config.js";
import { ref, get, update, set, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showNotify, closeModal, openModal } from "./ui.js";

const adminApp = initializeApp(firebaseConfig, "AdminApp");
const adminAuth = getAuth(adminApp);

const MEU_EMAIL_ADMIN = "w3sleygessner@gmail.com"; 

export async function carregarAssinantes() {
    const body = document.getElementById('table-admin-body');
    if(!body) return;
    body.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Carregando usuários...</td></tr>';

    try {
        const snapshot = await get(ref(db_firebase, 'usuarios'));
        const usuarios = snapshot.val();

        if (!usuarios) {
            body.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Nenhum usuário encontrado.</td></tr>';
            return;
        }

        body.innerHTML = '';
        for (const [uid, dados] of Object.entries(usuarios)) {
            
            let email = "";

            if (dados) {
                if (typeof dados === 'object') {
                    if (dados.email) email = dados.email;
                    else if (dados.account && dados.account.email) email = dados.account.email;
                } else if (typeof dados === 'string') {
                    email = dados;
                }
            }

            if (!email) email = uid; 

            const acc = (dados && typeof dados === 'object' && dados.account) 
                ? dados.account 
                : { type: 'free', expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) };
            
            const vencimento = acc.expiresAt > 0 ? new Date(acc.expiresAt).toLocaleDateString() : 'Sem data';
            
            let statusText = acc.type;
            let statusColor = acc.type === 'vip' ? 'text-green-500' : 'text-yellow-500';
            let vencimentoText = vencimento;

            if (email === MEU_EMAIL_ADMIN) {
                statusText = 'ADMIN';
                statusColor = 'text-blue-500'; 
                vencimentoText = 'Vitalício';
            }

            const btnExcluir = email !== MEU_EMAIL_ADMIN 
                ? `<button onclick="deletarUsuarioAdmin('${uid}')" title="Apagar Cliente" class="px-3 py-1.5 bg-red-600/20 text-red-500 rounded text-[10px] font-black hover:bg-red-600 hover:text-white transition"><i class="fas fa-trash"></i></button>`
                : '';

            body.innerHTML += `
            <tr class="border-t border-gray-800/50 hover:bg-white/5 transition">
                <td class="p-3 text-xs text-white font-bold font-mono">${email}</td>
                <td class="p-3 text-[10px] font-bold uppercase ${statusColor}">${statusText}</td>
                <td class="p-3 text-center text-xs font-bold text-gray-400">${vencimentoText}</td>
                <td class="p-3 text-center">
                    <button onclick="editarDiasVIP('${uid}', ${acc.expiresAt})" class="text-blue-400 hover:text-white transition"><i class="fas fa-edit"></i> Editar Venc.</button>
                </td>
                <td class="p-3 text-right space-x-2 whitespace-nowrap">
                    <button onclick="darVIP('${uid}')" title="Adicionar 30 Dias" class="px-3 py-1.5 bg-purple-600 rounded text-[9px] font-black text-white hover:bg-purple-700 shadow-lg">+ VIP</button>
                    ${btnExcluir}
                </td>
            </tr>`;
        }
    }
   catch(e) {
        console.error("ERRO DE CONEXÃO FIREBASE:", e);
        body.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500 font-bold">🚨 Erro de Sincronização: ${e.message}</td></tr>`;
    }
}

export function deletarUsuarioAdmin(uid) {
    Swal.fire({
        title: '🚨 ATENÇÃO!',
        text: 'Tem certeza que deseja apagar este usuário? Ele perderá o acesso VIP e TODOS os clientes salvos na conta dele serão deletados permanentemente!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#374151',
        confirmButtonText: 'Sim, deletar tudo!',
        cancelButtonText: 'Cancelar',
        background: '#16162d',
        color: '#ffffff',
        iconColor: '#ef4444'
    }).then((result) => {
        if (result.isConfirmed) {
            remove(ref(db_firebase, 'usuarios/' + uid))
                .then(() => { 
                    if (typeof showNotify === 'function') {
                        showNotify('Excluído', 'O usuário e seus clientes foram apagados!', 'success');
                    } else {
                        Swal.fire({ title: 'Excluído!', text: 'O usuário foi apagado.', icon: 'success', background: '#16162d', color: '#fff' });
                    }
                    carregarAssinantes(); 
                })
                .catch(e => {
                    Swal.fire({ title: 'Erro!', text: 'Erro ao excluir usuário: ' + e.message, icon: 'error', background: '#16162d', color: '#fff' });
                });
        }
    });
}

export function darVIP(uid) {
    Swal.fire({
        title: 'Liberar +30 Dias?',
        text: "Deseja adicionar mais 30 dias de acesso VIP para este usuário?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#9333ea',
        cancelButtonColor: '#374151',
        confirmButtonText: 'Sim, liberar!',
        cancelButtonText: 'Cancelar',
        background: '#16162d',
        color: '#ffffff',
        iconColor: '#a855f7'
    }).then((result) => {
        if (result.isConfirmed) {
            const novosDias = Date.now() + (30 * 24 * 60 * 60 * 1000);
            update(ref(db_firebase, `usuarios/${uid}/account`), { type: 'vip', expiresAt: novosDias })
                .then(() => { 
                    showNotify('Sucesso', 'VIP concedido com sucesso!', 'success'); 
                    carregarAssinantes(); 
                })
                .catch(e => showNotify('Erro', e.message, 'error'));
        }
    });
}

export function editarDiasVIP(uid, currentExpiresAt) {
    Swal.fire({
        title: '⚙️ Ajustar Dias VIP',
        text: 'Quantos dias deseja ADICIONAR a este usuário? (Use números negativos para remover dias)',
        input: 'number',
        inputValue: '30',
        inputAttributes: { min: -365, max: 365, step: 1 },
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#374151',
        confirmButtonText: 'Salvar Alteração',
        cancelButtonText: 'Cancelar',
        background: '#16162d',
        color: '#ffffff',
        inputValidator: (value) => {
            if (!value || isNaN(value)) return 'Você precisa digitar um número válido!';
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            const diasAdd = parseInt(result.value);
            let baseDate = currentExpiresAt > Date.now() ? currentExpiresAt : Date.now();
            const novosDias = baseDate + (diasAdd * 24 * 60 * 60 * 1000);
            
            update(ref(db_firebase, `usuarios/${uid}/account`), { type: 'vip', expiresAt: novosDias })
                .then(() => { 
                    showNotify('Atualizado', 'Dias alterados com sucesso!', 'success'); 
                    carregarAssinantes(); 
                })
                .catch(e => showNotify('Erro', e.message, 'error'));
        }
    });
}

export async function criarUsuarioAdmin(event) {
    event.preventDefault(); 
    
    const email = document.getElementById('admin_new_email').value;
    const pass = Math.random().toString(36).slice(-8); 
    const dias = parseInt(document.getElementById('admin_new_dias').value) || 7;
    const urlAplicacao = "https://w3sleygessner.github.io/w3-gestor/";

    try {
        const userCred = await createUserWithEmailAndPassword(adminAuth, email, pass);
        const novoUid = userCred.user.uid;
        
        await set(ref(db_firebase, 'usuarios/' + novoUid), {
            email: email,
            account: { type: dias > 7 ? 'vip' : 'free', expiresAt: Date.now() + (dias * 24 * 60 * 60 * 1000), forcePasswordChange: true }
        });

        const textoCopia = `🚀 *SUA CONTA FOI CRIADA NO GESTOR LITE PRO!*\n\n👤 *Usuário:* ${email}\n🔑 *Senha Temporária:* ${pass}\n🌐 *Link de Acesso:* ${urlAplicacao}\n\n_Obs: Por segurança, o sistema solicitará a criação de sua senha definitiva no primeiro login._`;

        await navigator.clipboard.writeText(textoCopia);

        document.getElementById('display_new_email').innerText = email;
        document.getElementById('display_new_pass').innerText = pass;
        document.getElementById('display_hidden_text').value = textoCopia;

        closeModal('modalCriarUsuario');
        openModal('modalUsuarioCriado');
        
        carregarAssinantes();
    }  catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            showNotify("🚨 Este e-mail já está cadastrado no sistema!");
        } else {
            showNotify("Erro ao criar usuário: " + error.message);
        }
    }
}