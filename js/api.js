import { db } from "./database.js";
import { auth } from "./firebase-config.js";

// Configurações Globais da API do WhatsApp
const baseURL = "https://w3gestorzap.duckdns.org";
const apiKey = "Wesley123!";

// 🛠️ FUNÇÃO AUXILIAR: Pega a instância dinamicamente apenas quando necessário
function obterNomeInstancia() {
    const usuarioLogado = auth.currentUser;
    if (!usuarioLogado) {
        console.warn("Aviso: Firebase Auth ainda não inicializou.");
        return null;
    }
    // CRUCIAL: O .toLowerCase() evita que o banco de dados se perca com o ID
    return `user_${usuarioLogado.uid.toLowerCase()}`;
}

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

// 🚀 DISPARO SILENCIOSO
// 🚀 DISPARO 100% SILENCIOSO (Sem abrir abas)
export async function sendCustomWA(telefone, msg, nomeCliente = "Cliente") {
    let fone = telefone.replace(/\D/g, '');
    if (!fone.startsWith('55')) fone = '55' + fone; 

    const instancia = obterNomeInstancia();
    
    // Se não achar a instância, mostra erro em vez de abrir link
    if (!instancia) {
        console.error("Erro: Instância indisponível.");
        if(window.showNotify) window.showNotify("Erro", "Aguarde o sistema carregar a sua conta para enviar.", "error");
        return;
    }

    try {
        if(window.showNotify) window.showNotify("Enviando...", `Processando envio para ${nomeCliente}`, "info");

        const response = await fetch(`${baseURL}/message/sendText/${instancia}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'apikey': apiKey,
                'ngrok-skip-browser-warning': 'true' // Mantido por precaução
            },
            body: JSON.stringify({
                number: fone,
                options: {
                    delay: 1500, // Simula que está digitando
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
            console.error("Resposta da API falhou. Status:", response.status);
            throw new Error("Erro na resposta da API");
        }

    } catch (error) {
        console.error("Erro na API do WhatsApp:", error);
        // Exibe o erro na tela em vez de abrir o wa.me!
        if(window.showNotify) window.showNotify("Erro de Envio", "O WhatsApp falhou ou está desconectado.", "error");
    }
}

// 🔌 CONEXÃO DO QR CODE DINÂMICA

export async function conectarWhatsAppReal() {
    const instancia = obterNomeInstancia();

    if (!instancia) {
        if(window.showNotify) window.showNotify("Erro", "Aguarde a autenticação do usuário ser concluída.", "error");
        return;
    }

    try {
        if(window.showNotify) window.showNotify("Conectando", "A verificar servidor...", "info");

        // 1. Tenta ver se a instância já existe
        let resState = await fetch(`${baseURL}/instance/connectionState/${instancia}`, {
            headers: { 'apikey': apiKey }
        });

        let qrCodeBase64 = null;

        // 2. Se NÃO EXISTIR (404), manda criar
        if (resState.status === 404 || resState.status === 400) {
            if(window.showNotify) window.showNotify("Instância", "A preparar o motor do WhatsApp...", "info");
            
            await fetch(`${baseURL}/instance/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({
                    instanceName: instancia,
                    integration: "WHATSAPP-BAILEYS",
                    qrcode: true
                })
            });
            
            // Graças à "vacina" do Chrome no servidor, 3 segundos agora são suficientes!
            await new Promise(r => setTimeout(r, 3000));
            
            // Pede a imagem fresca da máquina recém-criada
            const resConn = await fetch(`${baseURL}/instance/connect/${instancia}`, { headers: { 'apikey': apiKey } });
            const dataConn = await resConn.json();
            console.log("Resposta Connect (Nova Instância):", dataConn);
            qrCodeBase64 = dataConn?.qrcode?.base64 || dataConn?.base64;
            
        } else {
            // 3. Se JÁ EXISTE, vê se está conectada
            const dataState = await resState.json();
            const estadoAtual = dataState?.instance?.state || dataState?.state;

            if (estadoAtual === 'open') {
                document.getElementById('wa-status').innerText = "WHATSAPP CONECTADO!";
                document.getElementById('wa-status').classList.remove("text-red-500", "text-yellow-500");
                document.getElementById('wa-status').classList.add("text-green-500");
                if(window.showNotify) window.showNotify("Sucesso", "O WhatsApp já está conectado!", "success");
                return;
            }
            
            // Se existe mas a conexão está fechada, pede o QR Code novo
            if(window.showNotify) window.showNotify("QR Code", "A gerar nova imagem de segurança...", "info");
            const resConn = await fetch(`${baseURL}/instance/connect/${instancia}`, { headers: { 'apikey': apiKey } });
            const dataConn = await resConn.json();
            console.log("Resposta Connect (Máquina Existente):", dataConn);
            qrCodeBase64 = dataConn?.qrcode?.base64 || dataConn?.base64;
        }

        // 4. Renderiza na tela
        if (qrCodeBase64 && typeof qrCodeBase64 === 'string' && qrCodeBase64.includes("base64")) {
            document.getElementById('wa-qr-code').src = qrCodeBase64;
            document.getElementById('wa-status').innerText = "ESCANEAR AGORA!";
            document.getElementById('wa-status').classList.remove("text-red-500", "text-green-500");
            document.getElementById('wa-status').classList.add("text-yellow-500");
        } else {
            if(window.showNotify) window.showNotify("Aviso", "Servidor a finalizar a imagem. Clique em conectar novamente.", "warning");
        }

    } catch (e) { 
        console.error("Erro API WA:", e); 
        if(window.showNotify) window.showNotify("Erro", "Falha de comunicação com o servidor WhatsApp.", "error");
    }
}