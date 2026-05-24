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

document.getElementById("salvarBtn").addEventListener("click", salvarMaquina);
document.getElementById("limparBtn").addEventListener("click", () => limparFormulario());

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
      await updateDoc(doc(db, "maquinas", idEl.value), dados);
      msgEl.innerHTML = '<div class="ok">Máquina atualizada com sucesso.</div>';
    } else {
      await addDoc(collection(db, "maquinas"), {
        ...dados,
        criadoEm: serverTimestamp()
      });
      msgEl.innerHTML = '<div class="ok">Máquina cadastrada com sucesso.</div>';
    }

    limparFormulario(false);
    await carregarMaquinas();
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao salvar: ${error.message}</div>`;
  }
}

async function carregarMaquinas() {
  try {
    const snap = await getDocs(collection(db, "maquinas"));
    const maquinas = [];

    snap.forEach((docSnap) => {
      maquinas.push({ id: docSnap.id, ...docSnap.data() });
    });

    maquinas.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

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
    await deleteDoc(doc(db, "maquinas", id));
    await carregarMaquinas();
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

await carregarMaquinas();
