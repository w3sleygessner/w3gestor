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
    const baseURL = "https://w3gestorzap.duckdns.org"; 
    const apiKey = "Wesley123!";
    const instancia = "wesley_final_ok";

    try {
        if(window.showNotify) window.showNotify("Conectando", "A processar conexão com o servidor...", "info");

        // 1. Pergunta à API qual o estado atual dessa instância
        let resState = await fetch(`${baseURL}/instance/connectionState/${instancia}`, {
            headers: { 'apikey': apiKey }
        });

        let qrCodeBase64 = null;

        // 2. Se a instância NÃO EXISTIR (Erro 404), nós criamos!
        if (resState.status === 404) {
            if(window.showNotify) window.showNotify("Instância", "A criar nova instância...", "info");
            
            const resCreate = await fetch(`${baseURL}/instance/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({
                    instanceName: instancia,
                    integration: "WHATSAPP-BAILEYS",
                    qrcode: true
                })
            });
            
            const dataCreate = await resCreate.json();
            
            // Na versão 2.0, o QR Code de criação vem aqui:
            qrCodeBase64 = dataCreate?.qrcode?.base64 || dataCreate?.base64;
            
        } else {
            // 3. Se a instância EXISTE, vamos ver o estado dela
            const dataState = await resState.json();
            const estadoAtual = dataState?.instance?.state || dataState?.state;

            if (estadoAtual === 'open') {
                // Já conectado! Sucesso total.
                document.getElementById('wa-status').innerText = "WHATSAPP CONECTADO!";
                document.getElementById('wa-status').classList.replace("text-red-500", "text-green-500");
                document.getElementById('wa-status').classList.replace("text-yellow-500", "text-green-500");
                if(window.showNotify) window.showNotify("Sucesso", "O WhatsApp já está conectado e pronto a disparar!", "success");
                return; // Interrompe aqui para não pedir QR Code
            } else {
                // Está desligada. Pede apenas o QR Code de conexão.
                const resConnect = await fetch(`${baseURL}/instance/connect/${instancia}`, {
                    headers: { 'apikey': apiKey }
                });
                const dataConnect = await resConnect.json();
                qrCodeBase64 = dataConnect?.base64;
            }
        }

        // 4. Joga a imagem do QR Code na tela
        if (qrCodeBase64) {
            document.getElementById('wa-qr-code').src = qrCodeBase64;
            document.getElementById('wa-status').innerText = "ESCANEAR AGORA!";
            document.getElementById('wa-status').classList.replace("text-red-500", "text-yellow-500");
            document.getElementById('wa-status').classList.replace("text-green-500", "text-yellow-500");
        } else {
            console.error("Falha ao obter QR Code da API.");
            if(window.showNotify) window.showNotify("Erro", "Não foi possível gerar o QR Code.", "error");
        }

    } catch (e) { 
        console.error("Erro API WA:", e); 
        if(window.showNotify) window.showNotify("Erro", "Falha de comunicação com o servidor WhatsApp.", "error");
    }
}