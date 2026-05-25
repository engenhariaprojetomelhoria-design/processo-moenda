import { protegerPagina } from "./layout.js";
import {
  db,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "./firebase.js";

await protegerPagina("ferramentas");

const idEl = document.getElementById("ferramentaId");
const nomeEl = document.getElementById("nome");
const diametroEl = document.getElementById("diametro");
const xdEl = document.getElementById("xd");
const comprimentoEl = document.getElementById("comprimento");
const fabricanteEl = document.getElementById("fabricante");
const ativaEl = document.getElementById("ativa");
const obsEl = document.getElementById("observacoes");
const msgEl = document.getElementById("msg");
const listaEl = document.getElementById("listaFerramentas");
const tituloEl = document.getElementById("formTitulo");

document.getElementById("salvarBtn").addEventListener("click", salvarFerramenta);
document.getElementById("limparBtn").addEventListener("click", () => limparFormulario());

criarPainelReversoes();

function atualizarNomeAutomatico() {
  const fabricante = fabricanteEl.value.trim();
  const diametro = diametroEl.value.trim();
  const xd = xdEl.value.trim();

  if (!fabricante || !diametro || !xd) return;

  nomeEl.value = `${fabricante} ${diametro} — ${xd}`;
}

fabricanteEl.addEventListener("input", atualizarNomeAutomatico);
diametroEl.addEventListener("input", atualizarNomeAutomatico);
xdEl.addEventListener("input", atualizarNomeAutomatico);

async function salvarFerramenta() {
  atualizarNomeAutomatico();
  const nome = nomeEl.value.trim();
  const diametro = Number(diametroEl.value);
  const xd = xdEl.value.trim();
  const comprimento = Number(comprimentoEl.value);
  const fabricante = fabricanteEl.value.trim();
  const observacoes = obsEl.value.trim();
  const ativa = ativaEl.value === "true";

  if (!nome) {
    msgEl.innerHTML = '<div class="alert">Informe o nome da ferramenta.</div>';
    return;
  }

  if (!diametro || diametro <= 0) {
    msgEl.innerHTML = '<div class="alert">Informe o diâmetro da broca.</div>';
    return;
  }

  if (!comprimento || comprimento <= 0) {
    msgEl.innerHTML = '<div class="alert">Informe o comprimento útil/configurado.</div>';
    return;
  }

  if (!fabricante) {
    msgEl.innerHTML = '<div class="alert">Informe o fabricante da ferramenta.</div>';
    return;
  }

  const dados = {
    nome,
    diametro,
    xd,
    comprimento,
    fabricante,
    observacoes,
    ativa,
    atualizadoEm: serverTimestamp()
  };

  try {
    if (idEl.value) {
      const ref = doc(db, "ferramentas", idEl.value);
      const snapAntes = await getDoc(ref);
      const dadosAntes = snapAntes.exists() ? snapAntes.data() : null;

      await updateDoc(ref, dados);

      await registrarReversao({
        modulo: "ferramentas",
        acao: "editar",
        documentoId: idEl.value,
        descricao: `Ferramenta editada: ${dadosAntes?.nome || nome}`,
        dadosAntes,
        dadosDepois: dados
      });

      msgEl.innerHTML = '<div class="ok">Ferramenta atualizada com sucesso.</div>';
    } else {
      await addDoc(collection(db, "ferramentas"), {
        ...dados,
        criadoEm: serverTimestamp()
      });
      msgEl.innerHTML = '<div class="ok">Ferramenta cadastrada com sucesso.</div>';
    }

    limparFormulario(false);
    
/* ==============================
   REVERSÕES - ÚLTIMAS 5 ALTERAÇÕES
   ============================== */

function criarPainelReversoes() {
  if (document.getElementById("listaReversoesFerramentas")) return;

  const painel = document.createElement("section");
  painel.className = "card";
  painel.innerHTML = `
    <h3>Últimas alterações</h3>
    <p>Permite reverter as últimas 5 alterações feitas em ferramentas.</p>
    <div id="listaReversoesFerramentas">Carregando...</div>
  `;

  const main = document.querySelector(".main");
  if (main) {
    main.appendChild(painel);
  }
}

async function registrarReversao({ modulo, acao, documentoId, descricao, dadosAntes, dadosDepois }) {
  if (!dadosAntes) return;

  await addDoc(collection(db, "reversoes"), {
    modulo,
    acao,
    documentoId,
    descricao,
    dadosAntes,
    dadosDepois,
    status: "disponivel",
    criadoEm: serverTimestamp()
  });

  await limitarReversoesFerramentas();
}

async function limitarReversoesFerramentas() {
  const snap = await getDocs(collection(db, "reversoes"));
  const reversoes = [];

  snap.forEach((docSnap) => {
    const r = { id: docSnap.id, ...docSnap.data() };
    if (r.modulo === "ferramentas" && r.status === "disponivel") {
      reversoes.push(r);
    }
  });

  reversoes.sort((a, b) => {
    const ta = a.criadoEm?.seconds || 0;
    const tb = b.criadoEm?.seconds || 0;
    return tb - ta;
  });

  const excedentes = reversoes.slice(5);

  for (const item of excedentes) {
    await updateDoc(doc(db, "reversoes", item.id), {
      status: "expirado"
    });
  }
}

async function carregarReversoes() {
  const el = document.getElementById("listaReversoesFerramentas");
  if (!el) return;

  try {
    const snap = await getDocs(collection(db, "reversoes"));
    const reversoes = [];

    snap.forEach((docSnap) => {
      const r = { id: docSnap.id, ...docSnap.data() };
      if (r.modulo === "ferramentas" && r.status === "disponivel") {
        reversoes.push(r);
      }
    });

    reversoes.sort((a, b) => {
      const ta = a.criadoEm?.seconds || 0;
      const tb = b.criadoEm?.seconds || 0;
      return tb - ta;
    });

    const ultimas = reversoes.slice(0, 5);

    if (ultimas.length === 0) {
      el.innerHTML = "<p>Nenhuma alteração disponível para reversão.</p>";
      return;
    }

    el.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Alteração</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          ${ultimas.map(r => `
            <tr>
              <td>
                <strong>${r.descricao || "Alteração"}</strong><br>
                <small>${r.acao || ""}</small>
              </td>
              <td>
                <button class="secondary" onclick='reverterAlteracao("${r.id}")'>Reverter</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error(error);
    el.innerHTML = `<div class="alert">Erro ao carregar reversões: ${error.message}</div>`;
  }
}

window.reverterAlteracao = async function(reversaoId) {
  if (!confirm("Deseja reverter esta alteração?")) return;

  try {
    const refReversao = doc(db, "reversoes", reversaoId);
    const snap = await getDoc(refReversao);

    if (!snap.exists()) {
      alert("Reversão não encontrada.");
      return;
    }

    const reversao = snap.data();

    if (reversao.status !== "disponivel") {
      alert("Essa reversão não está mais disponível.");
      return;
    }

    if (reversao.modulo !== "ferramentas") {
      alert("Essa reversão não pertence a ferramentas.");
      return;
    }

    const refDoc = doc(db, "ferramentas", reversao.documentoId);

    if (reversao.acao === "editar") {
      await updateDoc(refDoc, {
        ...reversao.dadosAntes,
        atualizadoEm: serverTimestamp()
      });
    }

    if (reversao.acao === "excluir") {
      await setDoc(refDoc, {
        ...reversao.dadosAntes,
        restauradoEm: serverTimestamp()
      });
    }

    await updateDoc(refReversao, {
      status: "revertido",
      revertidoEm: serverTimestamp()
    });

    await carregarFerramentas();
    await carregarReversoes();
  } catch (error) {
    console.error(error);
    alert("Erro ao reverter: " + error.message);
  }
};


await carregarFerramentas();
await carregarReversoes();
    await carregarReversoes();
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao salvar: ${error.message}</div>`;
  }
}

async function carregarFerramentas() {
  try {
    const snap = await getDocs(collection(db, "ferramentas"));
    const ferramentas = [];

    snap.forEach((docSnap) => {
      ferramentas.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Ordem alfabética principal pelo nome da ferramenta
    ferramentas.sort((a, b) => {
      const nomeA = (a.nome || "").toLowerCase();
      const nomeB = (b.nome || "").toLowerCase();
      return nomeA.localeCompare(nomeB, "pt-BR");
    });

    if (ferramentas.length === 0) {
      listaEl.innerHTML = "<p>Nenhuma ferramenta cadastrada.</p>";
      return;
    }

    listaEl.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Ferramenta</th>
            <th>Fabricante</th>
            <th>Comprimento</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${ferramentas.map(f => `
            <tr>
              <td>
                <strong>${f.nome || ""}</strong><br>
                <small>${formatarNumero(f.diametro)} mm ${f.xd ? "• " + f.xd : ""}</small>
              </td>
              <td><strong>${f.fabricante || "-"}</strong></td>
              <td>${formatarNumero(f.comprimento)} mm</td>
              <td>${f.ativa ? '<span class="badge">Ativa</span>' : '<span class="badge">Inativa</span>'}</td>
              <td>
                <div class="actions">
                  <button class="secondary" onclick='editarFerramenta(${JSON.stringify(f).replace(/'/g, "&apos;")})'>Editar</button>
                  <button class="success" onclick='duplicarFerramenta(${JSON.stringify(f).replace(/'/g, "&apos;")})'>Duplicar</button>
                  <button class="danger" onclick='excluirFerramenta("${f.id}")'>Excluir</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error(error);
    listaEl.innerHTML = `<div class="alert">Erro ao carregar ferramentas: ${error.message}</div>`;
  }
}

window.editarFerramenta = function(f) {
  idEl.value = f.id;
  nomeEl.value = f.nome || "";
  diametroEl.value = f.diametro || "";
  xdEl.value = f.xd || "";
  comprimentoEl.value = f.comprimento || "";
  fabricanteEl.value = f.fabricante || "";
  ativaEl.value = String(f.ativa !== false);
  obsEl.value = f.observacoes || "";
  tituloEl.textContent = "Editar ferramenta";
  msgEl.innerHTML = "";
};

window.duplicarFerramenta = function(f) {
  idEl.value = "";
  nomeEl.value = f.nome || "";
  diametroEl.value = f.diametro || "";
  xdEl.value = f.xd || "";
  comprimentoEl.value = f.comprimento || "";
  fabricanteEl.value = f.fabricante || "";
  ativaEl.value = String(f.ativa !== false);
  obsEl.value = f.observacoes || "";
  tituloEl.textContent = "Duplicar ferramenta";
  msgEl.innerHTML = '<div class="alert">Ferramenta duplicada no formulário. Ajuste o fabricante ou outros dados e clique em Salvar.</div>';
  fabricanteEl.focus();
};

window.excluirFerramenta = async function(id) {
  if (!confirm("Deseja excluir esta ferramenta?")) return;

  try {
    await deleteDoc(doc(db, "ferramentas", id));
    
/* ==============================
   REVERSÕES - ÚLTIMAS 5 ALTERAÇÕES
   ============================== */

function criarPainelReversoes() {
  if (document.getElementById("listaReversoesFerramentas")) return;

  const painel = document.createElement("section");
  painel.className = "card";
  painel.innerHTML = `
    <h3>Últimas alterações</h3>
    <p>Permite reverter as últimas 5 alterações feitas em ferramentas.</p>
    <div id="listaReversoesFerramentas">Carregando...</div>
  `;

  const main = document.querySelector(".main");
  if (main) {
    main.appendChild(painel);
  }
}

async function registrarReversao({ modulo, acao, documentoId, descricao, dadosAntes, dadosDepois }) {
  if (!dadosAntes) return;

  await addDoc(collection(db, "reversoes"), {
    modulo,
    acao,
    documentoId,
    descricao,
    dadosAntes,
    dadosDepois,
    status: "disponivel",
    criadoEm: serverTimestamp()
  });

  await limitarReversoesFerramentas();
}

async function limitarReversoesFerramentas() {
  const snap = await getDocs(collection(db, "reversoes"));
  const reversoes = [];

  snap.forEach((docSnap) => {
    const r = { id: docSnap.id, ...docSnap.data() };
    if (r.modulo === "ferramentas" && r.status === "disponivel") {
      reversoes.push(r);
    }
  });

  reversoes.sort((a, b) => {
    const ta = a.criadoEm?.seconds || 0;
    const tb = b.criadoEm?.seconds || 0;
    return tb - ta;
  });

  const excedentes = reversoes.slice(5);

  for (const item of excedentes) {
    await updateDoc(doc(db, "reversoes", item.id), {
      status: "expirado"
    });
  }
}

async function carregarReversoes() {
  const el = document.getElementById("listaReversoesFerramentas");
  if (!el) return;

  try {
    const snap = await getDocs(collection(db, "reversoes"));
    const reversoes = [];

    snap.forEach((docSnap) => {
      const r = { id: docSnap.id, ...docSnap.data() };
      if (r.modulo === "ferramentas" && r.status === "disponivel") {
        reversoes.push(r);
      }
    });

    reversoes.sort((a, b) => {
      const ta = a.criadoEm?.seconds || 0;
      const tb = b.criadoEm?.seconds || 0;
      return tb - ta;
    });

    const ultimas = reversoes.slice(0, 5);

    if (ultimas.length === 0) {
      el.innerHTML = "<p>Nenhuma alteração disponível para reversão.</p>";
      return;
    }

    el.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Alteração</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          ${ultimas.map(r => `
            <tr>
              <td>
                <strong>${r.descricao || "Alteração"}</strong><br>
                <small>${r.acao || ""}</small>
              </td>
              <td>
                <button class="secondary" onclick='reverterAlteracao("${r.id}")'>Reverter</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error(error);
    el.innerHTML = `<div class="alert">Erro ao carregar reversões: ${error.message}</div>`;
  }
}

window.reverterAlteracao = async function(reversaoId) {
  if (!confirm("Deseja reverter esta alteração?")) return;

  try {
    const refReversao = doc(db, "reversoes", reversaoId);
    const snap = await getDoc(refReversao);

    if (!snap.exists()) {
      alert("Reversão não encontrada.");
      return;
    }

    const reversao = snap.data();

    if (reversao.status !== "disponivel") {
      alert("Essa reversão não está mais disponível.");
      return;
    }

    if (reversao.modulo !== "ferramentas") {
      alert("Essa reversão não pertence a ferramentas.");
      return;
    }

    const refDoc = doc(db, "ferramentas", reversao.documentoId);

    if (reversao.acao === "editar") {
      await updateDoc(refDoc, {
        ...reversao.dadosAntes,
        atualizadoEm: serverTimestamp()
      });
    }

    if (reversao.acao === "excluir") {
      await setDoc(refDoc, {
        ...reversao.dadosAntes,
        restauradoEm: serverTimestamp()
      });
    }

    await updateDoc(refReversao, {
      status: "revertido",
      revertidoEm: serverTimestamp()
    });

    await carregarFerramentas();
    await carregarReversoes();
  } catch (error) {
    console.error(error);
    alert("Erro ao reverter: " + error.message);
  }
};


await carregarFerramentas();
await carregarReversoes();
    await carregarReversoes();
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao excluir: ${error.message}</div>`;
  }
};

function limparFormulario(limparMsg = true) {
  idEl.value = "";
  nomeEl.value = "";
  diametroEl.value = "";
  xdEl.value = "";
  comprimentoEl.value = "";
  fabricanteEl.value = "";
  ativaEl.value = "true";
  obsEl.value = "";
  tituloEl.textContent = "Adicionar ferramenta";

  if (limparMsg) {
    msgEl.innerHTML = "";
  }
}

function formatarNumero(valor) {
  if (valor === undefined || valor === null || valor === "") return "-";
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}


/* ==============================
   REVERSÕES - ÚLTIMAS 5 ALTERAÇÕES
   ============================== */

function criarPainelReversoes() {
  if (document.getElementById("listaReversoesFerramentas")) return;

  const painel = document.createElement("section");
  painel.className = "card";
  painel.innerHTML = `
    <h3>Últimas alterações</h3>
    <p>Permite reverter as últimas 5 alterações feitas em ferramentas.</p>
    <div id="listaReversoesFerramentas">Carregando...</div>
  `;

  const main = document.querySelector(".main");
  if (main) {
    main.appendChild(painel);
  }
}

async function registrarReversao({ modulo, acao, documentoId, descricao, dadosAntes, dadosDepois }) {
  if (!dadosAntes) return;

  await addDoc(collection(db, "reversoes"), {
    modulo,
    acao,
    documentoId,
    descricao,
    dadosAntes,
    dadosDepois,
    status: "disponivel",
    criadoEm: serverTimestamp()
  });

  await limitarReversoesFerramentas();
}

async function limitarReversoesFerramentas() {
  const snap = await getDocs(collection(db, "reversoes"));
  const reversoes = [];

  snap.forEach((docSnap) => {
    const r = { id: docSnap.id, ...docSnap.data() };
    if (r.modulo === "ferramentas" && r.status === "disponivel") {
      reversoes.push(r);
    }
  });

  reversoes.sort((a, b) => {
    const ta = a.criadoEm?.seconds || 0;
    const tb = b.criadoEm?.seconds || 0;
    return tb - ta;
  });

  const excedentes = reversoes.slice(5);

  for (const item of excedentes) {
    await updateDoc(doc(db, "reversoes", item.id), {
      status: "expirado"
    });
  }
}

async function carregarReversoes() {
  const el = document.getElementById("listaReversoesFerramentas");
  if (!el) return;

  try {
    const snap = await getDocs(collection(db, "reversoes"));
    const reversoes = [];

    snap.forEach((docSnap) => {
      const r = { id: docSnap.id, ...docSnap.data() };
      if (r.modulo === "ferramentas" && r.status === "disponivel") {
        reversoes.push(r);
      }
    });

    reversoes.sort((a, b) => {
      const ta = a.criadoEm?.seconds || 0;
      const tb = b.criadoEm?.seconds || 0;
      return tb - ta;
    });

    const ultimas = reversoes.slice(0, 5);

    if (ultimas.length === 0) {
      el.innerHTML = "<p>Nenhuma alteração disponível para reversão.</p>";
      return;
    }

    el.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Alteração</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          ${ultimas.map(r => `
            <tr>
              <td>
                <strong>${r.descricao || "Alteração"}</strong><br>
                <small>${r.acao || ""}</small>
              </td>
              <td>
                <button class="secondary" onclick='reverterAlteracao("${r.id}")'>Reverter</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error(error);
    el.innerHTML = `<div class="alert">Erro ao carregar reversões: ${error.message}</div>`;
  }
}

window.reverterAlteracao = async function(reversaoId) {
  if (!confirm("Deseja reverter esta alteração?")) return;

  try {
    const refReversao = doc(db, "reversoes", reversaoId);
    const snap = await getDoc(refReversao);

    if (!snap.exists()) {
      alert("Reversão não encontrada.");
      return;
    }

    const reversao = snap.data();

    if (reversao.status !== "disponivel") {
      alert("Essa reversão não está mais disponível.");
      return;
    }

    if (reversao.modulo !== "ferramentas") {
      alert("Essa reversão não pertence a ferramentas.");
      return;
    }

    const refDoc = doc(db, "ferramentas", reversao.documentoId);

    if (reversao.acao === "editar") {
      await updateDoc(refDoc, {
        ...reversao.dadosAntes,
        atualizadoEm: serverTimestamp()
      });
    }

    if (reversao.acao === "excluir") {
      await setDoc(refDoc, {
        ...reversao.dadosAntes,
        restauradoEm: serverTimestamp()
      });
    }

    await updateDoc(refReversao, {
      status: "revertido",
      revertidoEm: serverTimestamp()
    });

    await carregarFerramentas();
    await carregarReversoes();
  } catch (error) {
    console.error(error);
    alert("Erro ao reverter: " + error.message);
  }
};


await carregarFerramentas();
await carregarReversoes();
