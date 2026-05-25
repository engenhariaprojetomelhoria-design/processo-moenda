import { protegerPagina } from "./layout.js";
import {
  db,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "./firebase.js";

await protegerPagina("maquinas");

const idEl = document.getElementById("maquinaId");
const nomeEl = document.getElementById("nome");
const codigoEl = document.getElementById("codigo");
const setorEl = document.getElementById("setor");
const ativaEl = document.getElementById("ativa");
const obsEl = document.getElementById("observacoes");
const msgEl = document.getElementById("msg");
const listaEl = document.getElementById("listaMaquinas");
const tituloEl = document.getElementById("formTitulo");

let ultimaReversao = null;

document.getElementById("salvarBtn").addEventListener("click", salvarMaquina);
document.getElementById("limparBtn").addEventListener("click", () => limparFormulario());

criarPainelReversao();

async function salvarMaquina() {
  const nome = nomeEl.value.trim();
  const codigo = codigoEl.value.trim();
  const setor = setorEl.value.trim();
  const observacoes = obsEl.value.trim();
  const ativa = ativaEl.value === "true";

  if (!nome) {
    msgEl.innerHTML = '<div class="alert">Informe o nome da máquina.</div>';
    return;
  }

  const dados = {
    nome,
    codigo,
    setor,
    observacoes,
    ativa,
    atualizadoEm: serverTimestamp()
  };

  try {
    if (idEl.value) {
      const maquinasAtuais = await buscarMaquinas();
      const anterior = maquinasAtuais.find(m => m.id === idEl.value);

      if (anterior) {
        ultimaReversao = {
          tipo: "editar",
          id: idEl.value,
          dados: { ...anterior }
        };
      }

      await updateDoc(doc(db, "maquinas", idEl.value), dados);
      msgEl.innerHTML = '<div class="ok">Máquina atualizada com sucesso.</div>';
    } else {
      const novoDoc = await addDoc(collection(db, "maquinas"), {
        ...dados,
        criadoEm: serverTimestamp()
      });

      ultimaReversao = {
        tipo: "criar",
        id: novoDoc.id,
        dados: { id: novoDoc.id, ...dados }
      };

      msgEl.innerHTML = '<div class="ok">Máquina cadastrada com sucesso.</div>';
    }

    limparFormulario(false);
    await carregarMaquinas();
    atualizarPainelReversao();
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao salvar: ${error.message}</div>`;
  }
}

async function buscarMaquinas() {
  const snap = await getDocs(collection(db, "maquinas"));
  const maquinas = [];

  snap.forEach((docSnap) => {
    maquinas.push({ id: docSnap.id, ...docSnap.data() });
  });

  return maquinas;
}

async function carregarMaquinas() {
  try {
    const maquinas = await buscarMaquinas();

    maquinas.sort((a, b) => {
      const nomeA = (a.nome || "").toLowerCase();
      const nomeB = (b.nome || "").toLowerCase();
      return nomeA.localeCompare(nomeB, "pt-BR");
    });

    if (maquinas.length === 0) {
      listaEl.innerHTML = "<p>Nenhuma máquina cadastrada.</p>";
      return;
    }

    listaEl.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Código</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${maquinas.map(m => `
            <tr>
              <td>
                <strong>${m.nome || ""}</strong><br>
                <small>${m.setor || ""}</small>
              </td>
              <td>${m.codigo || "-"}</td>
              <td>${m.ativa ? '<span class="badge">Ativa</span>' : '<span class="badge">Inativa</span>'}</td>
              <td>
                <div class="actions">
                  <button class="secondary" onclick='editarMaquina(${JSON.stringify(m).replace(/'/g, "&apos;")})'>Editar</button>
                  <button class="danger" onclick='excluirMaquina("${m.id}")'>Excluir</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error(error);
    listaEl.innerHTML = `<div class="alert">Erro ao carregar máquinas: ${error.message}</div>`;
  }
}

window.editarMaquina = function(m) {
  idEl.value = m.id;
  nomeEl.value = m.nome || "";
  codigoEl.value = m.codigo || "";
  setorEl.value = m.setor || "";
  ativaEl.value = String(m.ativa !== false);
  obsEl.value = m.observacoes || "";
  tituloEl.textContent = "Editar máquina";
  msgEl.innerHTML = "";
};

window.excluirMaquina = async function(id) {
  if (!confirm("Deseja excluir esta máquina?")) return;

  try {
    const maquinasAtuais = await buscarMaquinas();
    const anterior = maquinasAtuais.find(m => m.id === id);

    if (anterior) {
      ultimaReversao = {
        tipo: "excluir",
        id,
        dados: { ...anterior }
      };
    }

    await deleteDoc(doc(db, "maquinas", id));
    await carregarMaquinas();
    atualizarPainelReversao();
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao excluir: ${error.message}</div>`;
  }
};

function limparFormulario(limparMsg = true) {
  idEl.value = "";
  nomeEl.value = "";
  codigoEl.value = "";
  setorEl.value = "";
  ativaEl.value = "true";
  obsEl.value = "";
  tituloEl.textContent = "Adicionar máquina";

  if (limparMsg) {
    msgEl.innerHTML = "";
  }
}

function criarPainelReversao() {
  const painel = document.createElement("section");
  painel.className = "card";
  painel.innerHTML = `
    <h3>Reversão rápida</h3>
    <p>Permite reverter a última alteração feita nesta tela enquanto a página estiver aberta.</p>
    <button id="reverterUltimaBtn" class="secondary" disabled>Reverter última alteração</button>
    <div id="msgReversao" style="margin-top: 10px;"></div>
  `;

  const main = document.querySelector(".main");
  if (main) {
    main.appendChild(painel);
  }

  document.getElementById("reverterUltimaBtn").addEventListener("click", reverterUltimaAlteracao);
  atualizarPainelReversao();
}

function atualizarPainelReversao() {
  const btn = document.getElementById("reverterUltimaBtn");
  const msg = document.getElementById("msgReversao");

  if (!btn || !msg) return;

  if (!ultimaReversao) {
    btn.disabled = true;
    msg.innerHTML = "<small>Nenhuma alteração para reverter.</small>";
    return;
  }

  btn.disabled = false;
  const nome = ultimaReversao.dados?.nome || "máquina";

  let acao = "alteração";
  if (ultimaReversao.tipo === "editar") acao = "edição";
  if (ultimaReversao.tipo === "excluir") acao = "exclusão";
  if (ultimaReversao.tipo === "criar") acao = "criação";

  msg.innerHTML = `<small>Última alteração disponível: ${acao} de <strong>${nome}</strong>.</small>`;
}

async function reverterUltimaAlteracao() {
  if (!ultimaReversao) return;

  if (!confirm("Deseja reverter a última alteração?")) return;

  try {
    const dados = { ...ultimaReversao.dados };

    if (ultimaReversao.tipo === "editar") {
      await updateDoc(doc(db, "maquinas", ultimaReversao.id), {
        nome: dados.nome || "",
        codigo: dados.codigo || "",
        setor: dados.setor || "",
        observacoes: dados.observacoes || "",
        ativa: dados.ativa !== false,
        atualizadoEm: serverTimestamp()
      });
    }

    if (ultimaReversao.tipo === "excluir") {
      await addDoc(collection(db, "maquinas"), {
        nome: dados.nome || "",
        codigo: dados.codigo || "",
        setor: dados.setor || "",
        observacoes: dados.observacoes || "",
        ativa: dados.ativa !== false,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
    }

    if (ultimaReversao.tipo === "criar") {
      await deleteDoc(doc(db, "maquinas", ultimaReversao.id));
    }

    ultimaReversao = null;
    await carregarMaquinas();
    atualizarPainelReversao();

    msgEl.innerHTML = '<div class="ok">Última alteração revertida com sucesso.</div>';
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao reverter: ${error.message}</div>`;
  }
}

await carregarMaquinas();
