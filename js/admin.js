import { firebaseConfig, db_firebase } from "./firebase-config.js";
import { ref, get, update, set, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, inMemoryPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showNotify, closeModal, openModal } from "./ui.js";

const adminApp = getApps().find(app => app.name === "AdminApp") || initializeApp(firebaseConfig, "AdminApp");
const adminAuth = getAuth(adminApp);
setPersistence(adminAuth, inMemoryPersistence).catch(console.error);

const defaultAuth = getAuth();
const MEU_EMAIL_ADMIN = "w3sleygessner@gmail.com";

onAuthStateChanged(defaultAuth, async (user) => {
    if (!user) return;

    const isAdmin = user.email === MEU_EMAIL_ADMIN;
    const snapMe = await get(ref(db_firebase, `usuarios/${user.uid}/account/type`));
    const isRevenda = snapMe.val() === "revenda";

    const navAdmin = document.getElementById("nav-admin");
    const navRevendedores = document.getElementById("nav-revendedores");
    const saldoContainer = document.getElementById("saldo-revenda-container");

    if (isAdmin) {
        if (navAdmin) navAdmin.classList.remove("hidden");
        if (navRevendedores) navRevendedores.classList.remove("hidden");
        if (saldoContainer) saldoContainer.classList.add("hidden");
    } else if (isRevenda) {
        if (navAdmin) navAdmin.classList.remove("hidden");
        if (navRevendedores) navRevendedores.classList.add("hidden");
        if (saldoContainer) {
            saldoContainer.classList.remove("hidden");
            onValue(ref(db_firebase, `usuarios/${user.uid}/creditos`), (snap) => {
                const el = document.getElementById("saldo-revenda-valor");
                if (el) el.innerText = parseInt(snap.val()) || 0;
            });
        }
    } else {
        if (navAdmin) navAdmin.classList.add("hidden");
        if (navRevendedores) navRevendedores.classList.add("hidden");
        if (saldoContainer) saldoContainer.classList.add("hidden");
    }

    if (typeof window.carregarAssinantes === "function") {
        window.carregarAssinantes();
    }
    if (isAdmin && typeof window.carregarRevendedores === "function") {
        window.carregarRevendedores();
    }
});

window.carregarAssinantes = async function () {
    const user = defaultAuth.currentUser;
    if (!user) return;

    const isAdmin = user.email === MEU_EMAIL_ADMIN;
    const snapMe = await get(ref(db_firebase, `usuarios/${user.uid}/account/type`));
    const isRevenda = snapMe.val() === "revenda";

    const body = document.getElementById("table-admin-body");
    if (!body) return;

    body.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Carregando usuários...</td></tr>';

    try {
        const snapshot = await get(ref(db_firebase, "usuarios"));
        const usuarios = snapshot.val();

        if (!usuarios) {
            body.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Nenhum usuário encontrado.</td></tr>';
            return;
        }

        body.innerHTML = "";
        let temUsuarios = false;
        let qtdVip = 0, qtdFree = 0, qtdTotal = 0;

        for (const [uid, dados] of Object.entries(usuarios)) {
            if (!dados || typeof dados !== 'object') continue;

            const acc = dados.account || {};
            const tipoConta = acc.type || "free";
            const createdBy = dados.createdBy || null;

            if (tipoConta === "revenda") continue;
            if (isRevenda && createdBy !== user.uid) continue;

            temUsuarios = true;
            qtdTotal++;
            if (tipoConta === 'vip') qtdVip++;
            if (tipoConta === 'free') qtdFree++;

            const email = dados.email || (dados.account ? dados.account.email : uid);
            const vencimento = acc.expiresAt > 0 ? new Date(acc.expiresAt).toLocaleDateString() : "Sem data";
            let statusText = tipoConta;
            let statusColor = tipoConta === "vip" ? "text-green-500" : "text-yellow-500";
            let vencimentoText = vencimento;

            if (email === MEU_EMAIL_ADMIN) {
                statusText = "ADMIN";
                statusColor = "text-blue-500";
                vencimentoText = "Vitalício";
            }

            const btnExcluir = email !== MEU_EMAIL_ADMIN 
                ? `<button onclick="window.deletarUsuarioAdmin('${uid}')" title="Apagar Cliente" class="px-3 py-1.5 bg-red-600/20 text-red-500 rounded text-[10px] font-black hover:bg-red-600 hover:text-white transition"><i class="fas fa-trash"></i></button>`
                : "";

            const btnEditarVenc = isAdmin 
                ? `<button onclick="window.editarDiasVIP('${uid}', ${acc.expiresAt || 0})" class="text-blue-400 hover:text-white transition"><i class="fas fa-edit"></i> Editar Venc.</button>`
                : `<span class="text-gray-500 text-[9px] uppercase"><i class="fas fa-lock text-gray-600"></i> Protegido</span>`;

            body.innerHTML += `
            <tr class="border-t border-gray-800/50 hover:bg-white/5 transition text-xs text-white">
                <td class="p-3 font-bold font-mono">${email}</td>
                <td class="p-3 font-bold uppercase ${statusColor}">${statusText}</td>
                <td class="p-3 text-center font-bold text-gray-400">${vencimentoText}</td>
                <td class="p-3 text-center">${btnEditarVenc}</td>
                <td class="p-3 text-right space-x-2 whitespace-nowrap">
                    <button onclick="window.darVIP('${uid}')" title="Adicionar 30 Dias" class="px-3 py-1.5 bg-purple-600 rounded text-[9px] font-black text-white hover:bg-purple-700 shadow-lg">+ 30 DIAS (VIP)</button>
                    ${btnExcluir}
                </td>
            </tr>`;
        }
        
        if (!temUsuarios) {
            body.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500 italic">Nenhum cliente VIP encontrado.</td></tr>';
        }

        if(document.getElementById('dash-admin-total')) document.getElementById('dash-admin-total').innerText = qtdTotal;
        if(document.getElementById('dash-admin-vip')) document.getElementById('dash-admin-vip').innerText = qtdVip;
        if(document.getElementById('dash-admin-free')) document.getElementById('dash-admin-free').innerText = qtdFree;

    } catch (e) {
        console.error(e);
        body.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500 font-bold">🚨 Erro de permissão no Firebase</td></tr>`;
    }
}

window.carregarRevendedores = async function () {
    const body = document.getElementById("table-revendedores-body");
    if (!body) return;

    body.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Carregando revendedores...</td></tr>';

    try {
        const snapshot = await get(ref(db_firebase, "usuarios"));
        const usuarios = snapshot.val();

        if (!usuarios) {
            body.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500 italic">Nenhum parceiro encontrado.</td></tr>';
            return;
        }

        body.innerHTML = "";
        let encontrouRevenda = false;
        let qtdRev = 0, totalCreditos = 0;

        for (const [uid, dados] of Object.entries(usuarios)) {
            const acc = dados?.account || {};

            if (acc.type === "revenda") {
                encontrouRevenda = true;
                const email = dados.email || uid;
                const creditos = parseInt(dados.creditos) || 0;
                
                qtdRev++;
                totalCreditos += creditos;

                body.innerHTML += `
                <tr class="border-t border-gray-800/50 hover:bg-white/5 transition text-xs text-white">
                    <td class="p-3 font-bold font-mono">${email}</td>
                    <td class="p-3 text-center font-black text-green-400 text-lg">${creditos}</td>
                    <td class="p-3 text-center text-[10px] font-bold uppercase text-blue-500">REVENDA ATIVA</td>
                    <td class="p-3 text-right space-x-2 whitespace-nowrap">
                        <button onclick="window.abrirModalRecarga('${uid}', '${email}')" title="Recarregar" class="px-3 py-1.5 bg-green-600 rounded text-[9px] font-black text-white hover:bg-green-700 shadow-lg"><i class="fas fa-coins mr-1"></i> Créditos</button>
                        <button onclick="window.deletarUsuarioAdmin('${uid}')" title="Apagar Revenda" class="px-3 py-1.5 bg-red-600/20 text-red-500 rounded text-[10px] font-black hover:bg-red-600 hover:text-white transition"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            }
        }

        if (!encontrouRevenda) {
            body.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500 italic">Nenhum revendedor cadastrado.</td></tr>';
        }

        if(document.getElementById('dash-rev-total')) document.getElementById('dash-rev-total').innerText = qtdRev;
        if(document.getElementById('dash-rev-creditos')) document.getElementById('dash-rev-creditos').innerText = totalCreditos;

    } catch (e) {
        console.error(e);
        body.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500 font-bold">Erro: ${e.message}</td></tr>`;
    }
}

window.criarUsuarioAdmin = async function (event) {
    event.preventDefault();
    const email = document.getElementById("admin_new_email").value;
    const pass = Math.random().toString(36).slice(-8);
    const dias = parseInt(document.getElementById("admin_new_dias").value) || 7;
    const user = defaultAuth.currentUser;

    if (!user) return;
    const criadorUID = user.uid;
    const snapMe = await get(ref(db_firebase, `usuarios/${criadorUID}/account/type`));
    const isRevenda = snapMe.val() === "revenda";

    let creditosAtuais = 0;

    if (isRevenda && dias > 7) {
        const credRef = ref(db_firebase, `usuarios/${criadorUID}/creditos`);
        const snapCred = await get(credRef);
        creditosAtuais = parseInt(snapCred.val()) || 0;

        if (creditosAtuais <= 0) {
            showNotify("Erro", "Sem créditos disponíveis!", "error");
            return;
        }
    }

    try {
        const userCred = await createUserWithEmailAndPassword(adminAuth, email, pass);
        await signOut(adminAuth);

        if (isRevenda && dias > 7) {
            await update(ref(db_firebase, `usuarios/${criadorUID}`), { creditos: creditosAtuais - 1 });
        }

        const tipoConta = dias > 7 ? "vip" : "free";

        const estruturaPadrao = {
            email: email,
            createdBy: criadorUID,
            clientes: [],
            planos: [ { id: 1, nome: "Mensal Gold", valor: 30, custo: 7, dias: 30 } ],
            apps: [ { id: 101, nome: "XCIPTV", url: "http://adonay.top", pin: "0000" } ],
            faturas: [],
            invoices_pending: [],
            config: {
                aviso_dias: 3,
                msg_boas_vindas: "Olá {cliente}, seu acesso ao app {app} está ativo até {vencimento}.",
                msg_renovacao: "Olá {cliente}, seu plano {plano} vence em {vencimento}. Vamos renovar?",
                msg_sucesso: "Obrigado pelo pagamento, {cliente}!",
                msg_suspensa: "Olá {cliente}, seu acesso venceu em {vencimento}."
            },
            account: {
                type: tipoConta,
                expiresAt: Date.now() + (dias * 86400000),
                forcePasswordChange: true
            }
        };

        await update(ref(db_firebase, "usuarios/" + userCred.user.uid), estruturaPadrao);

        document.getElementById("display_new_email").innerText = email;
        document.getElementById("display_new_pass").innerText = pass;
        document.getElementById("display_hidden_text").value = `Usuário: ${email}\nSenha: ${pass}`;

        closeModal("modalCriarUsuario");
        openModal("modalUsuarioCriado");

        if (window.carregarAssinantes) window.carregarAssinantes();

    } catch (e) {
        console.error(e);
        showNotify("Erro", e.message, "error");
    }
}

window.criarRevendedorAdmin = async function (event) {
    event.preventDefault();
    const email = document.getElementById("revenda_new_email").value;
    const creditos = parseInt(document.getElementById("revenda_selected_creditos").value) || 5;
    const pass = Math.random().toString(36).slice(-8);
    const adminUser = defaultAuth.currentUser;

    if (!adminUser) return;
    const adminUID = adminUser.uid;

    try {
        const userCred = await createUserWithEmailAndPassword(adminAuth, email, pass);
        await signOut(adminAuth);

        const estruturaPadrao = {
            email: email,
            createdBy: adminUID,
            creditos: Number(creditos),
            clientes: [],
            planos: [ { id: 1, nome: "Mensal Gold", valor: 30, custo: 7, dias: 30 } ],
            apps: [ { id: 101, nome: "XCIPTV", url: "http://adonay.top", pin: "0000" } ],
            faturas: [], invoices_pending: [], config: { aviso_dias: 3 },
            account: {
                type: "revenda",
                expiresAt: Date.now() + (7 * 86400000),
                forcePasswordChange: true
            }
        };

        await update(ref(db_firebase, "usuarios/" + userCred.user.uid), estruturaPadrao);

        document.getElementById("display_new_email").innerText = email;
        document.getElementById("display_new_pass").innerText = pass;
        document.getElementById("display_hidden_text").value = `Usuário: ${email}\nSenha: ${pass}\nCréditos Iniciais: ${creditos}`;

        closeModal("modalCriarRevendedor");
        openModal("modalUsuarioCriado");

        if (window.carregarRevendedores) window.carregarRevendedores();

    } catch (e) {
        console.error(e);
        showNotify("Erro", e.message, "error");
    }
}

window.darVIP = async function (uid) {
    const user = defaultAuth.currentUser;
    if (!user) return;

    const snapMe = await get(ref(db_firebase, `usuarios/${user.uid}/account/type`));
    const isRevenda = snapMe.val() === "revenda";

    Swal.fire({
        title: "Liberar +30 Dias VIP?",
        text: isRevenda ? "Isso vai descontar 1 crédito." : "Deseja continuar?",
        icon: "question", showCancelButton: true, confirmButtonColor: "#9333ea",
        cancelButtonColor: "#374151", confirmButtonText: "Sim", cancelButtonText: "Cancelar",
        background: "#16162d", color: "#ffffff"
    }).then(async (result) => {
        if (!result.isConfirmed) return;

        try {
            if (isRevenda) {
                const snapCred = await get(ref(db_firebase, `usuarios/${user.uid}/creditos`));
                let creds = parseInt(snapCred.val()) || 0;
                if (creds <= 0) {
                    showNotify("Erro", "Sem créditos!", "error"); return;
                }
                await update(ref(db_firebase, `usuarios/${user.uid}`), { creditos: creds - 1 });
            }

            const snapTarget = await get(ref(db_firebase, `usuarios/${uid}/account/expiresAt`));
            let currentExp = snapTarget.val() || Date.now();
            let baseDate = currentExp > Date.now() ? currentExp : Date.now();

            await update(ref(db_firebase, `usuarios/${uid}/account`), {
                type: "vip",
                expiresAt: baseDate + 30 * 86400000
            });

            showNotify("Sucesso", "Conta renovada!", "success");
            if (window.carregarAssinantes) window.carregarAssinantes();

        } catch (e) {
            console.error(e);
            showNotify("Erro", e.message, "error");
        }
    });
}

window.abrirModalRecarga = function (uid, email) {
    document.getElementById("recarga_revenda_id").value = uid;
    document.getElementById("nome_revenda_recarga").innerText = email;
    document.getElementById("recarga_qtd_creditos").value = "";
    openModal("modalAddCredito");
}

window.confirmarRecargaRevenda = async function () {
    const uid = document.getElementById("recarga_revenda_id").value;
    const qtd = parseInt(document.getElementById("recarga_qtd_creditos").value);
    if (!uid || !qtd || qtd <= 0) return;

    try {
        const snap = await get(ref(db_firebase, `usuarios/${uid}/creditos`));
        const atual = parseInt(snap.val()) || 0;
        await update(ref(db_firebase, `usuarios/${uid}`), { creditos: atual + qtd });
        showNotify("Sucesso!", `${qtd} créditos adicionados.`, "success");
        closeModal("modalAddCredito");
        if (window.carregarRevendedores) window.carregarRevendedores();
    } catch (e) {
        console.error(e);
        showNotify("Erro", e.message, "error");
    }
}

window.editarDiasVIP = function (uid, currentExpiresAt) {
    Swal.fire({
        title: "⚙️ Ajustar Dias VIP", input: "number", inputValue: "30",
        showCancelButton: true, confirmButtonColor: "#3b82f6", background: "#16162d", color: "#ffffff"
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            let baseDate = currentExpiresAt > Date.now() ? currentExpiresAt : Date.now();
            update(ref(db_firebase, `usuarios/${uid}/account`), {
                type: "vip",
                expiresAt: baseDate + parseInt(result.value) * 86400000
            }).then(() => {
                showNotify("Atualizado", "Dias alterados!", "success");
                if (window.carregarAssinantes) window.carregarAssinantes();
            });
        }
    });
}

window.deletarUsuarioAdmin = function (uid) {
    Swal.fire({
        title: "🚨 ATENÇÃO!", text: "Deseja apagar totalmente?", icon: "warning",
        showCancelButton: true, confirmButtonColor: "#dc2626", background: "#16162d", color: "#ffffff"
    }).then((result) => {
        if (result.isConfirmed) {
            remove(ref(db_firebase, "usuarios/" + uid)).then(() => {
                showNotify("Excluído", "Apagado!", "success");
                if (window.carregarAssinantes) window.carregarAssinantes();
                if (window.carregarRevendedores) window.carregarRevendedores();
            });
        }
    });
}

window.copiarDadosContaCriada = function () {
    const txt = document.getElementById("display_hidden_text").value;
    navigator.clipboard.writeText(txt).then(() => showNotify("Copiado", "Dados copiados!", "success"));
}