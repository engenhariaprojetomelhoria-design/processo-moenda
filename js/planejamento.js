import { protegerPagina } from "./layout.js";
import { db, collection, getDocs } from "./firebase.js";

await protegerPagina("planejamento");

const maquinaEl = document.getElementById("maquina");
const materialEl = document.getElementById("material");
const diametroCamisaEl = document.getElementById("diametroCamisa");
const deslocamentoXEl = document.getElementById("deslocamentoX");
const profundidadeFuroEl = document.getElementById("profundidadeFuro");
const alturaFrisoEl = document.getElementById("alturaFriso");
const diametroFuroEl = document.getElementById("diametroFuro");
const metragemTotalEl = document.getElementById("metragemTotal");
const msgEl = document.getElementById("msg");
const resultadoEl = document.getElementById("resultadoPlanejamento");

let maquinas = [];
let materiais = [];
let ferramentas = [];
let insertos = [];

document.getElementById("calcularBtn").addEventListener("click", calcularPlanejamento);
document.getElementById("limparBtn").addEventListener("click", limparFormulario);

await carregarDados();

async function carregarDados() {
  maquinas = await buscarColecao("maquinas");
  materiais = await buscarColecao("materiais");
  ferramentas = await buscarColecao("ferramentas");
  insertos = await buscarColecao("insertos");

  preencherSelect(maquinaEl, maquinas.filter(m => m.ativa !== false), "Selecione a máquina", "nome");
  preencherSelectMaterial();
}

async function buscarColecao(nome) {
  const snap = await getDocs(collection(db, nome));
  const itens = [];
  snap.forEach(d => itens.push({ id: d.id, ...d.data() }));
  return itens;
}

function preencherSelect(el, itens, placeholder, campo) {
  itens.sort((a, b) => (a[campo] || "").localeCompare(b[campo] || "", "pt-BR"));
  el.innerHTML = itens.length
    ? `<option value="">${placeholder}</option>` + itens.map(i => `<option value="${i.id}">${i[campo] || ""}</option>`).join("")
    : `<option value="">Nenhum item ativo cadastrado</option>`;
}

function preencherSelectMaterial() {
  const ativos = materiais.filter(m => m.ativo !== false);
  ativos.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  materialEl.innerHTML = ativos.length
    ? '<option value="">Selecione o material</option>' + ativos.map(m => `<option value="${m.id}">${m.nome || ""} — desgaste ${formatarNumero(m.desgaste || 0)}%</option>`).join("")
    : '<option value="">Nenhum material ativo cadastrado</option>';
}

function calcularPlanejamento() {
  msgEl.innerHTML = "";
  const maquina = maquinas.find(m => m.id === maquinaEl.value);
  const material = materiais.find(m => m.id === materialEl.value);

  const diametroCamisa = Number(diametroCamisaEl.value);
  const deslocamentoX = Number(deslocamentoXEl.value);
  const profundidadeFuro = Number(profundidadeFuroEl.value);
  const alturaFriso = Number(alturaFrisoEl.value);
  const diametroFuro = Number(diametroFuroEl.value);
  const metragemTotal = Number(metragemTotalEl.value);

  if (!maquina) return erro("Selecione a máquina.");
  if (!material) return erro("Selecione o material.");
  if (!diametroCamisa || diametroCamisa <= 0) return erro("Informe o diâmetro da camisa.");
  if (!deslocamentoX || deslocamentoX <= 0) return erro("Informe o deslocamento maior em X.");
  if (!profundidadeFuro || profundidadeFuro <= 0) return erro("Informe a profundidade do furo.");
  if (alturaFriso < 0 || Number.isNaN(alturaFriso)) return erro("Informe a altura do friso.");
  if (!diametroFuro || diametroFuro <= 0) return erro("Informe o diâmetro do furo.");
  if (!metragemTotal || metragemTotal <= 0) return erro("Informe a metragem total a usinar.");

  const calculo = calcularComprimento(diametroCamisa, deslocamentoX, profundidadeFuro, alturaFriso, diametroFuro);
  if (!calculo.valido) return erro(calculo.mensagem);

  const diametroBroca = diametroFuro > 16 ? 18 : 16;
  const limiteCurta = diametroBroca === 18 ? 172.5 : 153;
  const tipoComprimento = calculo.R11 <= limiteCurta ? "curta" : "longa";

  const ferramentasOk = ferramentas
    .filter(f => f.ativa !== false)
    .filter(f => Number(f.diametro) === diametroBroca)
    .filter(f => Number(f.comprimento) >= calculo.R11)
    .sort((a, b) => Number(a.comprimento || 0) - Number(b.comprimento || 0));

  if (!ferramentasOk.length) {
    resultadoEl.innerHTML = `<div class="alert"><h3>Nenhuma ferramenta compatível</h3><p>Broca necessária: <strong>${diametroBroca} — ${tipoComprimento}</strong></p><p>Comprimento necessário: <strong>${formatarNumero(calculo.R11)} mm</strong></p></div>`;
    return;
  }

  const desgaste = Number(material.desgaste || 0);
  const sugestoes = [];

  for (const ferramenta of ferramentasOk) {
    const compativeis = insertos
      .filter(i => i.ativo !== false)
      .filter(i => String(i.marca || "") === String(ferramenta.fabricante || ""))
      .filter(i => Number(i.diametro) === Number(ferramenta.diametro));

    const usados = compativeis.filter(i => i.tipo === "usado").sort((a, b) => Number(b.vidaResidual || 0) - Number(a.vidaResidual || 0));
    const novos = compativeis.filter(i => i.tipo !== "usado").sort((a, b) => Number(b.vidaTotal || b.vidaSegura || 0) - Number(a.vidaTotal || a.vidaSegura || 0));

    const usado = usados[0] || null;
    const novo = novos[0] || null;

    const vidaUsadoReal = usado ? aplicarDesgaste(Number(usado.vidaResidual || 0), desgaste) : 0;
    const vidaNovoReal = novo ? aplicarDesgaste(Number(novo.vidaTotal || novo.vidaSegura || 0), desgaste) : 0;

    if (usado && vidaUsadoReal >= metragemTotal) {
      sugestoes.push({ ferramenta, inserto: usado, tipo: "usado", vidaReal: vidaUsadoReal, quantidade: 1 });
    } else if (novo && vidaNovoReal > 0) {
      sugestoes.push({ ferramenta, inserto: novo, tipo: "novo", vidaReal: vidaNovoReal, quantidade: Math.ceil(metragemTotal / vidaNovoReal) });
    }
  }

  if (!sugestoes.length) {
    resultadoEl.innerHTML = `<div class="alert"><h3>Nenhum inserto compatível</h3><p>Cadastre um inserto ativo com mesma marca e diâmetro da ferramenta.</p></div>`;
    return;
  }

  sugestoes.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === "usado" ? -1 : 1;
    if (a.quantidade !== b.quantidade) return a.quantidade - b.quantidade;
    return Number(a.ferramenta.comprimento || 0) - Number(b.ferramenta.comprimento || 0);
  });

  const s = sugestoes[0];

  resultadoEl.innerHTML = `
    <div>
      <h3>Ferramenta recomendada</h3>
      <p><strong>${s.ferramenta.nome || "-"}</strong></p>
      <p>Tipo calculado: <strong>Broca ${diametroBroca} — ${tipoComprimento}</strong></p>
      <p>Comprimento necessário: <strong>${formatarNumero(calculo.R11)} mm</strong></p>
      <p>Comprimento da ferramenta: <strong>${formatarNumero(s.ferramenta.comprimento)} mm</strong></p>
      <hr>
      <h3>Inserto recomendado</h3>
      <p>Tipo: <strong>${s.tipo === "usado" ? "Usado residual" : "Novo"}</strong></p>
      <p><strong>${s.inserto.marca || ""} ${s.inserto.modelo || ""} Ø${s.inserto.diametro || s.ferramenta.diametro} mm</strong></p>
      <hr>
      <h3>Cálculo</h3>
      <p>Máquina: <strong>${maquina.nome || "-"}</strong></p>
      <p>Material: <strong>${material.nome || "-"}</strong></p>
      <p>Desgaste: <strong>${formatarNumero(desgaste)}%</strong></p>
      <p>Vida real por inserto: <strong>${formatarNumero(s.vidaReal)} m</strong></p>
      <p>Metragem solicitada: <strong>${formatarNumero(metragemTotal)} m</strong></p>
      <p>Quantidade necessária: <strong>${s.quantidade}</strong></p>
    </div>
  `;
}

function calcularComprimento(R0, R1, R2, R3, R4) {
  const R5 = R0 / 2;
  const R6 = 32;
  const R7 = R1 - R6;
  const R8 = R5 - R3;
  const baseR9 = (R5 ** 2) - (R7 ** 2);
  const baseR10 = (R8 ** 2) - ((R1 - R4 / 2) ** 2);

  if (baseR9 < 0) return { valido: false, mensagem: "Geometria inválida no cálculo R9." };
  if (baseR10 < 0) return { valido: false, mensagem: "Geometria inválida no cálculo R10." };

  const R9 = Math.sqrt(baseR9);
  const R10 = Math.sqrt(baseR10);
  const R11 = R9 - R10 + R2;

  return { valido: true, R11 };
}

function aplicarDesgaste(vida, desgaste) {
  return vida * Math.max(0, 1 - Number(desgaste || 0) / 100);
}

function erro(msg) {
  msgEl.innerHTML = `<div class="alert">${msg}</div>`;
  resultadoEl.innerHTML = "Corrija os dados para calcular.";
}

function limparFormulario() {
  diametroCamisaEl.value = "";
  deslocamentoXEl.value = "";
  profundidadeFuroEl.value = "";
  alturaFrisoEl.value = "";
  diametroFuroEl.value = "";
  metragemTotalEl.value = "";
  msgEl.innerHTML = "";
  resultadoEl.innerHTML = "Preencha os dados e clique em calcular.";
}

function formatarNumero(valor) {
  if (valor === undefined || valor === null || valor === "") return "-";
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
