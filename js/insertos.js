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

await protegerPagina("insertos");

const idEl = document.getElementById("insertoId");
const marcaEl = document.getElementById("marca");
const modeloEl = document.getElementById("modelo");
const vidaSeguraEl = document.getElementById("vidaSegura");
const toleranciaEl = document.getElementById("tolerancia");
const estoqueResidualEl = document.getElementById("estoqueResidual");
const ativoEl = document.getElementById("ativo");
const obsEl = document.getElementById("observacoes");
const msgEl = document.getElementById("msg");
const listaEl = document.getElementById("listaInsertos");
const tituloEl = document.getElementById("formTitulo");

document.getElementById("salvarBtn").addEventListener("click", salvarInserto);
document.getElementById("limparBtn").addEventListener("click", () => limparFormulario());

async function salvarInserto() {
  const marca = marcaEl.value.trim();
  const modelo = modeloEl.value.trim();
  const vidaSegura = Number(vidaSeguraEl.value);
  const tolerancia = Number(toleranciaEl.value || 0);
  const estoqueResidual = Number(estoqueResidualEl.value || 0);
  const ativo = ativoEl.value === "true";
  const observacoes = obsEl.value.trim();

  if (!marca) {
    msgEl.innerHTML = '<div class="alert">Informe a marca do inserto.</div>';
    return;
  }

  if (!vidaSegura || vidaSegura <= 0) {
    msgEl.innerHTML = '<div class="alert">Informe a vida segura em metros.</div>';
    return;
  }

  if (tolerancia < 0) {
    msgEl.innerHTML = '<div class="alert">A tolerância não pode ser negativa.</div>';
    return;
  }

  if (estoqueResidual < 0) {
    msgEl.innerHTML = '<div class="alert">O estoque residual não pode ser negativo.</div>';
    return;
  }

  const dados = {
    marca,
    modelo,
    vidaSegura,
    tolerancia,
    vidaTotal: vidaSegura + tolerancia,
    estoqueResidual,
    ativo,
    observacoes,
    atualizadoEm: serverTimestamp()
  };

  try {
    if (idEl.value) {
      await updateDoc(doc(db, "insertos", idEl.value), dados);
      msgEl.innerHTML = '<div class="ok">Inserto atualizado com sucesso.</div>';
    } else {
      await addDoc(collection(db, "insertos"), {
        ...dados,
        criadoEm: serverTimestamp()
      });
      msgEl.innerHTML = '<div class="ok">Inserto cadastrado com sucesso.</div>';
    }

    limparFormulario(false);
    await carregarInsertos();
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao salvar: ${error.message}</div>`;
  }
}

async function carregarInsertos() {
  try {
    const snap = await getDocs(collection(db, "insertos"));
    const insertos = [];

    snap.forEach((docSnap) => {
      insertos.push({ id: docSnap.id, ...docSnap.data() });
    });

    insertos.sort((a, b) => {
      const marcaCompare = (a.marca || a.nome || "").localeCompare(b.marca || b.nome || "");
      if (marcaCompare !== 0) return marcaCompare;
      return (a.modelo || "").localeCompare(b.modelo || "");
    });

    if (insertos.length === 0) {
      listaEl.innerHTML = "<p>Nenhum inserto cadastrado.</p>";
      return;
    }

    listaEl.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Inserto</th>
            <th>Vida</th>
            <th>Tolerância</th>
            <th>Total</th>
            <th>Residual</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${insertos.map(i => {
            const marca = i.marca || i.nome || "";
            const vidaSegura = Number(i.vidaSegura || 0);
            const tolerancia = Number(i.tolerancia || 0);
            const vidaTotal = Number(i.vidaTotal || (vidaSegura + tolerancia));
            const estoqueResidual = Number(i.estoqueResidual || 0);
            return `
              <tr>
                <td>
                  <strong>${marca}</strong><br>
                  <small>${i.modelo || ""}</small>
                </td>
                <td>${formatarNumero(vidaSegura)} m</td>
                <td>${formatarNumero(tolerancia)} m</td>
                <td>${formatarNumero(vidaTotal)} m</td>
                <td>${formatarNumero(estoqueResidual)} m</td>
                <td>${i.ativo !== false ? '<span class="badge">Ativo</span>' : '<span class="badge">Inativo</span>'}</td>
                <td>
                  <div class="actions">
                    <button class="secondary" onclick='editarInserto(${JSON.stringify(i).replace(/'/g, "&apos;")})'>Editar</button>
                    <button class="danger" onclick='excluirInserto("${i.id}")'>Excluir</button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error(error);
    listaEl.innerHTML = `<div class="alert">Erro ao carregar insertos: ${error.message}</div>`;
  }
}

window.editarInserto = function(i) {
  idEl.value = i.id;
  marcaEl.value = i.marca || i.nome || "";
  modeloEl.value = i.modelo || "";
  vidaSeguraEl.value = i.vidaSegura || "";
  toleranciaEl.value = i.tolerancia || "";
  estoqueResidualEl.value = i.estoqueResidual || "";
  ativoEl.value = String(i.ativo !== false);
  obsEl.value = i.observacoes || "";
  tituloEl.textContent = "Editar inserto";
  msgEl.innerHTML = "";
};

window.excluirInserto = async function(id) {
  if (!confirm("Deseja excluir este inserto?")) return;

  try {
    await deleteDoc(doc(db, "insertos", id));
    await carregarInsertos();
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao excluir: ${error.message}</div>`;
  }
};

function limparFormulario(limparMsg = true) {
  idEl.value = "";
  marcaEl.value = "";
  modeloEl.value = "";
  vidaSeguraEl.value = "";
  toleranciaEl.value = "";
  estoqueResidualEl.value = "";
  ativoEl.value = "true";
  obsEl.value = "";
  tituloEl.textContent = "Adicionar inserto";

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

await carregarInsertos();
