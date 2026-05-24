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

async function salvarFerramenta() {
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
      await updateDoc(doc(db, "ferramentas", idEl.value), dados);
      msgEl.innerHTML = '<div class="ok">Ferramenta atualizada com sucesso.</div>';
    } else {
      await addDoc(collection(db, "ferramentas"), {
        ...dados,
        criadoEm: serverTimestamp()
      });
      msgEl.innerHTML = '<div class="ok">Ferramenta cadastrada com sucesso.</div>';
    }

    limparFormulario(false);
    await carregarFerramentas();
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
    await carregarFerramentas();
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

await carregarFerramentas();
