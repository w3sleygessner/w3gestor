import { db } from "./database.js";
import { auth } from "./firebase-config.js";

// A BARRA DO FINAL FOI REMOVIDA PARA EVITAR O ERRO // (DUPLA BARRA)
const baseURL = "https://w3gestorapi.camdvr.org"; 
const apiKey = "Wesley123!";

let connectionCheckInterval; // Controle do loop do QR Code

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
    if (type === 'oscilacao') template = db.config.msg_oscilacao || "⚠️ Aviso de Oscilação no {app}.";
    if (type === 'manutencao') template = db.config.msg_manutencao || "🔧 Aviso de Manutenção no {app}.";
    
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

// 🔍 VERIFICAÇÃO SILENCIOSA: Roda ao carregar o app para checar se o usuário já tem sessão ativa
export async function checarStatusWhatsAppSilencioso() {
    const instancia = obterNomeInstancia();
    if (!instancia) return;

    const displayContainer = document.getElementById('wa-display-container');
    const statusTxt = document.getElementById('wa-status');
    const btnConectar = document.getElementById('btn-conectar-wa');
    const descContainer = document.getElementById('wa-disconnect-container');

    if (!statusTxt) return;

    try {
        let resState = await fetch(`${baseURL}/instance/connectionState/${instancia}`, {
            headers: { 'apikey': apiKey }
        });

        if (resState.status === 200) {
            const dataState = await resState.json();
            const estadoAtual = dataState?.instance?.state || dataState?.state;

            if (estadoAtual === 'open') {
                statusTxt.innerText = "CONECTADO!";
                statusTxt.className = "text-green-500 font-bold uppercase tracking-wider";
                
                // ESCONDER QR CODE POIS JÁ ESTÁ CONECTADO
                if (displayContainer) displayContainer.classList.add('hidden');
                
                // ESCONDER BOTÃO DE GERAR QR CODE
                if (btnConectar) btnConectar.classList.add('hidden');
                
                // MOSTRAR BOTÃO DE DESCONECTAR
                if (descContainer) descContainer.classList.remove('hidden');
                return;
            }
        }

        // Se não retornar status 200 ou não estiver aberto, monta o estado inicial padrão (Desconectado)
        statusTxt.innerText = "DESCONECTADO";
        statusTxt.className = "text-red-500 font-bold uppercase tracking-wider";
        if (displayContainer) displayContainer.classList.add('hidden');
        if (btnConectar) btnConectar.classList.remove('hidden');
        if (descContainer) descContainer.classList.add('hidden');

    } catch (e) {
        console.error("Erro na verificação silenciosa:", e);
        statusTxt.innerText = "ERRO DE CONEXÃO";
        statusTxt.className = "text-red-500 font-bold uppercase tracking-wider";
        if (displayContainer) displayContainer.classList.add('hidden');
        if (btnConectar) btnConectar.classList.remove('hidden');
        if (descContainer) descContainer.classList.add('hidden');
    }
}

// 🔌 GERADOR DE QR CODE: Executa apenas quando o usuário clica no botão de conectar
export async function conectarWhatsAppReal() {
    const instancia = obterNomeInstancia();
    if (!instancia) return;

    const qrImg = document.getElementById('wa-qr-code');
    const displayContainer = document.getElementById('wa-display-container');
    const statusTxt = document.getElementById('wa-status');
    const btnConectar = document.getElementById('btn-conectar-wa');
    const descContainer = document.getElementById('wa-disconnect-container');

    try {
        if(window.showNotify) window.showNotify("Aguarde", "A comunicar com o servidor da API...", "info");
        btnConectar.disabled = true;
        btnConectar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

        let resState = await fetch(`${baseURL}/instance/connectionState/${instancia}`, {
            headers: { 'apikey': apiKey }
        });

        let qrCodeBase64 = null;

        if (resState.status === 404 || resState.status === 400) {
            // A instância não existe, criar e conectar
            let resCreate = await fetch(`${baseURL}/instance/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({ instanceName: instancia, integration: "WHATSAPP-BAILEYS", qrcode: true })
            });
            let dataCreate = await resCreate.json();
            qrCodeBase64 = dataCreate?.qrcode?.base64 || dataCreate?.base64;
            
            if(!qrCodeBase64) {
                 await new Promise(r => setTimeout(r, 2000));
                 const resConn = await fetch(`${baseURL}/instance/connect/${instancia}`, { headers: { 'apikey': apiKey } });
                 const dataConn = await resConn.json();
                 // Coleta o Base64 com suporte as novas versões da Evolution
                 qrCodeBase64 = dataConn?.qrcode?.base64 || dataConn?.base64 || dataConn?.instance?.qrcode?.base64;
            }
            
        } else {
            const dataState = await resState.json();
            const estadoAtual = dataState?.instance?.state || dataState?.state;

            if (estadoAtual === 'open') {
                checarStatusWhatsAppSilencioso();
                if(window.showNotify) window.showNotify("Conectado", "O WhatsApp já está ativo.", "success");
                return;
            }
            
            // Está fechada, conecta de novo
            const resConn = await fetch(`${baseURL}/instance/connect/${instancia}`, { headers: { 'apikey': apiKey } });
            const dataConn = await resConn.json();
            qrCodeBase64 = dataConn?.qrcode?.base64 || dataConn?.base64 || dataConn?.instance?.qrcode?.base64;
        }

        if (qrCodeBase64 && qrCodeBase64.includes("base64")) {
            qrImg.src = qrCodeBase64;
            if (displayContainer) displayContainer.classList.remove('hidden'); // Mostra a caixa do QR Code
            statusTxt.innerText = "ESCANEAR AGORA!";
            statusTxt.className = "text-amber-400 font-bold uppercase tracking-wider";
            if (btnConectar) btnConectar.classList.add('hidden');
            if (descContainer) descContainer.classList.add('hidden');
            
            // Iniciar o vigilante para ver se o usuário já bipou o celular
            verificarConexaoLoop(instancia);
        } else {
            throw new Error("Base64 não retornado pela API");
        }

    } catch (e) { 
        console.error("Erro API WA:", e); 
        if(window.showNotify) window.showNotify("Erro", "O Servidor recusou a criação ou está offline.", "error");
        checarStatusWhatsAppSilencioso();
    } finally {
        if (btnConectar) {
            btnConectar.disabled = false;
            btnConectar.innerHTML = '<i class="fas fa-qrcode"></i> Gerar QR Code';
        }
    }
}

// ♻️ LOOP PARA VERIFICAR SE O USUÁRIO JÁ LEU O QR CODE
async function verificarConexaoLoop(instancia) {
    if(connectionCheckInterval) clearInterval(connectionCheckInterval);
    
    connectionCheckInterval = setInterval(async () => {
        try {
            let resState = await fetch(`${baseURL}/instance/connectionState/${instancia}`, {
                headers: { 'apikey': apiKey }
            });
            if (resState.status === 200) {
                const dataState = await resState.json();
                const estadoAtual = dataState?.instance?.state || dataState?.state;

                if (estadoAtual === 'open') {
                    clearInterval(connectionCheckInterval); // Para de verificar
                    checarStatusWhatsAppSilencioso(); // Atualiza a tela
                    if(window.showNotify) window.showNotify("Sucesso", "WhatsApp autenticado e conectado!", "success");
                }
            }
        } catch(e) {
            console.error("Erro no polling de conexão", e);
        }
    }, 4000); // Verifica a cada 4 segundos
}

// 🔌 LOGOUT: Encerra a sessão
export async function desconectarWhatsAppReal() {
    const instancia = obterNomeInstancia();
    if (!instancia) return;

    if (!confirm("Tem certeza que deseja encerrar a conexão do WhatsApp no servidor?")) return;

    try {
        if (window.showNotify) window.showNotify("Aguarde", "A desconectar...", "info");

        const response = await fetch(`${baseURL}/instance/logout/${instancia}`, {
            method: 'DELETE',
            headers: { 'apikey': apiKey }
        });

        if (response.ok || response.status === 404) {
            if (window.showNotify) window.showNotify("Desconectado", "Sessão encerrada com sucesso.", "success");
            checarStatusWhatsAppSilencioso(); // Recarrega a tela para modo Desconectado
        } else {
            if (window.showNotify) window.showNotify("Erro", "Falha ao encerrar a sessão na API.", "error");
        }
    } catch (error) {
        console.error("Erro:", error);
    }
}