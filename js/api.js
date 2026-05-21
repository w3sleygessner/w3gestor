import { db } from "./database.js";
import { auth } from "./firebase-config.js";

// Configurações Globais da API do WhatsApp
const baseURL = "https://w3gestorapi.duckdns.org";
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

    // 🛡️ ADICIONADO: Textos padrão à prova de falhas caso o painel esteja vazio!
    let template = db.config.msg_renovacao || "Olá {cliente}, sua assinatura do app {app} vence dia {vencimento}. Valor: {valor}.";
    if (type === 'welcome') template = db.config.msg_boas_vindas || "Olá {cliente}, seja bem-vindo(a) ao {app}! \n👤 Usuário: {usuario}\n🔑 Senha: {senha}";
    if (type === 'success') template = db.config.msg_sucesso || "Olá {cliente}, pagamento de {valor} confirmado! Próximo vencimento: {vencimento}.";
    if (type === 'suspended') template = db.config.msg_suspensa || "⚠️ *Aviso de Suspensão*\n\nOlá {cliente}, seu acesso ao app {app} foi suspenso devido a atraso no pagamento. Por favor, regularize para voltar a usar.";
    if (type === 'oscilacao') template = db.config.msg_oscilacao || "⚠️ *Aviso de Instabilidade*\n\nOlá {cliente}, identificamos uma oscilação no servidor do app {app}. Nossa equipe já está atuando para normalizar o sinal.";
    if (type === 'manutencao') template = db.config.msg_manutencao || "🔧 *Aviso de Manutenção*\n\nOlá {cliente}, o servidor do app {app} entrará em manutenção programada em breve.";

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

// 🚀 DISPARO 100% SILENCIOSO (Sem abrir abas)
export async function sendCustomWA(telefone, msg, nomeCliente = "Cliente") {
    // Impede o envio se a mensagem estiver magicamente vazia
    if (!msg || msg.trim() === "") {
        if(window.showNotify) window.showNotify("Erro", "A mensagem está vazia. Verifique as configurações.", "error");
        return;
    }

    let fone = telefone.replace(/\D/g, '');
    if (!fone.startsWith('55')) fone = '55' + fone; 

    const instancia = obterNomeInstancia();
    
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
                'ngrok-skip-browser-warning': 'true' 
            },
            // ENVIO BRUTO: Sem simular digitação para evitar que a API trave
            body: JSON.stringify({
                number: fone,
                text: msg
            })
        });
        if (response.ok) {
            if(window.showNotify) window.showNotify("Sucesso!", `Mensagem entregue direto no WhatsApp.`, "success");
        } else {
            const erroDetalhado = await response.text();
            console.error("Erro detalhado da API:", erroDetalhado);
            throw new Error(`Erro na resposta da API: ${response.status}`);
        }

    } catch (error) {
        console.error("Erro no envio pelo WhatsApp:", error);
        if(window.showNotify) window.showNotify("Erro de Envio", "Falha de comunicação com o servidor WhatsApp.", "error");
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