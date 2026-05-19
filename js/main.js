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

const MEU_EMAIL_ADMIN = "w3sleygessner@gmail.com"; 

// 👤 FUNÇÃO QUE ESTAVA EM FALTA: Remove a cortina do loader com estilo
function esconderSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';
        setTimeout(() => { if (splash) splash.remove(); }, 300);
    }
}

// ⏱️ TRAVA DE SEGURANÇA: Se a net falhar ou o Firebase demorar, remove o loader em 4s
setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        console.warn("w3Gestor: Forçando a remoção do loader por tempo limite.");
        esconderSplashScreen();
    }
}, 4000);

// ====== OBSERVADOR DE SESSÃO DO FIREBASE AUTH ======
onAuthStateChanged(auth, (currentUser) => {
    if (currentUser) {
        
        // Se quiseres testar sem travas de login, o bloco abaixo agora vai funcionar 100% seguro!
        console.log("w3Gestor: Forçando entrada do painel...");
        const aC = document.getElementById('auth-container');
        const eC = document.getElementById('expired-container');
        const apC = document.getElementById('app-container');
        if (aC) aC.classList.add('hidden');
        if (eC) eC.classList.add('hidden');
        if (apC) apC.classList.remove('hidden');
        esconderSplashScreen();

        const userDisplay = document.getElementById('user-display');
        if (userDisplay) userDisplay.innerText = currentUser.email;

        const userRef = ref(db_firebase, 'usuarios/' + currentUser.uid);
        onValue(userRef, (snapshot) => {
            try {
                const data = snapshot.val() || {};
                
                if (!data.email) data.email = currentUser.email;

                let accountInfo = data?.account;
                if (!accountInfo) {
                    accountInfo = { type: 'free', expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), forcePasswordChange: false };
                }

                const planosPadrao = [{ id: 1, nome: 'Mensal Gold', valor: 30.00, custo: 7.00, dias: 30 }];
                const appsPadrao = [{ id: 101, nome: "XCIPTV", url: "http://adonay.top", pin: "0000" }];
                const configPadrao = { 
                    aviso_dias: 3,
                    msg_boas_vindas: "Olá {cliente}, seja bem-vindo! Seu acesso ao app {app} está ativo até {vencimento}.",
                    msg_renovacao: "Olá {cliente}, seu plano {plano} vence em {dias} dias ({vencimento}). Vamos renovar?",
                    msg_sucesso: "Obrigado pelo pagamento, {cliente}! Seu acesso foi renovado com sucesso.",
                    msg_suspensa: "Olá {cliente}, seu acesso venceu em {vencimento} e foi suspenso. Para reativar, entre em contato."
                };

                const freeBanner = document.getElementById('free-plan-banner');
                if (freeBanner) {
                    if (accountInfo.type !== 'vip' && currentUser.email !== MEU_EMAIL_ADMIN) {
                        freeBanner.classList.remove('hidden');
                    } else {
                        freeBanner.classList.add('hidden');
                    }
                }

                // Trava de Tempo do Plano expirado
                if (currentUser.email !== MEU_EMAIL_ADMIN && Date.now() > accountInfo.expiresAt) {
                    if (apC) apC.classList.add('hidden');
                    if (aC) aC.classList.add('hidden');
                    if (eC) eC.classList.remove('hidden');
                    esconderSplashScreen();
                    return;
                }

                if (accountInfo.forcePasswordChange) {
                    UI.openModal('modalForcePassword');
                }

                if (aC) aC.classList.add('hidden');
                if (eC) eC.classList.add('hidden');
                if (apC) apC.classList.remove('hidden');

                const navAdmin = document.getElementById('nav-admin');
                if (currentUser.email === MEU_EMAIL_ADMIN && navAdmin) {
                    navAdmin.classList.remove('hidden');
                }

                const precisaPersistirPadroes = !data.planos || !data.apps || !data.config;

                setDb({
                    clientes: data.clientes || [],
                    planos: data.planos && data.planos.length > 0 ? data.planos : planosPadrao,
                    faturas: data.faturas || [],
                    apps: data.apps && data.apps.length > 0 ? data.apps : appsPadrao,
                    config: data.config && data.config.msg_boas_vindas ? data.config : configPadrao,
                    account: accountInfo
                });

                if (precisaPersistirPadroes) {
                    save();
                }

                UI.initApp();
                esconderSplashScreen();
            } catch (err) {
                console.error("Erro interno na montagem das abas:", err);
                esconderSplashScreen();
            }
        });
    } else {
        const aC = document.getElementById('auth-container');
        const eC = document.getElementById('expired-container');
        const apC = document.getElementById('app-container');
        if (aC) aC.classList.remove('hidden');
        if (apC) apC.classList.add('hidden');
        if (eC) eC.classList.add('hidden');
        esconderSplashScreen();
    }
});

window.logout = () => { signOut(auth).then(() => location.reload()); };

window.alterarSenha = async function(e) {
    e.preventDefault();
    const inputSenha = document.getElementById('change_password_input');
    if (!inputSenha) return;
    try {
        await updatePassword(auth.currentUser, inputSenha.value);
        UI.showNotify("Sucesso", "Senha alterada com sucesso!");
        UI.closeModal('modalChangePassword');
        inputSenha.value = "";
    } catch(err) {
        if (err.code === 'auth/requires-recent-login') {
            UI.showNotify("Segurança", "Precisa de sair e entrar novamente antes de trocar a senha.", "warning");
            logout();
        } else {
            UI.showNotify("Erro", err.message, "error");
        }
    }
};

window.alterarSenhaForcada = async function(e) {
    e.preventDefault();
    const inputSenha = document.getElementById('force_password_input');
    if (!inputSenha) return;
    try {
        await updatePassword(auth.currentUser, inputSenha.value);
        await update(ref(db_firebase, `usuarios/${auth.currentUser.uid}/account`), { forcePasswordChange: false });
        UI.showNotify("Sucesso", "A sua senha definitiva foi configurada!");
        UI.closeModal('modalForcePassword');
        inputSenha.value = "";
    } catch(err) {
        UI.showNotify("Erro", err.message, "error");
    }
};

document.getElementById('formLogin').onsubmit = async function (e) {
    e.preventDefault();
    const email = document.getElementById('login_email').value;
    const pass = document.getElementById('login_pass').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) { 
        UI.showNotify("Erro no Login", error.message, "error"); 
    }
};

document.getElementById('formRegister').onsubmit = async function (e) {
    e.preventDefault();
    const email = document.getElementById('register_email').value;
    const pass = document.getElementById('register_pass').value;
    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        const oUid = userCred.user.uid;
        await update(ref(db_firebase, 'usuarios/' + oUid), {
            email: email,
            account: { type: 'free', expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), forcePasswordChange: false }
        });
        UI.showNotify("Sucesso", "Conta criada com sucesso!");
    } catch (error) { 
        if (error.code === 'auth/email-already-in-use') {
            UI.showNotify("E-mail em uso", "Este e-mail já está registado no sistema.", "warning");
        } else {
            UI.showNotify("Erro", error.message, "error"); 
        }
    }
};

document.getElementById('formCliente').onsubmit = function (e) {
    e.preventDefault();
    const editId = document.getElementById('cli_edit_id').value;
    if (db.account.type !== 'vip' && !editId && db.clientes.length >= 3) {
        UI.showNotify("Limite Atingido", "O plano FREE permite apenas 3 clientes cadastrados.", "warning");
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

document.getElementById('formPlano').onsubmit = function (e) {
    e.preventDefault();
    const editId = document.getElementById('plan_edit_id').value;
    const data = { 
        nome: document.getElementById('plan_nome').value, 
        valor: parseFloat(document.getElementById('plan_valor').value), 
        custo: parseFloat(document.getElementById('plan_custo').value), 
        dias: document.getElementById('plan_dias_select').value === 'custom' ? parseInt(document.getElementById('plan_dias_custom').value) : parseInt(document.getElementById('plan_dias_select').value)
    };
    if (editId) { 
        const idx = db.planos.findIndex(p => p.id == editId); db.planos[idx] = { ...db.planos[idx], ...data }; 
    } else { 
        db.planos.push({ id: Date.now(), ...data }); 
    }
    save(); UI.closeModal('modalPlano'); UI.renderPlanos(); UI.renderClientes();
};

document.getElementById('formApp').onsubmit = function (e) {
    e.preventDefault();
    const editId = document.getElementById('app_edit_id').value;
    const data = { nome: document.getElementById('app_nome').value, url: document.getElementById('app_url').value, pin: document.getElementById('app_pin').value };
    if (editId) { 
        const idx = db.apps.findIndex(a => a.id == editId); db.apps[idx] = { ...db.apps[idx], ...data }; 
    } else { 
        db.apps.push({ id: Date.now(), ...data }); 
    }
    save(); UI.closeModal('modalApp'); UI.renderApps(); UI.renderClientes();
};

window.atualizarBarraAcoes = function() {
    const selecionados = document.querySelectorAll('.client-checkbox:checked');
    const barra = document.getElementById('bulk-actions-bar');
    const contador = document.getElementById('bulk-count');
    if (!barra) return;
    if (selecionados.length > 0) {
        if (contador) contador.innerText = `${selecionados.length} selecionado(s)`;
        barra.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    } else {
        barra.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    }
};

window.toggleSelectAll = function(source) {
    if (!source || source.id !== 'select-all-clients') return;
    const body = document.getElementById('table-clientes-body');
    if (!body) return;
    const checkboxes = body.querySelectorAll('.client-checkbox');
    checkboxes.forEach(cb => { cb.checked = source.checked; });
    window.atualizarBarraAcoes();
};

window.excluirEmMassa = function() {
    const selecionados = Array.from(document.querySelectorAll('.client-checkbox:checked')).map(cb => cb.value);
    if (selecionados.length === 0) return;
    if (confirm(`Tem certeza que deseja apagar esses ${selecionados.length} clientes?`)) {
        window.db.clientes = window.db.clientes.filter(c => !selecionados.includes(c.id.toString()));
        window.save();
        const checkMestre = document.getElementById('select-all-clients');
        if (checkMestre) checkMestre.checked = false;
        UI.renderClientes();
        window.atualizarBarraAcoes();
        UI.updateDashboard();
    }
};

window.dispararNotificacaoEmMassa = async function() {
    const selecionados = Array.from(document.querySelectorAll('.client-checkbox:checked')).map(cb => cb.value);
    if (selecionados.length === 0) return;
    UI.showNotify("Envio em Massa", `Iniciando envio de ${selecionados.length} mensagens. Não feche a página.`, "info");
    for (let i = 0; i < selecionados.length; i++) {
        const idCliente = selecionados[i];
        if (typeof API.sendManualWA === "function") { API.sendManualWA(idCliente, 'renew'); }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    UI.showNotify("Concluído", "Todos os envios foram processados!", "success");
    document.querySelectorAll('.client-checkbox').forEach(cb => cb.checked = false);
    const checkMestre = document.getElementById('select-all-clients');
    if (checkMestre) checkMestre.checked = false;
    window.atualizarBarraAcoes();
};

window.exportarSistema = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.db));
    const dlAnchor = document.createElement('a');
    const dataAtual = new Date().toLocaleDateString().replace(/\//g, '-');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `w3gestor_backup_${dataAtual}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    UI.showNotify("Backup", "Download do arquivo iniciado!", "success");
};

window.importarSistema = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupValido = JSON.parse(e.target.result);
            if (!backupValido.clientes) {
                UI.showNotify("Erro na Importação", "Arquivo JSON inválido.", "error");
                return;
            }
            if (confirm(`Atenção: Deseja restaurar este backup contendo ${backupValido.clientes.length} clientes?`)) {
                setDb(backupValido); save(); location.reload();
            }
        } catch (err) {
            UI.showNotify("Erro", "Falha ao processar o arquivo de backup.", "error");
        }
    };
    reader.readAsText(file);
};
