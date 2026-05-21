import { db } from "./database.js";
import { auth } from "./firebase-config.js";

// A instância seria o ID único de quem fez o login no sistema
// Configurações da sua API do WhatsApp (Evolution API / CodeChat)
const baseURL = "https://w3gestorzap.duckdns.org";
const apiKey = "Wesley123!";
const instancia = "user_" + auth.currentUser.uid;


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
    // MUDANÇA AQUI: Novo nome para criar uma instância limpa, sem histórico de erros

    try {
        if(window.showNotify) window.showNotify("Conectando", "A comunicar com o servidor...", "info");

        // 1. Tenta ver se a instância já existe
        let resState = await fetch(`${baseURL}/instance/connectionState/${instancia}`, {
            headers: { 'apikey': apiKey }
        });

        let qrCodeBase64 = null;

        // 2. Se NÃO EXISTIR (404), manda criar e JÁ PEGA a imagem!
        if (resState.status === 404 || resState.status === 400) {
            if(window.showNotify) window.showNotify("Instância", "A criar nova máquina limpa...", "info");
            
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
            console.log("Resposta da Criação:", dataCreate);
            
            // Na V2 o QR Code já vem dentro da resposta de criação!
            qrCodeBase64 = dataCreate?.qrcode?.base64 || dataCreate?.base64;
            
        } else {
            // 3. Se JÁ EXISTE, vê se está conectada
            const dataState = await resState.json();
            const estadoAtual = dataState?.instance?.state || dataState?.state;

            if (estadoAtual === 'open') {
                document.getElementById('wa-status').innerText = "WHATSAPP CONECTADO!";
                document.getElementById('wa-status').classList.remove("text-red-500", "text-yellow-500");
                document.getElementById('wa-status').classList.add("text-green-500");
                if(window.showNotify) window.showNotify("Sucesso", "O WhatsApp já está conectado!", "success");
                return; // Para aqui
            } else {
                // 4. Se existe mas está fechada, pede o QR Code novo
                const resConnect = await fetch(`${baseURL}/instance/connect/${instancia}`, {
                    headers: { 'apikey': apiKey }
                });
                const dataConnect = await resConnect.json();
                console.log("Resposta do Connect:", dataConnect);
                qrCodeBase64 = dataConnect?.qrcode?.base64 || dataConnect?.base64;
            }
        }

        // 5. Joga a imagem na tela
        if (qrCodeBase64 && typeof qrCodeBase64 === 'string' && qrCodeBase64.includes("base64")) {
            document.getElementById('wa-qr-code').src = qrCodeBase64;
            document.getElementById('wa-status').innerText = "ESCANEAR AGORA!";
            document.getElementById('wa-status').classList.remove("text-red-500", "text-green-500");
            document.getElementById('wa-status').classList.add("text-yellow-500");
        } else {
            if(window.showNotify) window.showNotify("Aviso", "Gerando QR Code... Clique em conectar novamente.", "warning");
        }

    } catch (e) { 
        console.error("Erro API WA:", e); 
        if(window.showNotify) window.showNotify("Erro", "Falha de comunicação com o servidor WhatsApp.", "error");
    }
}