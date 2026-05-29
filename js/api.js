import { db } from "./database.js";
import { auth } from "./firebase-config.js";

const baseURL = "https://w3gestorapi.camdvr.org"; 
const apiKey = "Wesley123!";

let connectionCheckInterval; 

function obterNomeInstancia() {
    const usuarioLogado = auth.currentUser;
    if (!usuarioLogado) return null;
    return `user_${usuarioLogado.uid.toLowerCase()}`;
}

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
            
            // 🛡️ TÉCNICA ANTI-BAN: Delay Aleatório (entre 8 a 18 segundos)
            // Simula um humano a procurar o próximo contacto e a digitar
            const tempoEspera = Math.floor(Math.random() * (18000 - 8000 + 1)) + 8000;
            console.log(`Aguardando ${tempoEspera/1000}s para evitar bloqueio do WhatsApp...`);
            await new Promise(r => setTimeout(r, tempoEspera));
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
    msg = msg.replace(/{dns}/g, app.url || app.host || "N/A"); // <-- NOVA LINHA DO DNS
    msg = msg.replace(/{plano}/g, plano.nome || "");
    msg = msg.replace(/{valor}/g, plano.valor ? `R$ ${plano.valor.toFixed(2)}` : "0,00");

    const hoje = new Date();
    const venci = new Date(cli.vencimento);
    const diff = Math.ceil((venci - hoje) / (1000 * 60 * 60 * 24));
    msg = msg.replace(/{dias}/g, diff);

    // 🎲 PROCESSADOR DE SPINTAX
    if (db.config.usar_spintax) {
        msg = msg.replace(/\{([^{}]+)\}/g, function(match, contents) {
            // ADICIONADOS 'dns' e 'plano' AQUI NA LISTA:
            if (['cliente', 'app', 'vencimento', 'valor', 'dias', 'usuario', 'senha', 'dns', 'plano'].includes(contents.toLowerCase().trim())) return match;
            const parts = contents.split('|');
            return parts[Math.floor(Math.random() * parts.length)];
        });
    }

    await sendCustomWA(cli.whatsapp, msg, cli.nome);
}

// ==========================================
// A MÁGICA DO ENVIO CORRIGIDA AQUI
// ==========================================
export async function sendCustomWA(telefone, msg, nomeCliente = "Cliente") {
    if (!msg || msg.trim() === "") return;

    let fone = telefone.replace(/\D/g, '');
    if (!fone.startsWith('55')) fone = '55' + fone; 

    const instancia = obterNomeInstancia();
    if (!instancia) return;

    try {
        if(window.showNotify) window.showNotify("Enviando...", `A disparar para ${nomeCliente}`, "info");

        // Payload da v2.0 usando options corretamente no JSON
        const response = await fetch(`${baseURL}/message/sendText/${instancia}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'apikey': apiKey
            },
            body: JSON.stringify({
                number: fone,
                text: msg,
                options: {
                    delay: 1200,
                    presence: "composing"
                }
            })
        });

        if (response.ok) {
            if(window.showNotify) window.showNotify("Sucesso!", `Mensagem entregue.`, "success");
        } else {
            console.error("A API da Evolution recusou o envio. Status:", response.status);
            if(window.showNotify) window.showNotify("Erro", "O WhatsApp recusou o envio.", "error");
        }
    } catch (error) {
        console.error("Erro na requisição Fetch:", error);
    }
}
// ==========================================

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
                
                if (displayContainer) displayContainer.classList.add('hidden');
                if (btnConectar) btnConectar.classList.add('hidden');
                if (descContainer) descContainer.classList.remove('hidden');
                return;
            }
        }

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
            // CRIAR INSTÂNCIA COM READ MESSAGES DESATIVADO
            let resCreate = await fetch(`${baseURL}/instance/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({ 
                    instanceName: instancia, 
                    integration: "WHATSAPP-BAILEYS", 
                    qrcode: true,
                    alwaysOnline: true,
                    readMessages: false, // Alterado para false
                    readStatus: true,
                    syncFullHistory: true 
                })
            });
            let dataCreate = await resCreate.json();
            qrCodeBase64 = dataCreate?.qrcode?.base64 || dataCreate?.base64;
            
            if(!qrCodeBase64) {
                 await new Promise(r => setTimeout(r, 2000));
                 const resConn = await fetch(`${baseURL}/instance/connect/${instancia}`, { headers: { 'apikey': apiKey } });
                 const dataConn = await resConn.json();
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
            
            const resConn = await fetch(`${baseURL}/instance/connect/${instancia}`, { headers: { 'apikey': apiKey } });
            const dataConn = await resConn.json();
            qrCodeBase64 = dataConn?.qrcode?.base64 || dataConn?.base64 || dataConn?.instance?.qrcode?.base64;
        }

        if (qrCodeBase64 && qrCodeBase64.includes("base64")) {
            qrImg.src = qrCodeBase64;
            if (displayContainer) displayContainer.classList.remove('hidden'); 
            statusTxt.innerText = "ESCANEAR AGORA!";
            statusTxt.className = "text-amber-400 font-bold uppercase tracking-wider";
            if (btnConectar) btnConectar.classList.add('hidden');
            if (descContainer) descContainer.classList.add('hidden');
            
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
                    clearInterval(connectionCheckInterval); 
                    checarStatusWhatsAppSilencioso(); 
                    if(window.showNotify) window.showNotify("Sucesso", "WhatsApp autenticado e conectado!", "success");
                }
            }
        } catch(e) {
            console.error("Erro no polling de conexão", e);
        }
    }, 4000);
}

export async function desconectarWhatsAppReal() {
    const instancia = obterNomeInstancia();
    if (!instancia) return;

    if (!confirm("Tem certeza que deseja encerrar a conexão e DELETAR a instância do servidor para limpar erros?")) return;

    try {
        if (window.showNotify) window.showNotify("Aguarde", "A desconectar e limpar dados...", "info");

        const response = await fetch(`${baseURL}/instance/delete/${instancia}`, {
            method: 'DELETE',
            headers: { 'apikey': apiKey }
        });

        if (response.ok || response.status === 404) {
            if (window.showNotify) window.showNotify("Desconectado", "Instância limpa com sucesso. Gere um novo QR Code.", "success");
            checarStatusWhatsAppSilencioso(); 
        } else {
            await fetch(`${baseURL}/instance/logout/${instancia}`, {
                method: 'DELETE',
                headers: { 'apikey': apiKey }
            });
            checarStatusWhatsAppSilencioso(); 
        }
    } catch (error) {
        console.error("Erro:", error);
    }
}

export async function carregarStatusWhatsApp() {
    const instancia = obterNomeInstancia();
    if (!instancia) return;

    const waStatus = document.getElementById('wa-status');

    try {
        let resState = await fetch(`${baseURL}/instance/connectionState/${instancia}`, {
            headers: { 'apikey': apiKey }
        });

        if (resState.status === 200) {
            const dataState = await resState.json();
            const estadoAtual = dataState?.instance?.state || dataState?.state;

            if (estadoAtual === 'open') {
                if (waStatus) {
                    waStatus.innerText = "WHATSAPP CONECTADO!";
                    waStatus.classList.remove("text-red-500", "text-yellow-500");
                    waStatus.classList.add("text-green-500");
                }
                
                const qrImg = document.getElementById('wa-qr-code');
                if(qrImg) qrImg.src = ""; 

                if (!document.getElementById('btn-desconectar-wa')) {
                    const btnDesc = document.createElement('button');
                    btnDesc.id = 'btn-desconectar-wa';
                    btnDesc.innerText = "Desconectar WhatsApp";
                    btnDesc.className = "mt-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition duration-200 block mx-auto text-sm shadow";
                    btnDesc.onclick = () => desconectarWhatsAppReal();
                    if (waStatus) waStatus.after(btnDesc);
                }
            }
        }
    } catch (e) {
        console.error("Erro ao verificar sessão do WhatsApp:", e);
    }
}

export async function conectarWhatsAppPorCodigo() {
    const instancia = obterNomeInstancia();
    if (!instancia) return;

    const inputNumero = document.getElementById('wa-numero-emparelhar');
    let numero = inputNumero ? inputNumero.value.replace(/\D/g, '') : null;

    if (!numero || numero.length < 10) {
        if(window.showNotify) window.showNotify("Erro", "Digite o DDD e o número completo.", "warning");
        return;
    }
    if (!numero.startsWith('55')) numero = '55' + numero;

    const waStatus = document.getElementById('wa-status');
    const displayCodigo = document.getElementById('wa-codigo-tela');
    const btnGerar = document.getElementById('btn-gerar-codigo-wa');

    if (btnGerar) {
        btnGerar.disabled = true;
        btnGerar.innerText = "Aguarde...";
    }

    try {
        if(window.showNotify) window.showNotify("Aguarde", "A preparar o servidor...", "info");
        if(waStatus) waStatus.innerText = "A LIMPAR SESSÃO ANTIGA...";
        if(displayCodigo) displayCodigo.innerText = "";

        await fetch(`${baseURL}/instance/delete/${instancia}`, { method: 'DELETE', headers: { 'apikey': apiKey } });
        await new Promise(r => setTimeout(r, 2000));

        if(waStatus) waStatus.innerText = "A CRIAR INSTÂNCIA MOBILE...";

        await fetch(`${baseURL}/instance/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({ 
                instanceName: instancia, 
                integration: "WHATSAPP-BAILEYS", 
                qrcode: false, 
                number: numero
            })
        });

        // SETAR CONFIGURAÇÕES COM READ MESSAGES DESATIVADO
        await fetch(`${baseURL}/settings/set/${instancia}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({ alwaysOnline: true, readMessages: false, syncFullHistory: true }) // Alterado para false
        });

        await new Promise(r => setTimeout(r, 2000));

        if(waStatus) waStatus.innerText = "A GERAR CÓDIGO DE 8 DÍGITOS...";
        
        const resConn = await fetch(`${baseURL}/instance/connect/${instancia}?number=${numero}`, {
            method: 'GET',
            headers: { 'apikey': apiKey }
        });

        const dataConn = await resConn.json();
        
        let jsonString = JSON.stringify(dataConn);
        let codigoReal = null;
        
        const match = jsonString.match(/"code":"([A-Z0-9]{4}-?[A-Z0-9]{4})"/i) || jsonString.match(/"pairingCode":"([A-Z0-9]{4}-?[A-Z0-9]{4})"/i);
        
        if (match && match[1]) {
            codigoReal = match[1];
        } else {
            const possivelCodigo = dataConn?.code || dataConn?.pairingCode || dataConn?.instance?.code || dataConn?.instance?.pairingCode;
            if (possivelCodigo && String(possivelCodigo).length <= 9) {
                codigoReal = String(possivelCodigo);
            }
        }

        if (codigoReal) {
            const formatado = codigoReal.replace(/-/g, '').match(/.{1,4}/g).join('-');
            
            if(displayCodigo) {
                displayCodigo.innerText = formatado;
                displayCodigo.className = "text-4xl font-mono font-black text-amber-400 tracking-[0.2em] mt-4 mb-4 block word-break break-all"; 
            }
            if(waStatus) waStatus.innerText = "DIGITE ESTE CÓDIGO NO SEU WHATSAPP!";
            if(window.showNotify) window.showNotify("Código Gerado!", "Tem 45 segundos para inserir o código.", "success");
            
            setTimeout(async () => {
                try {
                    let check = await fetch(`${baseURL}/instance/connectionState/${instancia}`, { headers: { 'apikey': apiKey } });
                    let checkData = await check.json();
                    let estado = checkData?.instance?.state || checkData?.state;
                    
                    if (estado !== 'open') {
                        await fetch(`${baseURL}/instance/delete/${instancia}`, { method: 'DELETE', headers: { 'apikey': apiKey } });
                        if(waStatus) waStatus.innerText = "TEMPO ESGOTADO. GERE NOVAMENTE.";
                        if(displayCodigo) displayCodigo.innerText = "EXPIRADO";
                        if(window.showNotify) window.showNotify("Cancelado", "O tempo limite esgotou. A conexão foi abortada para segurança.", "warning");
                    }
                } catch(err) { console.log(err); }
            }, 45000); 
            
            if (typeof verificarConexaoLoop === 'function') verificarConexaoLoop(instancia);

        } else {
            throw new Error("O servidor retornou lixo em vez do código de 8 dígitos.");
        }
    } catch (e) {
        console.error("Erro Pairing Code:", e);
        if(waStatus) waStatus.innerText = "FALHA AO GERAR CÓDIGO";
        if(window.showNotify) window.showNotify("Erro", "O WhatsApp não enviou o código. Verifique o número e tente novamente.", "error");
    } finally {
        if (btnGerar) {
            btnGerar.disabled = false;
            btnGerar.innerText = "Gerar Código";
        }
    }
}
