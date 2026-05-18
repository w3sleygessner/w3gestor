import { auth, db_firebase } from "./firebase-config.js";
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { db, setDb, save } from "./database.js";
import * as UI from "./ui.js";
import * as API from "./api.js";
import * as ADMIN from "./admin.js";

Object.assign(window, UI);
Object.assign(window, API);
Object.assign(window, ADMIN);
window.db = db;
window.save = save;

const MEU_EMAIL_ADMIN = "w3sleygessner@gmail.com"; // <-- SEU EMAIL AQUI

onAuthStateChanged(auth, (currentUser) => {
    if (currentUser) {
        document.getElementById('user-display').innerText = currentUser.email;

        // Mantém o e-mail atualizado na raiz para controle do Admin
        update(ref(db_firebase, 'usuarios/' + currentUser.uid), { email: currentUser.email });

        const userRef = ref(db_firebase, 'usuarios/' + currentUser.uid);
        onValue(userRef, (snapshot) => {
            const data = snapshot.val();
            let accountInfo = data?.account;
            
            if (!accountInfo) {
                accountInfo = { type: 'free', expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), forcePasswordChange: false };
            }

            // Definição estrita dos fallbacks de exemplos iniciais obrigatórios
            const planosPadrao = [{ id: 1, nome: 'Mensal Gold', valor: 30.00, custo: 7.00, dias: 30 }];
            const appsPadrao = [{ id: 101, nome: "XCIPTV", url: "http://adonay.top", pin: "0000" }];
            const configPadrao = { 
                aviso_dias: 3,
                msg_boas_vindas: "Olá {cliente}, seja bem-vindo! Seu acesso ao app {app} está ativo até {vencimento}.",
                msg_renovacao: "Olá {cliente}, seu plano {plano} vence em {dias} dias ({vencimento}). Vamos renovar?",
                msg_sucesso: "Obrigado pelo pagamento, {cliente}! Seu acesso foi renovado com sucesso.",
                msg_suspensa: "Olá {cliente}, seu acesso venceu em {vencimento} e foi suspenso. Para reativar, entre em contato."
            };

            // Exibe a barra de plano Free se não for VIP e não for o Admin
            const freeBanner = document.getElementById('free-plan-banner');
            if(freeBanner) {
                if(accountInfo.type !== 'vip' && currentUser.email !== MEU_EMAIL_ADMIN) freeBanner.classList.remove('hidden');
                else freeBanner.classList.add('hidden');
            }

            // Trava de Tempo do Plano expirado
            if (currentUser.email !== MEU_EMAIL_ADMIN && Date.now() > accountInfo.expiresAt) {
                document.getElementById('app-container').classList.add('hidden');
                document.getElementById('auth-container').classList.add('hidden');
                document.getElementById('expired-container').classList.remove('hidden');
                return;
            }

            // Forçar troca de senha temporária
            if (accountInfo.forcePasswordChange) {
                UI.openModal('modalForcePassword');
            }

            document.getElementById('auth-container').classList.add('hidden');
            document.getElementById('expired-container').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');

            if (currentUser.email === MEU_EMAIL_ADMIN) {
                document.getElementById('nav-admin').classList.remove('hidden');
            }

            if (data) {
                // Checa se é um usuário recém-criado pelo admin que ainda não possui as tabelas internas
                const precisaPersistirPadroes = !data.planos || !data.apps || !data.config;

                setDb({
                    clientes: data.clientes || [],
                    planos: data.planos && data.planos.length > 0 ? data.planos : planosPadrao,
                    faturas: data.faturas || [],
                    apps: data.apps && data.apps.length > 0 ? data.apps : appsPadrao,
                    config: data.config && data.config.msg_boas_vindas ? data.config : configPadrao,
                    account: accountInfo
                });

                // Salva na nuvem os padrões no primeiro login do cliente para persistência estável
                if (precisaPersistirPadroes) {
                    save();
                }

                UI.initApp();
            } else {
                // Fallback absoluto de contingência
                setDb({
                    clientes: [],
                    planos: planosPadrao,
                    faturas: [],
                    apps: appsPadrao,
                    config: configPadrao,
                    account: accountInfo
                });
                save(); 
                UI.initApp();
            }
        });
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('expired-container').classList.add('hidden');
    }
});

window.logout = () => { signOut(auth).then(() => location.reload()); };

// Função para o usuário trocar a senha logado
// Função para o usuário trocar a senha logado voluntariamente
window.alterarSenha = async function(e) {
    e.preventDefault();
    const inputSenha = document.getElementById('change_password_input');
    
    if (!inputSenha) {
        alert("Erro: Campo de senha não encontrado na tela.");
        return;
    }

    try {
        // Atualiza a senha no Firebase Auth
        await updatePassword(auth.currentUser, inputSenha.value);
        UI.showNotify("Sucesso", "Senha alterada com sucesso!");
        UI.closeModal('modalChangePassword');
        inputSenha.value = ""; // Limpa o campo após o sucesso
    } catch(err) {
        if(err.code === 'auth/requires-recent-login') {
            alert("Por segurança, você precisa sair da conta e logar novamente antes de trocar a senha.");
            logout();
        } else {
            alert("Erro ao alterar senha: " + err.message);
        }
    }
}

// Função para forçar a troca de senha no primeiro login
window.alterarSenhaForcada = async function(e) {
    e.preventDefault();
    const inputSenha = document.getElementById('force_password_input');
    
    if (!inputSenha) {
        alert("Erro: Campo de senha não encontrado na tela.");
        return;
    }

    try {
        // Atualiza a senha no Firebase Auth
        await updatePassword(auth.currentUser, inputSenha.value);
        // Remove a trava de primeiro acesso no banco de dados
        await update(ref(db_firebase, `usuarios/${auth.currentUser.uid}/account`), { forcePasswordChange: false });
        
        UI.showNotify("Sucesso", "Sua senha definitiva foi configurada!");
        UI.closeModal('modalForcePassword');
        inputSenha.value = ""; // Limpa o campo após o sucesso
    } catch(err) {
        alert("Erro ao salvar nova senha. Tente novamente. Erro: " + err.message);
    }
}

// --- FORMULÁRIO DE LOGIN INDEPENDENTE ---
document.getElementById('formLogin').onsubmit = async function (e) {
    e.preventDefault();
    const email = document.getElementById('login_email').value;
    const pass = document.getElementById('login_pass').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) { 
        alert("Erro no Login: " + error.message); 
    }
};

// --- FORMULÁRIO DE CADASTRO INDEPENDENTE ---
document.getElementById('formRegister').onsubmit = async function (e) {
    e.preventDefault();
    const email = document.getElementById('register_email').value;
    const pass = document.getElementById('register_pass').value;
    try {
        await createUserWithEmailAndPassword(auth, email, pass);
    } catch (error) { 
        alert("Erro ao Registrar: " + error.message); 
    }
};

// LIMITE DE 3 CLIENTES NO FREE
document.getElementById('formCliente').onsubmit = function (e) {
    e.preventDefault();
    const editId = document.getElementById('cli_edit_id').value;
    
    // TRAVA: Se for Free, não for edição, e já tiver 3 clientes
    if (db.account.type !== 'vip' && !editId && db.clientes.length >= 3) {
        alert("🚨 O plano FREE permite apenas 3 clientes. Assine o VIP para gerenciar clientes ilimitados!");
        return;
    }

    const proc = UI.processCredentials(document.getElementById('cli_credenciais').value);
    const data = { nome: document.getElementById('cli_nome').value, whatsapp: document.getElementById('cli_whatsapp').value, plano_id: document.getElementById('cli_plano_id').value, app_id: document.getElementById('cli_app_id').value, vencimento: document.getElementById('cli_vencimento').value, credenciais: proc.clean, usuario: proc.user, senha: proc.pass };
    
    if (editId) { 
        const idx = db.clientes.findIndex(c => c.id == editId); db.clientes[idx] = { ...db.clientes[idx], ...data }; 
    } else { 
        const id = Date.now(); db.clientes.push({ id, ...data }); setTimeout(() => API.sendManualWA(id, 'welcome'), 800); 
    }
    save(); UI.closeModal('modalCliente'); UI.renderClientes(); UI.updateDashboard();
};

// Mesmos submits de app e plano aqui... (pode manter os originais)