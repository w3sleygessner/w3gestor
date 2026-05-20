import { ref, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { auth, db_firebase } from "./firebase-config.js";
import { updateDashboard } from "./ui.js";

// Objeto global de dados
export let db = { 
    email: "",
    clientes: [], 
    planos: [], 
    faturas: [], 
    invoices_pending: [], // Nova área de pendentes
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

export function setDb(data) {
    db.email = data.email || (auth.currentUser ? auth.currentUser.email : "");
    db.clientes = data.clientes ? Object.values(data.clientes) : [];
    db.faturas = data.faturas ? Object.values(data.faturas) : [];
    db.invoices_pending = data.invoices_pending ? Object.values(data.invoices_pending) : [];
    db.config = data.config || db.config;
    db.account = data.account || db.account;

    if (!data.planos || data.planos.length === 0) {
        db.planos = [{ id: 1, nome: 'Mensal Gold', valor: 30.00, custo: 7.00, dias: 30 }];
    } else {
        db.planos = Object.values(data.planos);
    }

    if (!data.apps || data.apps.length === 0) {
        db.apps = [{ id: 101, nome: "XCIPTV", url: "http://adonay.top", pin: "0000" }];
    } else {
        db.apps = Object.values(data.apps);
    }
    
    window.db = db; 
}

export function save() {
    const user = auth.currentUser;
    if (user) {
        db.email = user.email;

        set(ref(db_firebase, 'usuarios/' + user.uid), db)
            .then(() => {
                console.log("✅ Nuvem sincronizada!");
                window.db = db;
            })
            .catch((e) => console.error("❌ Erro ao salvar:", e));
    }
    updateDashboard();
}

window.exportarSistema = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
    const dlAnchor = document.createElement('a');
    const dataAtual = new Date().toLocaleDateString().replace(/\//g, '-');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `w3gestor_backup_${dataAtual}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
};

window.importarSistema = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupValido = JSON.parse(e.target.result);
            if (!backupValido.clientes) {
                if(window.showNotify) window.showNotify("Erro", "Arquivo JSON inválido.");
                return;
            }
            if (confirm(`Atenção: Deseja importar este backup?`)) {
                setDb(backupValido);
                save();
                location.reload();
            }
        } catch (err) {
            if(window.showNotify) window.showNotify("Erro", "Erro ao ler o arquivo de backup.");
        }
    };
    reader.readAsText(file);
};