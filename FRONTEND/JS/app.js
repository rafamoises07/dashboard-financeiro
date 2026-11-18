const CHAVE = "financas:v1";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const FORMAS = ["Pix", "Débito", "Crédito", "Dinheiro", "Boleto"];
const TITULOS = {
  visao: ["Visão geral", "Seu mês em números"],
  movs: ["Movimentações", "Tudo que entrou e saiu no mês"],
  cats: ["Categorias", "Organize seus lançamentos"]
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const uid = () => Math.random().toString(36).slice(2, 10);
const soma = (l) => l.reduce((a, t) => a + t.valor, 0);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtData = (d) => { const [y, m, dia] = d.split("-"); return `${dia} ${CURTOS[m - 1]} ${y}`; };

function dadosIniciais() {
  const cats = [
    { id: "renda", nome: "Renda", tipo: "receita", cor: "#8b5cf6" },
    { id: "moradia", nome: "Moradia", tipo: "despesa", cor: "#7c5ce0" },
    { id: "alimentacao", nome: "Alimentação", tipo: "despesa", cor: "#ec6aa0" },
    { id: "transporte", nome: "Transporte", tipo: "despesa", cor: "#fdba8c" },
    { id: "lazer", nome: "Lazer", tipo: "despesa", cor: "#c4b5fd" }
  ];
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);
  const y0 = inicio.getFullYear();
  const m0 = inicio.getMonth() + 1;
  const fixo = (descricao, valor, categoriaId, dia, forma) =>
    ({ id: uid(), tipo: "despesa", descricao, valor, data: iso(y0, m0, dia), categoriaId, natureza: "fixo", forma, recorrente: true });
  const tx = [
    { id: uid(), tipo: "receita", descricao: "Salário", valor: 4000, data: iso(y0, m0, 5), categoriaId: "renda", recorrente: true },
    fixo("Aluguel", 1200, "moradia", 6, "Boleto"),
    fixo("Internet", 120, "moradia", 10, "Débito"),
    fixo("Academia", 180, "lazer", 12, "Crédito")
  ];
  const variaveis = [
    ["Supermercado", "alimentacao", "Débito", [250, 310, 280, 260, 300, 290], 7],
    ["Restaurante", "alimentacao", "Crédito", [140, 160, 120, 180, 150, 170], 14],
    ["Combustível", "transporte", "Pix", [180, 150, 210, 170, 190, 200], 9],
    ["Cinema e passeios", "lazer", "Pix", [120, 90, 150, 200, 110, 140], 20]
  ];
  for (let i = 0; i < 6; i++) {
    const d = new Date(y0, m0 - 1 + i, 1);
    variaveis.forEach(([descricao, categoriaId, forma, valores, dia]) => {
      tx.push({ id: uid(), tipo: "despesa", descricao, valor: valores[i], data: iso(d.getFullYear(), d.getMonth() + 1, dia), categoriaId, natureza: "variavel", forma, recorrente: false });
    });
  }
  return { cats, tx };
}

function carregar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE));
    if (salvo && salvo.tx && salvo.cats) return salvo;
  } catch (e) {}
  return dadosIniciais();
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch (e) {}
}

const dados = carregar();
const hoje = new Date();
const ui = { view: "visao", ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };

const cat = (id) => dados.cats.find((c) => c.id === id) || { nome: "Sem categoria", cor: "#64748b" };

function ocorrencias(ano, mes) {
  const saida = [];
  for (const t of dados.tx) {
    const [ty, tm, td] = t.data.split("-").map(Number);
    if (t.recorrente) {
      if (ty * 12 + tm <= ano * 12 + mes) saida.push({ ...t, data: iso(ano, mes, Math.min(td, 28)) });
    } else if (ty === ano && tm === mes) {
      saida.push(t);
    }
  }
  return saida.sort((a, b) => b.data.localeCompare(a.data));
}

function resumo(lista) {
  const receitas = soma(lista.filter((t) => t.tipo === "receita"));
  const fixos = soma(lista.filter((t) => t.tipo === "despesa" && t.natureza === "fixo"));
  const variaveis = soma(lista.filter((t) => t.tipo === "despesa" && t.natureza !== "fixo"));
  return { receitas, fixos, variaveis, resultado: receitas - fixos - variaveis };
}

function kpi(classe, icone, rotulo, valor, destaque) {
  return `<article class="kpi"><span class="ico ${classe}" aria-hidden="true">${icone}</span><div><p>${rotulo}</p><strong class="${destaque || ""}">${brl.format(valor)}</strong></div></article>`;
}

function barras() {
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    let m = ui.mes - i;
    let a = ui.ano;
    while (m < 1) { m += 12; a--; }
    const r = resumo(ocorrencias(a, m));
    meses.push({ rotulo: CURTOS[m - 1], receitas: r.receitas, despesas: r.fixos + r.variaveis });
  }
  const maior = Math.max(...meses.flatMap((x) => [x.receitas, x.despesas]));
  const topo = Math.max(1000, Math.ceil(maior / 1000) * 1000);
  const W = 560, H = 250, esq = 46, base = 28, cima = 10;
  const area = H - base - cima;
  const grupo = (W - esq - 8) / meses.length;
  const bw = grupo * 0.28;
  const y = (v) => cima + area - (v / topo) * area;
  let svg = "";
  for (let i = 0; i <= 4; i++) {
    const v = (topo / 4) * i;
    svg += `<line x1="${esq}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}" stroke="#252a45"/><text x="${esq - 8}" y="${y(v) + 4}" text-anchor="end">${v.toLocaleString("pt-BR")}</text>`;
  }
  meses.forEach((m, i) => {
    const x = esq + i * grupo + grupo * 0.2;
    svg += `<rect x="${x}" y="${y(m.receitas)}" width="${bw}" height="${cima + area - y(m.receitas)}" rx="3" fill="#8b5cf6"><title>Receitas: ${brl.format(m.receitas)}</title></rect>`;
    svg += `<rect x="${x + bw + 4}" y="${y(m.despesas)}" width="${bw}" height="${cima + area - y(m.despesas)}" rx="3" fill="#ec6aa0"><title>Despesas: ${brl.format(m.despesas)}</title></rect>`;
    svg += `<text x="${x + bw}" y="${H - 8}" text-anchor="middle">${m.rotulo}</text>`;
  });
  return `<div class="legenda"><span><i class="dot" style="background:#8b5cf6"></i>Receitas</span><span><i class="dot" style="background:#ec6aa0"></i>Despesas</span></div><svg class="barras" viewBox="0 0 ${W} ${H}" role="img" aria-label="Receitas e despesas dos últimos seis meses">${svg}</svg>`;
}

function rosca(lista) {
  const porCategoria = {};
  lista.filter((t) => t.tipo === "despesa").forEach((t) => { porCategoria[t.categoriaId] = (porCategoria[t.categoriaId] || 0) + t.valor; });
  const itens = Object.entries(porCategoria).map(([id, v]) => ({ c: cat(id), v })).sort((a, b) => b.v - a.v);
  const total = soma(itens);
  if (!total) return `<p class="vazio">Nenhuma despesa neste mês.</p>`;
  const R = 70, C = 2 * Math.PI * R;
  let deslocamento = 0;
  const arcos = itens.map((i) => {
    const len = (i.v / total) * C;
    const arco = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${i.c.cor}" stroke-width="32" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-deslocamento}" transform="rotate(-90 100 100)"/>`;
    deslocamento += len;
    return arco;
  }).join("");
  const legenda = itens.map((i) => `<li><i class="dot" style="background:${i.c.cor}"></i>${esc(i.c.nome)}<b>${Math.round((i.v / total) * 100)}%</b></li>`).join("");
  return `<div class="rosca"><svg viewBox="0 0 200 200" role="img" aria-label="Despesas por categoria">${arcos}<text x="100" y="96" text-anchor="middle" class="svg-muted">Total</text><text x="100" y="116" text-anchor="middle" class="svg-forte">${brl.format(total)}</text></svg><ul>${legenda}</ul></div>`;
}

function tabela(lista, completa) {
  const linhas = lista.map((t) => {
    const c = cat(t.categoriaId);
    const sinal = t.tipo === "receita" ? "+" : "-";
    const extras = completa
      ? `<td class="col-sm">${t.tipo === "despesa" ? (t.natureza === "fixo" ? "Fixo" : "Variável") : "—"}</td><td class="col-sm">${t.tipo === "despesa" ? esc(t.forma) : "—"}</td>`
      : "";
    const acoes = completa ? `<td class="acoes"><button data-edit="${t.id}">Editar</button><button data-del="${t.id}">Excluir</button></td>` : "";
    return `<tr><td>${esc(t.descricao)}${t.recorrente ? ' <span class="rec" title="Repete todo mês">↻</span>' : ""}</td><td><i class="dot" style="background:${c.cor}"></i>${esc(c.nome)}</td><td class="col-sm">${fmtData(t.data)}</td>${extras}<td class="num ${t.tipo}">${sinal} ${brl.format(t.valor)}</td>${acoes}</tr>`;
  }).join("");
  if (!linhas) return `<p class="vazio">Nenhuma movimentação neste mês. Use o botão Nova movimentação para adicionar.</p>`;
  const extraCab = completa ? `<th class="col-sm">Tipo</th><th class="col-sm">Pagamento</th>` : "";
  return `<div class="tabela"><table><thead><tr><th>Descrição</th><th>Categoria</th><th class="col-sm">Data</th>${extraCab}<th class="num">Valor</th>${completa ? "<th></th>" : ""}</tr></thead><tbody>${linhas}</tbody></table></div>`;
}

function renderVisao() {
  const lista = ocorrencias(ui.ano, ui.mes);
  const r = resumo(lista);
  $("#visao").innerHTML =
    `<div class="kpis">${kpi("up", "↑", "Receitas", r.receitas)}${kpi("down", "↓", "Gastos fixos", r.fixos)}${kpi("down", "↓", "Gastos variáveis", r.variaveis)}${kpi("up", "▮", "Resultado do mês", r.resultado, r.resultado < 0 ? "negativo" : "destaque")}</div>` +
    `<div class="graficos"><section class="card"><h3>Receitas e despesas</h3>${barras()}</section><section class="card"><h3>Despesas por categoria</h3>${rosca(lista)}</section></div>` +
    `<section class="card"><h3>Últimas movimentações</h3>${tabela(lista.slice(0, 5), false)}</section>`;
}

function renderMovs() {
  $("#movs").innerHTML = `<section class="card">${tabela(ocorrencias(ui.ano, ui.mes), true)}</section>`;
}

function renderCats() {
  const itens = dados.cats.map((c) =>
    `<li><i class="dot" style="background:${c.cor}"></i>${esc(c.nome)}<small>${c.tipo === "receita" ? "Receita" : "Despesa"}</small><button data-delcat="${c.id}">Excluir</button></li>`
  ).join("");
  $("#cats").innerHTML =
    `<div class="graficos"><section class="card"><h3>Suas categorias</h3><ul class="lista-cats">${itens}</ul></section>` +
    `<section class="card"><h3>Nova categoria</h3><form id="form-cat" class="form"><label>Nome<input name="nome" required maxlength="30"></label><label>Tipo<select name="tipo"><option value="despesa">Despesa</option><option value="receita">Receita</option></select></label><label>Cor<input type="color" name="cor" value="#a78bfa"></label><button class="primary">Adicionar categoria</button></form></section></div>`;
}

function render() {
  const [titulo, subtitulo] = TITULOS[ui.view];
  $("#titulo").textContent = titulo;
  $("#subtitulo").textContent = ui.view === "cats" ? subtitulo : `${subtitulo}: ${MESES[ui.mes - 1]} de ${ui.ano}`;
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === ui.view));
  document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== ui.view; });
  $("#periodo").hidden = ui.view === "cats";
  $("#mes").value = ui.mes;
  $("#ano").value = ui.ano;
  if (ui.view === "visao") renderVisao();
  if (ui.view === "movs") renderMovs();
  if (ui.view === "cats") renderCats();
}

function opcoesCategorias(tipo, selecionada) {
  $("#form").categoriaId.innerHTML = dados.cats
    .filter((c) => c.tipo === tipo)
    .map((c) => `<option value="${c.id}"${c.id === selecionada ? " selected" : ""}>${esc(c.nome)}</option>`)
    .join("");
  $("#campos-despesa").hidden = tipo !== "despesa";
}

function abrirModal(t) {
  const f = $("#form");
  const tipo = t ? t.tipo : "despesa";
  f.reset();
  f.movId.value = t ? t.id : "";
  f.tipo.value = tipo;
  f.descricao.value = t ? t.descricao : "";
  f.valor.value = t ? t.valor : "";
  f.data.value = t ? t.data : iso(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate());
  f.natureza.value = (t && t.natureza) || "variavel";
  f.forma.value = (t && t.forma) || "Pix";
  f.recorrente.checked = !!(t && t.recorrente);
  opcoesCategorias(tipo, t && t.categoriaId);
  $("#modal-titulo").textContent = t ? "Editar movimentação" : "Nova movimentação";
  $("#modal").showModal();
}

function iniciar() {
  $("#mes").innerHTML = MESES.map((n, i) => `<option value="${i + 1}">${n}</option>`).join("");
  const anos = [];
  for (let a = hoje.getFullYear() - 3; a <= hoje.getFullYear() + 1; a++) anos.push(a);
  $("#ano").innerHTML = anos.map((a) => `<option value="${a}">${a}</option>`).join("");
  $("#form").forma.innerHTML = FORMAS.map((f) => `<option>${f}</option>`).join("");
  $("#novo").setAttribute("aria-label", "Nova movimentação");

  $("#mes").addEventListener("change", (e) => { ui.mes = Number(e.target.value); render(); });
  $("#ano").addEventListener("change", (e) => { ui.ano = Number(e.target.value); render(); });
  $("#novo").addEventListener("click", () => abrirModal());
  $("#cancelar").addEventListener("click", () => $("#modal").close());
  $("#form").addEventListener("change", (e) => {
    if (e.target.name === "tipo") opcoesCategorias(e.target.value);
  });

  $("#nav").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    ui.view = b.dataset.view;
    render();
  });

  document.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    const delCat = e.target.closest("[data-delcat]");
    if (edit) abrirModal(dados.tx.find((t) => t.id === edit.dataset.edit));
    if (del && confirm("Excluir esta movimentação? Se ela se repete todo mês, todas as ocorrências somem.")) {
      dados.tx = dados.tx.filter((t) => t.id !== del.dataset.del);
      salvar();
      render();
    }
    if (delCat) {
      const id = delCat.dataset.delcat;
      if (dados.tx.some((t) => t.categoriaId === id)) {
        alert("Essa categoria tem movimentações. Edite ou exclua essas movimentações antes.");
        return;
      }
      dados.cats = dados.cats.filter((c) => c.id !== id);
      salvar();
      render();
    }
  });

  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const tipo = f.tipo.value;
    const item = {
      id: f.movId.value || uid(),
      tipo,
      descricao: f.descricao.value.trim(),
      valor: Math.round(parseFloat(f.valor.value) * 100) / 100,
      data: f.data.value,
      categoriaId: f.categoriaId.value,
      recorrente: f.recorrente.checked
    };
    if (tipo === "despesa") {
      item.natureza = f.natureza.value;
      item.forma = f.forma.value;
    }
    if (!item.descricao || !(item.valor > 0) || !item.categoriaId) return;
    const i = dados.tx.findIndex((t) => t.id === item.id);
    if (i >= 0) dados.tx[i] = item; else dados.tx.push(item);
    salvar();
    const [a, m] = item.data.split("-").map(Number);
    ui.ano = a;
    ui.mes = m;
    $("#modal").close();
    render();
  });

  document.addEventListener("submit", (e) => {
    if (e.target.id !== "form-cat") return;
    e.preventDefault();
    const f = e.target;
    const nome = f.nome.value.trim();
    if (!nome) return;
    dados.cats.push({ id: uid(), nome, tipo: f.tipo.value, cor: f.cor.value });
    salvar();
    render();
  });

  render();
}

iniciar();
