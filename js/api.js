import { db } from "./database.js";

export function sendManualWA(cliId, type) {
    const cli = db.clientes.find(c => c.id == cliId);
    if (!cli) return;

    const app = db.apps.find(a => a.id == cli.app_id) || {};
    const plano = db.planos.find(p => p.id == cli.plano_id) || {};

    let template = db.config.msg_renovacao || "Atenção: Seu plano {plano} vence em {dias} dias.";
    if (type === 'welcome') template = db.config.msg_boas_vindas || "Bem-vindo!";
    if (type === 'success') template = db.config.msg_sucesso || "Pagamento confirmado!";
    if (type === 'suspended') template = db.config.msg_suspensa || "Conta suspensa.";
    
    // Novas mensagens corrigidas
    if (type === 'oscilacao') template = db.config.msg_oscilacao;
    if (type === 'manutencao') template = db.config.msg_manutencao;

    let msg = template;
    msg = msg.replace(/{cliente}/g, cli.nome).replace(/{app}/g, app.nome || "App");
    
    const fone = cli.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, '_blank');
}
