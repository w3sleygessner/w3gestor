import { ref, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { auth, db_firebase } from "./firebase-config.js";
import { updateDashboard } from "./ui.js";

// Objeto global de dados
export let db = { 
    clientes: [], 
    planos: [], 
    faturas: [], 
    apps: [], 
    config: { 
        aviso_dias: 3,
        msg_boas_vindas: "Olá {cliente}, seu acesso ao {app} está ativo até {vencimento}.",
        msg_renovacao: "Olá {cliente}, seu plano {plano} vence em {vencimento}. Vamos renovar?",
        msg_sucesso: "Obrigado pelo pagamento, {cliente}!",
        msg_suspensa: "Olá {cliente}, seu acesso venceu em {vencimento}."
    },
    account: { type: 'free', expiresAt: 0 } 
};

// Função para carregar os dados e garantir que existam exemplos se estiver vazio
export function setDb(data) {
    db.clientes = data.clientes || [];
    db.faturas = data.faturas || [];
    db.config = data.config || db.config;
    db.account = data.account || db.account;

    // Se não houver planos no banco, insere o exemplo
    if (!data.planos || data.planos.length === 0) {
        db.planos = [{ id: 1, nome: 'Mensal Gold', valor: 30.00, custo: 7.00, dias: 30 }];
    } else {
        db.planos = data.planos;
    }

    // Se não houver apps no banco, insere o exemplo
    if (!data.apps || data.apps.length === 0) {
        db.apps = [{ id: 101, nome: "XCIPTV", url: "http://adonay.top", pin: "0000" }];
    } else {
        db.apps = data.apps;
    }
    
    window.db = db; 
}

export function save() {
    const user = auth.currentUser;
    if (user) {
        set(ref(db_firebase, 'usuarios/' + user.uid), db)
            .then(() => {
                console.log("✅ Nuvem sincronizada!");
                window.db = db;
            })
            .catch((e) => console.error("❌ Erro ao salvar:", e));
    }
    updateDashboard();
}

// CORREÇÃO DO ERRO: Atribuímos a função já declarada ao window sem usar "let" ou "const"
window.save = save;
