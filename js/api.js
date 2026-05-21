import { db } from "./database.js";
import { auth } from "./firebase-config.js";

const baseURL = "https://w3gestorapi.duckdns.org";
const apiKey = "Wesley123!";

function obterNomeInstancia() {
    const usuarioLogado = auth.currentUser;
    if (!usuarioLogado) return null;
    return `user_${usuarioLogado.uid.toLowerCase()}`;
}

// 🤖 AUTOMAÇÃO: Régua de Cobrança Automática
export async function verificarReguaDeCobranca() {
    const instancia = obterNomeInstancia();
    if (!instancia) return;

    const hojeStr = new Date().toISOString().split('T')[0];
    if (localStorage.getItem(`regua_executada_${hojeStr}`) === 'true') return;

    if (!db.clientes || !db.config) return;

    const diasRegua = parseInt(db.config.dias_aviso) || 3; 
    let disparosRealizados = 0;

    for (const cli of db.clientes) {
        if (!cli.vencimento || cli.status === 'inativo') continue;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const vencimento = new Date(cli.vencimento);
        vencimento.setHours(0, 0, 0, 0);

        const diffTime = vencimento - hoje;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === diasRegua) {
            await sendManualWA(cli.id, 'renovacao');
            disparosRealizados++;
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    localStorage.setItem(`regua_executada_${hojeStr}`, 'true');
    if (disparosRealizados > 0 && window.showNotify) {
        window.showNotify("Aviso Automático", `${disparosRealizados} lembretes de cobrança enviados!`, "success");
    }
}

export async function sendManualWA(cliId, type) {
    const cli = db.clientes.find(c => c.id == cliId);
    if (!cli) return;

    const app = db.apps.find(a => a.id == cli.app_id) || {};
    const plano = db.planos.find(p => p.id == cli.plano_id) || {};

    let template = db.config.msg_renovacao || "Olá {cliente}, sua assinatura do app {app} vence dia {vencimento}.";
    if (type === 'welcome') template = db.config.msg_boas_vindas || "Olá {cliente}, seja bem-vindo(a) ao {app}!";
    if (type === 'success') template = db.config.msg_sucesso || "Olá {cliente}, pagamento confirmado!";
    if (type === 'suspended') template = db.config.msg_suspensa || "⚠️ Seu acesso ao {app} foi suspenso.";
    
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

export async function sendCustomWA(telefone, msg, nomeCliente = "Cliente") {
    if (!msg || msg.trim() === "") return;

    let fone = telefone.replace(/\D/g, '');
    if (!fone.startsWith('55')) fone = '55' + fone; 

    const instancia = obterNomeInstancia();
    if (!instancia) return;

    try {
        if(window.showNotify) window.showNotify("Enviando...", `A disparar para ${nomeCliente}`, "info");

        const response = await fetch(`${baseURL}/message/sendText/${instancia}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'apikey': apiKey
            },
            body: JSON.stringify({ number: fone, text: msg })
        });

        if (response.ok) {
            if(window.showNotify) window.showNotify("Sucesso!", `Mensagem entregue.`, "success");
        } else {
            if(window.showNotify) window.showNotify("Erro", "O WhatsApp recusou o número ou está desconectado.", "error");
        }
    } catch (error) {
        console.error("Erro:", error);
    }
}

// 🔌 NOVA FUNÇÃO: DESCONECTAR WHATSAPP DA API
export async function desconectarWhatsAppReal() {
    const instancia = obterNomeInstancia();
    if (!instancia) return;

    if (!confirm("Tem certeza que deseja encerrar a conexão do WhatsApp no servidor?")) return;

    try {
        if (window.showNotify) window.showNotify("Aguarde", "A desconectar...", "info");

        // Rota de logout da Evolution API
        const response = await fetch(`${baseURL}/instance/logout/${instancia}`, {
            method: 'DELETE',
            headers: { 'apikey': apiKey }
        });

        if (response.ok || response.status === 404) {
            if (window.showNotify) window.showNotify("Desconectado", "Sessão encerrada com sucesso.", "success");
            
            // Reseta UI
            document.getElementById('wa-status').innerText = "DESCONECTADO";
            document.getElementById('wa-status').classList.replace("text-green-500", "text-red-500");
            document.getElementById('wa-qr-code').src = "https://via.placeholder.com/250?text=Sessão+Encerrada"; 
            
            const descContainer = document.getElementById('wa-disconnect-container');
            if(descContainer) descContainer.classList.add('hidden');
        } else {
            if (window.showNotify) window.showNotify("Erro", "Falha na API. Desconecte pelo celular.", "error");
        }
    } catch (error) {
        console.error("Erro:", error);
    }
}

// 🔌 CONEXÃO E GERENCIAMENTO VISUAL DO WHATSAPP
export async function conectarWhatsAppReal() {
    const instancia = obterNomeInstancia();
    if (!instancia) return;

    const qrImg = document.getElementById('wa-qr-code');
    const statusTxt = document.getElementById('wa-status');
    const descContainer = document.getElementById('wa-disconnect-container');

    try {
        if(window.showNotify) window.showNotify("Verificando", "A consultar o servidor...", "info");

        // Verifica estado
        let resState = await fetch(`${baseURL}/instance/connectionState/${instancia}`, {
            headers: { 'apikey': apiKey }
        });

        let qrCodeBase64 = null;

        // Se não existir, cria a instância
        if (resState.status === 404 || resState.status === 400) {
            await fetch(`${baseURL}/instance/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({ instanceName: instancia, integration: "WHATSAPP-BAILEYS", qrcode: true })
            });
            await new Promise(r => setTimeout(r, 3000));
            
            const resConn = await fetch(`${baseURL}/instance/connect/${instancia}`, { headers: { 'apikey': apiKey } });
            const dataConn = await resConn.json();
            qrCodeBase64 = dataConn?.qrcode?.base64 || dataConn?.base64;
            
        } else {
            // Instância existe, vamos checar se está conectada (open)
            const dataState = await resState.json();
            const estadoAtual = dataState?.instance?.state || dataState?.state;

            if (estadoAtual === 'open') {
                // UI: CONECTADO
                statusTxt.innerText = "WHATSAPP CONECTADO!";
                statusTxt.classList.remove("text-red-500", "text-yellow-500");
                statusTxt.classList.add("text-green-500");
                
                // Exibe imagem de sucesso em vez do QR
                qrImg.src = "https://cdn-icons-png.flaticon.com/512/134/134937.png"; 
                qrImg.classList.add("p-6"); // Dá espaço pro icone ficar bonito
                
                // Mostra a área de desconectar e o tutorial
                if (descContainer) descContainer.classList.remove('hidden');

                if(window.showNotify) window.showNotify("Tudo Pronto!", "O WhatsApp está ativo e conectado.", "success");
                return;
            }
            
            // UI: DESCONECTADO (Pede novo QR)
            if (descContainer) descContainer.classList.add('hidden');
            qrImg.classList.remove("p-6");

            const resConn = await fetch(`${baseURL}/instance/connect/${instancia}`, { headers: { 'apikey': apiKey } });
            const dataConn = await resConn.json();
            qrCodeBase64 = dataConn?.qrcode?.base64 || dataConn?.base64;
        }

        // Renderiza o QR Code
        if (qrCodeBase64 && qrCodeBase64.includes("base64")) {
            qrImg.src = qrCodeBase64;
            statusTxt.innerText = "ESCANEAR AGORA!";
            statusTxt.classList.remove("text-red-500", "text-green-500");
            statusTxt.classList.add("text-yellow-500");
        }

    } catch (e) { 
        console.error("Erro API WA:", e); 
        if(window.showNotify) window.showNotify("Erro", "O Servidor está offline.", "error");
    }
}