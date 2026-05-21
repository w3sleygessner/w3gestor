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
    return `user_${usuarioLogado.uid.toLowerCase()}`;
}

// 🤖 AUTOMAÇÃO: Régua de Cobrança Automática (Executa 1x por dia ao abrir o painel)
export async function verificarReguaDeCobranca() {
    const instancia = obterNomeInstancia();
    if (!instancia) return;

    // Evita disparos duplicados no mesmo dia caso dê F5 no painel
    const hojeStr = new Date().toISOString().split('T')[0];
    if (localStorage.getItem(`regua_executada_${hojeStr}`) === 'true') {
        console.log("🤖 Régua de cobrança já foi executada hoje.");
        return;
    }

    if (!db.clientes || !db.config) return;

    // Pega os dias configurados na sua régua (ex: 3 dias antes). Padrão é 3 se estiver vazio.
    const diasRegua = parseInt(db.config.dias_aviso) || 3; 

    if (window.showNotify) window.showNotify("Régua Ativa", "A verificar vencimentos automáticos...", "info");

    let disparosRealizados = 0;

    for (const cli of db.clientes) {
        if (!cli.vencimento || cli.status === 'inativo') continue;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        const vencimento = new Date(cli.vencimento);
        vencimento.setHours(0, 0, 0, 0);

        // Calcula a diferença exata de dias
        const diffTime = vencimento - hoje;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Se o cliente estiver exatamente no dia da régua (ex: 3 dias para vencer)
        if (diffDays === diasRegua) {
            await sendManualWA(cli.id, 'renovacao');
            disparosRealizados++;
            // Delay de 2 segundos entre clientes para evitar bloqueios no WhatsApp
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    // Salva que já rodou hoje com sucesso
    localStorage.setItem(`regua_executada_${hojeStr}`, 'true');

    if (disparosRealizados > 0 && window.showNotify) {
        window.showNotify("Sucesso", `${disparosRealizados} avisos automáticos enviados!`, "success");
    }
}

export async function sendManualWA(cliId, type) {
    const cli = db.clientes.find(c => c.id == cliId);
    if (!cli) return;

    const app = db.apps.find(a => a.id == cli.app_id) || {};
    const plano = db.planos.find(p => p.id == cli.plano_id) || {};

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

export async function sendCustomWA(telefone, msg, nomeCliente = "Cliente") {
    if (!msg || msg.trim() === "") {
        if(window.showNotify) window.showNotify("Erro", "A mensagem está vazia.", "error");
        return;
    }

    let fone = telefone.replace(/\D/g, '');
    if (!fone.startsWith('55')) fone = '55' + fone; 

    const instancia = obterNomeInstancia();
    if (!instancia) {
        if(window.showNotify) window.showNotify("Erro", "Aguarde o sistema carregar.", "error");
        return;
    }

    try {
        if(window.showNotify) window.showNotify("Enviando...", `Processando envio para ${nomeCliente}`, "info");

        const payload = {
            number: fone,
            text: msg
        };

        const response = await fetch(`${baseURL}/message/sendText/${instancia}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'apikey': apiKey,
                'ngrok-skip-browser-warning': 'true' 
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            console.log("Sucesso API:", data);
            if(window.showNotify) window.showNotify("Sucesso!", `Mensagem entregue no WhatsApp.`, "success");
        } else {
            const erroDetalhado = await response.text();
            console.error("Erro da API:", erroDetalhado);
            if(window.showNotify) window.showNotify("Erro de Envio", "O WhatsApp recusou o número ou a API falhou.", "error");
        }

    } catch (error) {
        console.error("Erro de Rede:", error);
        if(window.showNotify) window.showNotify("Erro", "Falha de comunicação com o servidor.", "error");
    }
}

// 🔌 DESCONEXÃO: Encerra a sessão do WhatsApp no servidor
export async function desconectarWhatsAppReal() {
    const instancia = obterNomeInstancia();
    if (!instancia) return;

    if (!confirm("Tem a certeza que deseja desconectar o WhatsApp do painel?")) return;

    try {
        if (window.showNotify) window.showNotify("A desconectar", "A encerrar sessão no servidor...", "info");

        const response = await fetch(`${baseURL}/instance/logout/${instancia}`, {
            method: 'POST',
            headers: { 'apikey': apiKey }
        });

        if (response.ok) {
            if (window.showNotify) window.showNotify("Desconectado", "WhatsApp desconectado com sucesso.", "success");
            
            // Reseta a interface gráfica
            document.getElementById('wa-status').innerText = "DESCONECTADO";
            document.getElementById('wa-status').classList.remove("text-green-500", "text-yellow-500");
            document.getElementById('wa-status').classList.add("text-red-500");
            document.getElementById('wa-qr-code').src = ""; 

            // Remove o botão de desconectar da tela
            const btnExistente = document.getElementById('btn-desconectar-wa');
            if (btnExistente) btnExistente.remove();
        } else {
            if (window.showNotify) window.showNotify("Erro", "Não foi possível desconectar a instância.", "error");
        }
    } catch (error) {
        console.error("Erro ao desconectar:", error);
        if (window.showNotify) window.showNotify("Erro", "Falha de rede ao tentar desconectar.", "error");
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

        let resState = await fetch(`${baseURL}/instance/connectionState/${instancia}`, {
            headers: { 'apikey': apiKey }
        });

        let qrCodeBase64 = null;

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
            
            await new Promise(r => setTimeout(r, 3000));
            
            const resConn = await fetch(`${baseURL}/instance/connect/${instancia}`, { headers: { 'apikey': apiKey } });
            const dataConn = await resConn.json();
            qrCodeBase64 = dataConn?.qrcode?.base64 || dataConn?.base64;
            
        } else {
            const dataState = await resState.json();
            const estadoAtual = dataState?.instance?.state || dataState?.state;

            // CASO CONECTADO: Configura o estado visual e injeta o botão Desconectar
            if (estadoAtual === 'open') {
                document.getElementById('wa-status').innerText = "WHATSAPP CONECTADO!";
                document.getElementById('wa-status').classList.remove("text-red-500", "text-yellow-500");
                document.getElementById('wa-status').classList.add("text-green-500");
                document.getElementById('wa-qr-code').src = ""; // Oculta o QR code antigo

                // Cria o botão de desconectar dinamicamente se ele ainda não existir na tela
                if (!document.getElementById('btn-desconectar-wa')) {
                    const btnDesc = document.createElement('button');
                    btnDesc.id = 'btn-desconectar-wa';
                    btnDesc.innerText = "Desconectar WhatsApp";
                    btnDesc.className = "mt-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition duration-200 block mx-auto text-sm shadow";
                    btnDesc.onclick = () => desconectarWhatsAppReal();
                    document.getElementById('wa-status').after(btnDesc);
                }

                if(window.showNotify) window.showNotify("Sucesso", "O WhatsApp já está conectado!", "success");
                return;
            }
            
            // Se cair aqui, a instância existe mas não está conectada (precisa de novo QR)
            const btnExistente = document.getElementById('btn-desconectar-wa');
            if (btnExistente) btnExistente.remove();

            if(window.showNotify) window.showNotify("QR Code", "A gerar nova imagem de segurança...", "info");
            const resConn = await fetch(`${baseURL}/instance/connect/${instancia}`, { headers: { 'apikey': apiKey } });
            const dataConn = await resConn.json();
            qrCodeBase64 = dataConn?.qrcode?.base64 || dataConn?.base64;
        }

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