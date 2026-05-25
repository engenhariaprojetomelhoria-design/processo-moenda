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

await protegerPagina("materiais");

const idEl = document.getElementById("materialId");
const nomeEl = document.getElementById("nome");
const desgasteEl = document.getElementById("desgaste");
const ativoEl = document.getElementById("ativo");
const obsEl = document.getElementById("observacoes");
const msgEl = document.getElementById("msg");
const listaEl = document.getElementById("listaMateriais");
const tituloEl = document.getElementById("formTitulo");

let ultimaReversao = null;

document.getElementById("salvarBtn").addEventListener("click", salvarMaterial);
document.getElementById("limparBtn").addEventListener("click", () => limparFormulario());

criarPainelReversao();
await garantirMateriaisPadrao();
await carregarMateriais();

async function garantirMateriaisPadrao() {
  const materiais = await buscarMateriais();
  const nomes = materiais.map(m => (m.nome || "").toLowerCase());

  const padroes = [
    { nome: "Ferro Fundido Cinzento", desgaste: 0 },
    { nome: "Ferro Fundido Nodular", desgaste: 50 }
  ];

  for (const padrao of padroes) {
    if (!nomes.includes(padrao.nome.toLowerCase())) {
      await addDoc(collection(db, "materiais"), {
        nome: padrao.nome,
        desgaste: padrao.desgaste,
        ativo: true,
        observacoes: "Material padrão do sistema",
        padrao: true,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
    }
  }
}

async function salvarMaterial() {
  const nome = nomeEl.value.trim();
  const desgaste = Number(desgasteEl.value);
  const ativo = ativoEl.value === "true";
  const observacoes = obsEl.value.trim();

  if (!nome) {
    msgEl.innerHTML = '<div class="alert">Informe o nome do material.</div>';
    return;
  }

  if (Number.isNaN(desgaste) || desgaste < 0 || desgaste > 100) {
    msgEl.innerHTML = '<div class="alert">Informe o desgaste entre 0% e 100%.</div>';
    return;
  }

  const dados = {
    nome,
    desgaste,
    ativo,
    observacoes,
    atualizadoEm: serverTimestamp()
  };

  try {
    if (idEl.value) {
      const materiaisAtuais = await buscarMateriais();
      const anterior = materiaisAtuais.find(m => m.id === idEl.value);

      if (anterior) {
        ultimaReversao = {
          tipo: "editar",
          id: idEl.value,
          dados: { ...anterior }
        };
      }

      await updateDoc(doc(db, "materiais", idEl.value), dados);
      msgEl.innerHTML = '<div class="ok">Material atualizado com sucesso.</div>';
    } else {
      const novoDoc = await addDoc(collection(db, "materiais"), {
        ...dados,
        criadoEm: serverTimestamp()
      });

      ultimaReversao = {
        tipo: "criar",
        id: novoDoc.id,
        dados: { id: novoDoc.id, ...dados }
      };

      msgEl.innerHTML = '<div class="ok">Material cadastrado com sucesso.</div>';
    }

    limparFormulario(false);
    await carregarMateriais();
    atualizarPainelReversao();
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao salvar: ${error.message}</div>`;
  }
}

async function buscarMateriais() {
  const snap = await getDocs(collection(db, "materiais"));
  const materiais = [];

  snap.forEach((docSnap) => {
    materiais.push({ id: docSnap.id, ...docSnap.data() });
  });

  return materiais;
}

async function carregarMateriais() {
  try {
    const materiais = await buscarMateriais();

    materiais.sort((a, b) => {
      const nomeA = (a.nome || "").toLowerCase();
      const nomeB = (b.nome || "").toLowerCase();
      return nomeA.localeCompare(nomeB, "pt-BR");
    });

    if (materiais.length === 0) {
      listaEl.innerHTML = "<p>Nenhum material cadastrado.</p>";
      return;
    }

    listaEl.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Material</th>
            <th>Desgaste</th>
            <th>Vida aplicada</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${materiais.map(m => {
            const desgaste = Number(m.desgaste || 0);
            const vidaAplicada = Math.max(0, 100 - desgaste);

            return `
              <tr>
                <td>
                  <strong>${m.nome || ""}</strong><br>
                  <small>${m.observacoes || ""}</small>
                </td>
                <td>${formatarNumero(desgaste)}%</td>
                <td>${formatarNumero(vidaAplicada)}% da vida do inserto</td>
                <td>${m.ativo !== false ? '<span class="badge">Ativo</span>' : '<span class="badge">Inativo</span>'}</td>
                <td>
                  <div class="actions">
                    <button class="secondary" onclick='editarMaterial(${JSON.stringify(m).replace(/'/g, "&apos;")})'>Editar</button>
                    <button class="danger" onclick='excluirMaterial("${m.id}")'>Excluir</button>
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
    listaEl.innerHTML = `<div class="alert">Erro ao carregar materiais: ${error.message}</div>`;
  }
}

window.editarMaterial = function(m) {
  idEl.value = m.id;
  nomeEl.value = m.nome || "";
  desgasteEl.value = m.desgaste ?? "";
  ativoEl.value = String(m.ativo !== false);
  obsEl.value = m.observacoes || "";
  tituloEl.textContent = "Editar material";
  msgEl.innerHTML = "";
};

window.excluirMaterial = async function(id) {
  if (!confirm("Deseja excluir este material?")) return;

  try {
    const materiaisAtuais = await buscarMateriais();
    const anterior = materiaisAtuais.find(m => m.id === id);

    if (anterior) {
      ultimaReversao = {
        tipo: "excluir",
        id,
        dados: { ...anterior }
      };
    }

    await deleteDoc(doc(db, "materiais", id));
    await carregarMateriais();
    atualizarPainelReversao();
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao excluir: ${error.message}</div>`;
  }
};

function limparFormulario(limparMsg = true) {
  idEl.value = "";
  nomeEl.value = "";
  desgasteEl.value = "";
  ativoEl.value = "true";
  obsEl.value = "";
  tituloEl.textContent = "Adicionar material";

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

  const nome = ultimaReversao.dados?.nome || "material";
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
      await updateDoc(doc(db, "materiais", ultimaReversao.id), {
        nome: dados.nome || "",
        desgaste: Number(dados.desgaste || 0),
        ativo: dados.ativo !== false,
        observacoes: dados.observacoes || "",
        atualizadoEm: serverTimestamp()
      });
    }

    if (ultimaReversao.tipo === "excluir") {
      delete dados.id;

      await addDoc(collection(db, "materiais"), {
        ...dados,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
    }

    if (ultimaReversao.tipo === "criar") {
      await deleteDoc(doc(db, "materiais", ultimaReversao.id));
    }

    ultimaReversao = null;
    await carregarMateriais();
    atualizarPainelReversao();

    msgEl.innerHTML = '<div class="ok">Última alteração revertida com sucesso.</div>';
  } catch (error) {
    console.error(error);
    msgEl.innerHTML = `<div class="alert">Erro ao reverter: ${error.message}</div>`;
  }
}
