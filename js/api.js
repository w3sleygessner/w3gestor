import { db } from "./database.js";

// Configurações da sua API do WhatsApp (Evolution API / CodeChat)
const baseURL = "https://w3gestorzap.duckdns.org";
const apiKey = "Wesley123!";
const instancia = "wesley_final_ok";

export async function sendManualWA(cliId, type) {
    const cli = db.clientes.find(c => c.id == cliId);
    if (!cli) return;

    const app = db.apps.find(a => a.id == cli.app_id) || {};
    const plano = db.planos.find(p => p.id == cli.plano_id) || {};

    let template = db.config.msg_renovacao;
    if (type === 'welcome') template = db.config.msg_boas_vindas;
    if (type === 'success') template = db.config.msg_sucesso;
    if (type === 'suspended') template = db.config.msg_suspensa;
    if (type === 'oscilacao') {
        template = db.config.msg_oscilacao || "⚠️ *Aviso de Instabilidade*\n\nOlá {cliente}, identificamos uma oscilação no servidor do app {app}. Nossa equipe já está atuando para normalizar o sinal.";
    }
    if (type === 'manutencao') {
        template = db.config.msg_manutencao || "🔧 *Aviso de Manutenção*\n\nOlá {cliente}, o servidor do app {app} entrará em manutenção programada em breve para melhorias.";
    }

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

    await sendCustomWA(cli.whatsapp, msg, cli.nome);
}

// 🚀 NOVA FUNÇÃO: Dispara mensagens de forma 100% silenciosa
export async function sendCustomWA(telefone, msg, nomeCliente = "Cliente") {
    let fone = telefone.replace(/\D/g, '');
    if (!fone.startsWith('55')) fone = '55' + fone; // Garante o código do Brasil

    try {
        if(window.showNotify) window.showNotify("Enviando...", `Processando envio para ${nomeCliente}`, "info");

        const response = await fetch(`${baseURL}/message/sendText/${instancia}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'apikey': apiKey,
                'ngrok-skip-browser-warning': 'true' // Vital enquanto usar o ngrok
            },
            body: JSON.stringify({
                number: fone,
                options: {
                    delay: 1500, // Dá um delay para simular que você está digitando
                    presence: "composing" 
                },
                textMessage: {
                    text: msg
                }
            })
        });

        if (response.ok) {
            if(window.showNotify) window.showNotify("Sucesso!", `Mensagem entregue direto no WhatsApp.`, "success");
        } else {
            throw new Error("Erro na resposta da API");
        }

    } catch (error) {
        console.error("Erro na API do WhatsApp:", error);
        if(window.showNotify) window.showNotify("Aviso", "API Offline. Abrindo janela manual...", "warning");
        
        // Plano B: Se a API falhar (ex: ngrok fechou), abre a URL antiga
        window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
}

export async function conectarWhatsAppReal() {
    try {
        if(window.showNotify) window.showNotify("Conectando", "Solicitando QR Code à API...", "info");
        
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
            document.getElementById('wa-status').innerText = "ESCANEAR AGORA!";
            document.getElementById('wa-status').classList.replace("text-red-500", "text-green-500");
        } else {
            if(window.showNotify) window.showNotify("Aviso", "Instância conectada ou erro de geração.", "warning");
        }
    } catch (e) { 
        console.log("Erro API WA", e); 
        if(window.showNotify) window.showNotify("Erro", "API Offline. Verifique seu servidor.", "error");
    }
}