import { firebaseConfig, db_firebase } from "./firebase-config.js";
import { ref, get, update, set, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showNotify, closeModal, openModal } from "./ui.js";

// Instância secundária para criar usuários sem deslogar o Admin
const adminApp = initializeApp(firebaseConfig, "AdminApp");
const adminAuth = getAuth(adminApp);

// 🔴 COLOQUE O SEU E-MAIL DE ADMIN AQUI TAMBÉM 🔴
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
            const email = dados.email || uid; 
            const acc = dados.account || { type: 'free', expiresAt: 0 };
            const vencimento = acc.expiresAt > 0 ? new Date(acc.expiresAt).toLocaleDateString() : 'Sem data';
            
            let statusText = acc.type;
            let statusColor = acc.type === 'vip' ? 'text-green-500' : 'text-yellow-500';
            let vencimentoText = vencimento;

            // REGRA VISUAL DO ADMIN
            if (email === MEU_EMAIL_ADMIN) {
                statusText = 'ADMIN';
                statusColor = 'text-blue-500'; // Cor azul para destacar
                vencimentoText = 'Vitalício';
            }

            // Esconde o botão de excluir se for a sua própria conta
            const btnExcluir = email !== MEU_EMAIL_ADMIN 
                ? `<button onclick="deletarUsuarioAdmin('${uid}')" title="Apagar Cliente" class="px-3 py-1 bg-red-600/20 text-red-500 rounded text-[10px] font-black hover:bg-red-600 hover:text-white transition"><i class="fas fa-trash"></i></button>`
                : '';

            body.innerHTML += `
            <tr class="border-t border-gray-800/50 hover:bg-white/5 transition">
                <td class="p-3 text-xs text-white font-bold">${email}</td>
                <td class="p-3 text-[10px] font-bold uppercase ${statusColor}">${statusText}</td>
                <td class="p-3 text-center text-xs font-bold text-gray-400">${vencimentoText}</td>
                <td class="p-3 text-center">
                    <button onclick="editarDiasVIP('${uid}', ${acc.expiresAt})" class="text-blue-400 hover:text-white transition"><i class="fas fa-edit"></i> Editar Venc.</button>
                </td>
                <td class="p-3 text-right space-x-2 whitespace-nowrap">
                    <button onclick="darVIP('${uid}')" title="Adicionar 30 Dias" class="px-3 py-1 bg-purple-600 rounded text-[9px] font-black text-white hover:bg-purple-700 shadow-lg">+ VIP</button>
                    ${btnExcluir}
                </td>
            </tr>`;
        }
    } catch(e) {
        body.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Erro de permissão no Firebase.</td></tr>';
    }
}

// NOVA FUNÇÃO: DELETAR USUÁRIO
export function deletarUsuarioAdmin(uid) {
    if(confirm("🚨 ATENÇÃO: Tem certeza que deseja apagar este usuário? Ele perderá o acesso VIP e TODOS os clientes salvos na conta dele serão deletados permanentemente!")) {
        
        // Remove toda a árvore de dados do usuário do Firebase
        remove(ref(db_firebase, 'usuarios/' + uid))
            .then(() => { 
                showNotify('Excluído', 'O usuário e seus clientes foram apagados!'); 
                carregarAssinantes(); // Atualiza a tabela na mesma hora
            })
            .catch(e => alert("Erro ao excluir usuário: " + e.message));
    }
}

export function darVIP(uid) {
    if(!confirm("Liberar +30 dias de VIP para este usuário?")) return;
    const novosDias = Date.now() + (30 * 24 * 60 * 60 * 1000);
    update(ref(db_firebase, `usuarios/${uid}/account`), { type: 'vip', expiresAt: novosDias })
        .then(() => { showNotify('Sucesso', 'VIP concedido!'); carregarAssinantes(); });
}

export function editarDiasVIP(uid, currentExpiresAt) {
    const diasAdd = prompt("Quantos dias deseja ADICIONAR a este usuário? (Use números negativos para remover dias)", "30");
    if(!diasAdd || isNaN(diasAdd)) return;
    
    let baseDate = currentExpiresAt > Date.now() ? currentExpiresAt : Date.now();
    const novosDias = baseDate + (parseInt(diasAdd) * 24 * 60 * 60 * 1000);
    
    update(ref(db_firebase, `usuarios/${uid}/account`), { type: 'vip', expiresAt: novosDias })
        .then(() => { showNotify('Atualizado', 'Dias alterados com sucesso!'); carregarAssinantes(); });
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
            account: {
                type: dias > 7 ? 'vip' : 'free',
                expiresAt: Date.now() + (dias * 24 * 60 * 60 * 1000),
                forcePasswordChange: true
            }
        });

        const textoCopia = `🚀 *SUA CONTA FOI CRIADA NO GESTOR LITE PRO!*\n\n` +
                           `👤 *Usuário:* ${email}\n` +
                           `🔑 *Senha Temporária:* ${pass}\n` +
                           `🌐 *Link de Acesso:* ${urlAplicacao}\n\n` +
                           `_Obs: Por segurança, o sistema solicitará a criação de sua senha definitiva no primeiro login._`;

        await navigator.clipboard.writeText(textoCopia);

        document.getElementById('display_new_email').innerText = email;
        document.getElementById('display_new_pass').innerText = pass;
        document.getElementById('display_hidden_text').value = textoCopia;

        closeModal('modalCriarUsuario');
        openModal('modalUsuarioCriado');
        
        carregarAssinantes();
    }  catch (error) {
        // Trata o erro de e-mail duplicado de forma elegante
        if (error.code === 'auth/email-already-in-use') {
            alert("🚨 Este e-mail já está cadastrado no sistema do Firebase!\n\nSe você já o apagou da tabela, lembre-se de ir no console do Firebase > Authentication e excluir o registro dele lá também.");
        } else {
            alert("Erro ao criar usuário: " + error.message);
        }
    }
}