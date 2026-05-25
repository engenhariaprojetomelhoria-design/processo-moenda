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
const ativoEl = document.getElementById("ativo");
const obsEl = document.getElementById("observacoes");
const msgEl = document.getElementById("msg");
const listaEl = document.getElementById("listaInsertos");
const listaUsadosEl = document.getElementById("listaUsados");
const tituloEl = document.getElementById("formTitulo");

let ultimaReversao = null;

document.getElementById("salvarBtn").addEventListener("click", salvarInserto);
document.getElementById("limparBtn").addEventListener("click", () => limparFormulario());

criarPainelReversao();

await carregarFabricantesFerramentas();

async function carregarFabricantesFerramentas() {
  const snap = await getDocs(collection(db, "ferramentas"));
  const fabricantes = new Set();

  snap.forEach((docSnap) => {
    const f = docSnap.data();
    if (f.fabricante) {
      fabricantes.add(f.fabricante.trim());
    }
  });

  const lista = Array.from(fabricantes).sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (lista.length === 0) {
    marcaEl.innerHTML = '<option value="">Cadastre uma ferramenta primeiro</option>';
    return;
  }

  marcaEl.innerHTML =
    '<option value="">Selecione o fabricante</option>' +
    lista.map(f => `<option value="${f}">${f}</option>`).join("");
}

async function salvarInserto() {
  const marca = marcaEl.value.trim();
  const modelo = modeloEl.value.trim();
  const vidaSegura = Number(vidaSeguraEl.value);
  const tolerancia = Number(toleranciaEl.value || 0);
  const ativo = ativoEl.value === "true";
  const observacoes = obsEl.value.trim();

  if (!marca) {
    msgEl.innerHTML = '<div class="alert">Selecione a marca/fabricante do inserto.</div>';
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

  const dados = {
    marca,
    modelo,
    vidaSegura,
    tolerancia,
    vidaTotal: vidaSegura + tolerancia,
    ativo,
    observacoes,
    tipo: "novo",
    atualizadoEm: serverTimestamp()
  };

  try {
    if (idEl.value) {
      const insertos = await carregarTodosInsertos();
      const anterior = insertos.find(i => i.id === idEl.value);

      if (anterior) {
        ultimaReversao = {
          tipo: "editar",
          id: idEl.value,
          dados: { ...anterior }
        };
      }

      await updateDoc(doc(db, "insertos", idEl.value), dados);
      msgEl.innerHTML = '<div class="ok">Inserto atualizado com sucesso.</div>';
    } else {
      const novoDoc = await addDoc(collection(db, "insertos"), {
        ...dados,
        criadoEm: serverTimestamp()
      });

      ultimaReversao = {
        tipo: "criar",
        id: novoDoc.id,
        dados: { id: novoDoc.id, ...dados }
      };

      msgEl.innerHTML = '<div class="ok">Inserto cadastrado com sucesso.</div>';
    }

    limparFormulario(false);
    await carregarTudo();
    atualizarPainelReversao();
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao salvar: ${error.message}</div>`;
  }
}

async function carregarTodosInsertos() {
  const snap = await getDocs(collection(db, "insertos"));
  const insertos = [];

  snap.forEach((docSnap) => {
    insertos.push({ id: docSnap.id, ...docSnap.data() });
  });

  insertos.sort((a, b) => {
    const marcaA = a.marca || a.nome || "";
    const marcaB = b.marca || b.nome || "";
    const marcaCompare = marcaA.localeCompare(marcaB);
    if (marcaCompare !== 0) return marcaCompare;
    return (a.modelo || "").localeCompare(b.modelo || "");
  });

  return insertos;
}

async function carregarTudo() {
  try {
    const todos = await carregarTodosInsertos();

    const novos = todos.filter(i => i.tipo !== "usado");
    const usados = todos.filter(i => i.tipo === "usado");

    renderNovos(novos);
    renderUsados(usados);
  } catch (error) {
    console.error(error);
    listaEl.innerHTML = `<div class="alert">Erro ao carregar insertos: ${error.message}</div>`;
    listaUsadosEl.innerHTML = `<div class="alert">Erro ao carregar estoque: ${error.message}</div>`;
  }
}

function renderNovos(insertos) {
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

          return `
            <tr>
              <td>
                <strong>${marca}</strong><br>
                <small>${i.modelo || ""}</small>
              </td>
              <td>${formatarNumero(vidaSegura)} m</td>
              <td>${formatarNumero(tolerancia)} m</td>
              <td>${formatarNumero(vidaTotal)} m</td>
              <td>${i.ativo !== false ? '<span class="badge">Ativo</span>' : '<span class="badge">Inativo</span>'}</td>
              <td>
                <div class="actions">
                  <button class="secondary" onclick='editarInserto(${JSON.stringify(i).replace(/'/g, "&apos;")})'>Editar</button>
                  <button class="success" onclick='duplicarUsado(${JSON.stringify(i).replace(/'/g, "&apos;")})'>Duplicar usado</button>
                  <button class="danger" onclick='excluirInserto("${i.id}")'>Excluir</button>
                </div>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderUsados(usados) {
  if (usados.length === 0) {
    listaUsadosEl.innerHTML = "<p>Nenhum inserto usado em estoque.</p>";
    return;
  }

  listaUsadosEl.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Inserto usado</th>
          <th>Residual</th>
          <th>Origem</th>
          <th>Status</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${usados.map(i => `
          <tr>
            <td>
              <strong>${i.marca || ""}</strong><br>
              <small>${i.modelo || ""}</small>
            </td>
            <td>${formatarNumero(i.vidaResidual || 0)} m</td>
            <td>${i.origem || "-"}</td>
            <td>${i.ativo !== false ? '<span class="badge">Disponível</span>' : '<span class="badge">Indisponível</span>'}</td>
            <td>
              <div class="actions">
                <button class="secondary" onclick='editarResidual(${JSON.stringify(i).replace(/'/g, "&apos;")})'>Editar residual</button>
                <button class="danger" onclick='excluirInserto("${i.id}")'>Excluir</button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

window.duplicarUsado = async function(i) {
  const residualTexto = prompt(`Residual disponível para ${i.marca || i.nome} ${i.modelo || ""} em metros:`);
  if (residualTexto === null) return;

  const vidaResidual = Number(String(residualTexto).replace(",", "."));

  if (!vidaResidual || vidaResidual <= 0) {
    alert("Informe um residual válido maior que zero.");
    return;
  }

  const origem = prompt("Origem/observação deste inserto usado:", "Estoque residual") || "";

  try {
    const dadosNovo = {
      marca: i.marca || i.nome || "",
      modelo: i.modelo || "",
      vidaSegura: Number(i.vidaSegura || 0),
      tolerancia: Number(i.tolerancia || 0),
      vidaTotal: Number(i.vidaTotal || ((Number(i.vidaSegura || 0)) + (Number(i.tolerancia || 0)))),
      vidaResidual,
      origem,
      tipo: "usado",
      ativo: true,
      insertoBaseId: i.id,
      observacoes: i.observacoes || "",
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    };

    const novoDoc = await addDoc(collection(db, "insertos"), dadosNovo);

    ultimaReversao = {
      tipo: "criar",
      id: novoDoc.id,
      dados: { id: novoDoc.id, ...dadosNovo }
    };

    await carregarTudo();
    atualizarPainelReversao();
  } catch (error) {
    console.error(error);
    alert("Erro ao duplicar usado: " + error.message);
  }
};

window.editarResidual = async function(i) {
  const residualTexto = prompt(`Novo residual disponível para ${i.marca || ""} ${i.modelo || ""}:`, i.vidaResidual || "");
  if (residualTexto === null) return;

  const vidaResidual = Number(String(residualTexto).replace(",", "."));

  if (!vidaResidual || vidaResidual <= 0) {
    alert("Informe um residual válido maior que zero.");
    return;
  }

  try {
    ultimaReversao = {
      tipo: "editar",
      id: i.id,
      dados: { ...i }
    };

    await updateDoc(doc(db, "insertos", i.id), {
      vidaResidual,
      atualizadoEm: serverTimestamp()
    });

    await carregarTudo();
    atualizarPainelReversao();
  } catch (error) {
    console.error(error);
    alert("Erro ao editar residual: " + error.message);
  }
};

window.editarInserto = function(i) {
  idEl.value = i.id;
  marcaEl.value = i.marca || i.nome || "";
  modeloEl.value = i.modelo || "";
  vidaSeguraEl.value = i.vidaSegura || "";
  toleranciaEl.value = i.tolerancia || "";
  ativoEl.value = String(i.ativo !== false);
  obsEl.value = i.observacoes || "";
  tituloEl.textContent = "Editar inserto";
  msgEl.innerHTML = "";
};

window.excluirInserto = async function(id) {
  if (!confirm("Deseja excluir este inserto?")) return;

  try {
    const insertos = await carregarTodosInsertos();
    const anterior = insertos.find(i => i.id === id);

    if (anterior) {
      ultimaReversao = {
        tipo: "excluir",
        id,
        dados: { ...anterior }
      };
    }

    await deleteDoc(doc(db, "insertos", id));
    await carregarTudo();
    atualizarPainelReversao();
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

function criarPainelReversao() {
  const painel = document.createElement("section");
  painel.className = "card";
  painel.innerHTML = `
    <h3>Reversão rápida</h3>
    <p>Permite reverter a última alteração feita nesta tela enquanto a página estiver aberta.</p>
    <button id="reverterUltimaBtn" class="secondary" disabled>Reverter última alteração</button>
    <div id="msgReversao" style="margin-top:10px;"></div>
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

  const nome = ultimaReversao.dados?.marca || ultimaReversao.dados?.nome || "inserto";
  let acao = "alteração";

  if (ultimaReversao.tipo === "editar") acao = "edição";
  if (ultimaReversao.tipo === "excluir") acao = "exclusão";
  if (ultimaReversao.tipo === "criar") acao = "criação/duplicação";

  msg.innerHTML = `<small>Última alteração disponível: ${acao} de <strong>${nome}</strong>.</small>`;
}

async function reverterUltimaAlteracao() {
  if (!ultimaReversao) return;

  if (!confirm("Deseja reverter a última alteração?")) return;

  try {
    const dados = { ...ultimaReversao.dados };

    if (ultimaReversao.tipo === "editar") {
      delete dados.id;

      await updateDoc(doc(db, "insertos", ultimaReversao.id), {
        ...dados,
        atualizadoEm: serverTimestamp()
      });
    }

    if (ultimaReversao.tipo === "excluir") {
      delete dados.id;

      await addDoc(collection(db, "insertos"), {
        ...dados,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
    }

    if (ultimaReversao.tipo === "criar") {
      await deleteDoc(doc(db, "insertos", ultimaReversao.id));
    }

    ultimaReversao = null;
    await carregarTudo();
    atualizarPainelReversao();

    msgEl.innerHTML = '<div class="ok">Última alteração revertida com sucesso.</div>';
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao reverter: ${error.message}</div>`;
  }
}

await carregarTudo();
