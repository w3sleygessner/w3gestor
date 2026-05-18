import { ref, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { auth, db_firebase } from "./firebase-config.js";
import { updateDashboard } from "./ui.js";

// Objeto global de dados (Agora com a conta)
export let db = { 
    clientes: [], 
    planos: [
        { id: 1, nome: 'Mensal Gold', valor: 30.00, custo: 7.00, dias: "30 -> do plano vip" }
    ], 
    faturas: [], 
    apps: [
        { id: 101, nome: "XCIPTV", url: "http://adonay.top", pin: "0000" }
    ], 
    config: { 
        aviso_dias: 3,
        msg_boas_vindas: "Olá {cliente}, seja bem-vindo! Seu acesso ao app {app} está ativo até {vencimento}.",
        msg_renovacao: "Olá {cliente}, seu plano {plano} vence em {dias} dias ({vencimento}). Vamos renovar?",
        msg_sucesso: "Obrigado pelo pagamento, {cliente}! Seu acesso foi renovado com sucesso.",
        msg_suspensa: "Olá {cliente}, seu acesso venceu em {vencimento} e foi suspenso. Para reativar, entre em contato."
    },
    account: { type: 'free', expiresAt: 0 } 
};

export function setDb(data) {
    db = data;
}

export function save() {
    const user = auth.currentUser;
    if (user) {
        set(ref(db_firebase, 'usuarios/' + user.uid), db)
            .then(() => console.log("Nuvem sincronizada!"))
            .catch((e) => console.error("Erro ao salvar:", e));
    }
    updateDashboard();
}