import { ref, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { auth, db_firebase } from "./firebase-config.js";
import { updateDashboard } from "./ui.js";

// Objeto global de dados inicializado vazio para evitar sobrescrever a nuvem com padrões
export let db = { 
    clientes: [], 
    planos: [], 
    faturas: [], 
    apps: [], 
    config: { 
        aviso_dias: 3,
        msg_boas_vindas: "",
        msg_renovacao: "",
        msg_sucesso: "",
        msg_suspensa: ""
    },
    account: { type: 'free', expiresAt: 0 } 
};

// Esta função é vital: ela garante que o objeto 'db' que o resto do app usa seja o mesmo
export function setDb(data) {
    // Mantém as propriedades que podem vir vazias da nuvem
    db.clientes = data.clientes || [];
    db.planos = data.planos || [];
    db.faturas = data.faturas || [];
    db.apps = data.apps || [];
    db.config = data.config || db.config;
    db.account = data.account || db.account;
    
    // Sincroniza com o objeto global window para o console e outros módulos
    window.db = db; 
}

export function save() {
    const user = auth.currentUser;
    if (user) {
        // Importante: Salvamos o estado atual do objeto 'db'
        set(ref(db_firebase, 'usuarios/' + user.uid), db)
            .then(() => {
                console.log("✅ Nuvem sincronizada com sucesso!");
                // Sincroniza o objeto global sempre que salvar
                window.db = db;
            })
            .catch((e) => {
                console.error("❌ Erro ao sincronizar nuvem:", e);
                if(e.message.includes("permission_denied")) {
                    alert("Erro de permissão: Verifique se sua conta expirou ou se o limite foi atingido.");
                }
            });
    }
    updateDashboard();
}

// Expõe a função de salvar para o escopo global (usado nos modais e console)
window.save = save;
export async function save() {
    const auth = getAuth();
    const user = auth.currentUser;
    const db = getDatabase();

    if (user) {
        // Garante que está salvando na SUA pasta de usuário
        await set(ref(db, `usuarios/${user.uid}`), window.db);
    }
}
