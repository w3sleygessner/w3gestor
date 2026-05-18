import { db } from "./database.js";

export function sendManualWA(cliId, type) {
    const cli = db.clientes.find(c => c.id == cliId);
    if (!cli) return;

    const app = db.apps.find(a => a.id == cli.app_id) || {};
    const plano = db.planos.find(p => p.id == cli.plano_id) || {};

    let template = db.config.msg_renovacao;
    if (type === 'welcome') template = db.config.msg_boas_vindas;
    if (type === 'success') template = db.config.msg_sucesso;
    if (type === 'suspended') template = db.config.msg_suspensa;

    let msg = template || "";
    msg = msg.replace(/{cliente}/g, cli.nome || "");
    msg = msg.replace(/{usuario}/g, cli.usuario || "N/A");
    msg = msg.replace(/{senha}/g, cli.senha || "N/A");
    msg = msg.replace(/{vencimento}/g, cli.vencimento.split('-').reverse().join('/'));
    msg = msg.replace(/{app}/g, app.nome || "N/A");
    msg = msg.replace(/{plano}/g, plano.nome || "");
    msg = msg.replace(/{valor}/g, plano.valor ? `R$ ${plano.valor.toFixed(2)}` : "0,00");

    const hoje = new Date();
    const venci = new Date(cli.vencimento);
    const diff = Math.ceil((venci - hoje) / (1000 * 60 * 60 * 24));
    msg = msg.replace(/{dias}/g, diff);

    const fone = cli.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, '_blank');
}

export async function conectarWhatsAppReal() {
    const baseURL = "https://crazy-licorice-that.ngrok-free.dev";
    const apiKey = "Wesley123!";
    const instancia = "wesley_final_ok";
    try {
        await fetch(`${baseURL}/instance/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey, 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify({ instanceName: instancia, token: apiKey, qrcode: true })
        });
        await new Promise(r => setTimeout(r, 3000));
        const res = await fetch(`${baseURL}/instance/connect/${instancia}`, {
            headers: { 'apikey': apiKey, 'ngrok-skip-browser-warning': 'true' }
        });
        const data = await res.json();
        if (data.base64) {
            document.getElementById('wa-qr-code').src = data.base64;
            document.getElementById('wa-status').innerText = "QR CODE PRONTO!";
        }
    } catch (e) { console.log("Erro API WA"); }
}