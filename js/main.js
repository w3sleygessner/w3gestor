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
window.carregarAssinantes = ADMIN.carregarAssinantes;
window.db = db;
window.save = save;

const MEU_EMAIL_ADMIN = "w3sleygessner@gmail.com";

function esconderSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';
        setTimeout(() => { if (splash) splash.remove(); }, 300);
    }
}

setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        console.warn("w3Gestor: O Firebase demorou muito para responder. Forçando a remoção do loader.");
        esconderSplashScreen();
    }
}, 4000);

onAuthStateChanged(auth, (currentUser) => {
    if (currentUser) {
        console.log("w3Gestor: Usuário autenticado. Montando ambiente...");
        
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
                    msg_suspensa: "Olá {cliente}, seu acesso venceu em {vencimento} e foi suspenso. Para reativar, entre em contato.",
                    msg_oscilacao: "⚠️ *Aviso de Instabilidade*\n\nOlá {cliente}, identificamos uma instabilidade no servidor do app {app}. Nossa equipe já está atuando para normalizar.",
                    msg_manutencao: "🔧 *Aviso de Manutenção*\n\nOlá {cliente}, o servidor do app {app} entrará em manutenção programada em breve para melhorias de estabilidade."
                };

                const freeBanner = document.getElementById('free-plan-banner');
                if (freeBanner) {
                    if (accountInfo.type !== 'vip' && currentUser.email !== MEU_EMAIL_ADMIN) {
                        freeBanner.classList.remove('hidden');
                    } else {
                        freeBanner.classList.add('hidden');
                    }
                }

                if (currentUser.email !== MEU_EMAIL_ADMIN && Date.now() > accountInfo.expiresAt) {
                    document.getElementById('app-container').classList.add('hidden');
                    document.getElementById('auth-container').classList.add('hidden');
                    document.getElementById('expired-container').classList.remove('hidden');
                    esconderSplashScreen();
                    return;
                }

                if (accountInfo.forcePasswordChange) {
                    UI.openModal('modalForcePassword');
                }

                document.getElementById('auth-container').classList.add('hidden');
                document.getElementById('expired-container').classList.add('hidden');
                document.getElementById('app-container').classList.remove('hidden');

                const navAdmin = document.getElementById('nav-admin');
                if (currentUser.email === MEU_EMAIL_ADMIN && navAdmin) {
                    navAdmin.classList.remove('hidden');
                    if (window.carregarAssinantes) window.carregarAssinantes();
                }

                const precisaPersistirPadroes = !data.planos || !data.apps || !data.config;

                setDb({
                    clientes: data.clientes || [],
                    invoices_pending: data.invoices_pending || [],
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
                console.error("Erro crítico na montagem das abas:", err);
                esconderSplashScreen();
            }
        });
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('expired-container').classList.add('hidden');
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
            UI.showNotify("Segurança", "Você precisa sair da conta e logar novamente antes de trocar a senha.", "warning");
            logout();
        } else {
            UI.showNotify("Erro", "Erro ao alterar senha: " + err.message, "error");
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
        UI.showNotify("Sucesso", "Sua senha definitiva foi configurada!");
        UI.closeModal('modalForcePassword');
        inputSenha.value = "";
    } catch(err) {
        UI.showNotify("Erro", "Erro ao salvar nova senha: " + err.message, "error");
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
            UI.showNotify("E-mail em uso", "Este e-mail já está cadastrado no sistema.", "warning");
        } else {
            UI.showNotify("Erro", error.message, "error"); 
        }
    }
};

document.getElementById('formCliente').onsubmit = function (e) {
    e.preventDefault();
    const editId = document.getElementById('cli_edit_id').value;
    
    if (db.account.type !== 'vip' && !editId && db.clientes.length >= 3) {
        UI.openModal('modalLimiteClientes');
        return;
    }

    const rawWhatsapp = document.getElementById('cli_whatsapp').value;
    const whatsappLimpo = rawWhatsapp.replace(/\D/g, '');

    const proc = UI.processCredentials(document.getElementById('cli_credenciais').value);
    const data = { 
        nome: document.getElementById('cli_nome').value, 
        whatsapp: whatsappLimpo, 
        plano_id: document.getElementById('cli_plano_id').value, 
        app_id: document.getElementById('cli_app_id').value, 
        vencimento: document.getElementById('cli_vencimento').value, 
        credenciais: proc.clean, 
        usuario: proc.user, 
        senha: proc.pass 
    };
    
    if (editId) { 
        const idx = db.clientes.findIndex(c => c.id == editId); 
        db.clientes[idx] = { ...db.clientes[idx], ...data }; 
    } else { 
        const id = Date.now(); 
        db.clientes.push({ id, ...data }); 
        setTimeout(() => API.sendManualWA(id, 'welcome'), 800); 
    }
    save(); 
    UI.closeModal('modalCliente'); 
    UI.renderClientes(); 
    UI.updateDashboard();
};

document.getElementById('formPlano').onsubmit = function (e) {
    e.preventDefault();
    const editId = document.getElementById('plan_edit_id').value;
    
    const data = { 
        nome: document.getElementById('plan_nome').value, 
        valor: parseFloat(document.getElementById('plan_valor').value), 
        custo: parseFloat(document.getElementById('plan_custo').value), 
        dias: document.getElementById('plan_dias_select').value === 'custom' ? 
              parseInt(document.getElementById('plan_dias_custom').value) : 
              parseInt(document.getElementById('plan_dias_select').value)
    };

    if (editId) { 
        const idx = db.planos.findIndex(p => p.id == editId); 
        db.planos[idx] = { ...db.planos[idx], ...data }; 
    } else { 
        db.planos.push({ id: Date.now(), ...data }); 
    }
    
    save(); 
    UI.closeModal('modalPlano'); 
    UI.renderPlanos(); 
    UI.renderClientes();
};

document.getElementById('formApp').onsubmit = function (e) {
    e.preventDefault();
    const editId = document.getElementById('app_edit_id').value;
    
    const data = { 
        nome: document.getElementById('app_nome').value, 
        url: document.getElementById('app_url').value, 
        pin: document.getElementById('app_pin').value 
    };

    if (editId) { 
        const idx = db.apps.findIndex(a => a.id == editId); 
        db.apps[idx] = { ...db.apps[idx], ...data }; 
    } else { 
        db.apps.push({ id: Date.now(), ...data }); 
    }
    
    save(); 
    UI.closeModal('modalApp'); 
    UI.renderApps(); 
    UI.renderClientes();
};

document.addEventListener('contextmenu', event => event.preventDefault());

window.atualizarBarraAcoes = function() {
    const selecionados = document.querySelectorAll('.client-checkbox:checked');
    const barra = document.getElementById('bulk-actions-bar');
    const contador = document.getElementById('bulk-count');

    if (!barra) return;

    if (selecionados.length > 0) {
        if (contador) contador.innerText = `${selecionados.length} selecionados`;
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

    window.meuConfirm("Excluir Clientes", `Tem certeza que deseja apagar esses ${selecionados.length} clientes?`, () => {
        window.db.clientes = window.db.clientes.filter(c => !selecionados.includes(c.id.toString()));
        window.save();
        
        const checkMestre = document.getElementById('select-all-clients');
        if (checkMestre) checkMestre.checked = false;

        UI.renderClientes();
        window.atualizarBarraAcoes();
        UI.updateDashboard();
    });
};
