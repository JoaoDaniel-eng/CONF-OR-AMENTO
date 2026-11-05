/* Relatórios: totais, filial x categoria e resumos por período */
async function paginaRelatorios(app) {
  const hoje = new Date();
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const [filiais, categorias] = await Promise.all([api.get("/api/filiais"), api.get("/api/categorias")]);
  let ano = +q.get("ano") || hoje.getFullYear();
  let mes = q.has("mes") ? +q.get("mes") : hoje.getMonth() + 1;   // 0 = ano todo
  let filialId = +q.get("filial") || 0;
  let catId = +q.get("categoria") || 0;
  let pedido = 0;

  app.innerHTML = `
    <div class="barra nao-imprimir">
      <label>Mês <select id="r-mes"><option value="0" ${mes === 0 ? "selected" : ""}>Ano todo</option>${opcoesMeses(mes)}</select></label>
      <label>Ano <select id="r-ano">${opcoesAnos(ano)}</select></label>
      <label>Filial <select id="r-filial"><option value="0">Todas as filiais</option>
        ${filiais.map((f) => `<option value="${f.id}" ${f.id === filialId ? "selected" : ""}>${esc(f.nome)}</option>`).join("")}</select></label>
      <label>Categoria <select id="r-cat"><option value="0">Todas as categorias</option>
        ${categorias.map((c) => `<option value="${c.id}" ${c.id === catId ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></label>
      <span class="espaco"></span>
      <button class="sec" id="r-excel">Exportar Excel</button>
      <button class="sec" id="r-imprimir">Imprimir</button>
    </div>
    <p class="suave titulo-impressao" id="r-legenda"></p>
    <div id="r-corpo"></div>`;
  const $ = (s) => app.querySelector(s);
  const n = (v) => (v ? v : `<span class="zero">0</span>`);

  function filtrosUrl() {
    const p = new URLSearchParams({ ano, mes });
    if (filialId) p.set("filial", filialId);
    if (catId) p.set("categoria", catId);
    return p;
  }

  async function carregar() {
    const meu = ++pedido;
    const r = await api.get(`/api/relatorio?${filtrosUrl()}`);
    if (meu !== pedido) return;
    history.replaceState(null, "", `#/relatorios?${filtrosUrl()}`);
    desenhar(r);
  }
  const recarregar = () => carregar().catch((e) => aviso(e.message, "erro"));

  function desenhar(r) {
    const t = r.totais;
    const periodo = `${mes ? MESES[mes - 1] + " de " : "Ano de "}${ano}`;
    const escopo = [filialId ? filiais.find((f) => f.id === filialId)?.nome : "Todas as filiais",
                    catId ? categorias.find((c) => c.id === catId)?.nome : "Todas as categorias"].join(" · ");
    $("#r-legenda").textContent = `${periodo} · ${escopo}`;

    const cats = catId ? r.categorias.filter((c) => c.id === catId) : r.categorias;
    const totCat = Object.fromEntries(r.por_categoria.map((c) => [c.id, c.total]));
    const maior = Math.max(1, ...r.por_categoria.map((c) => c.total));
    const linkFilial = (f) => `#/irregularidades?filial=${f.id}&ano=${ano}&mes=${mes}${catId ? `&categoria=${catId}` : ""}`;

    $("#r-corpo").innerHTML = `
      <div class="resumo">
        <div class="indicador ${t.irregularidades ? "alerta" : ""}"><div class="valor">${t.irregularidades}</div><div class="rotulo">Irregularidades</div></div>
        <div class="indicador"><div class="valor">${t.boletas}</div><div class="rotulo">Boletas com irregularidade</div></div>
        <div class="indicador"><div class="valor">${t.filiais_com_irregularidade}</div><div class="rotulo">Filiais com irregularidade</div></div>
        <div class="indicador ok"><div class="valor">${t.conferidos}</div><div class="rotulo">Dias conferidos</div></div>
      </div>

      <section class="painel">
        <div class="painel-titulo">Irregularidades por filial e categoria <small>${esc(periodo)}</small></div>
        <div class="rolagem"><table class="matriz">
          <thead><tr><th>Filial</th>${cats.map((c) => `<th class="num cat-cab">${esc(c.nome)}</th>`).join("")}
            <th class="num">Total</th><th class="num">Boletas</th><th class="num">Dias conferidos</th></tr></thead>
          <tbody>${r.por_filial.map((f) => `<tr>
            <td><a href="${linkFilial(f)}">${esc(f.nome)}</a></td>
            ${cats.map((c) => `<td class="num">${n(f.categorias[c.id])}</td>`).join("")}
            <td class="num"><strong>${n(f.irregularidades)}</strong></td>
            <td class="num">${n(f.boletas)}</td>
            <td class="num">${n(f.conferidos)}</td></tr>`).join("")}</tbody>
          <tfoot><tr><td>Total</td>${cats.map((c) => `<td class="num">${totCat[c.id] || 0}</td>`).join("")}
            <td class="num">${t.irregularidades}</td><td class="num">${t.boletas}</td><td class="num">${t.conferidos}</td></tr></tfoot>
        </table></div>
      </section>

      <section class="painel espaco-topo">
        <div class="painel-titulo">Resumo por categoria <small>${esc(escopo)}</small></div>
        <div class="barras">${r.por_categoria.map((c) => `
          <div class="barra-linha"><span class="barra-nome">${esc(c.nome)}</span>
            <span class="barra-trilho"><span class="barra-valor" style="width:${(c.total / maior) * 100}%"></span></span>
            <span class="barra-num">${c.total}</span></div>`).join("")}</div>
      </section>

      ${r.por_mes.length ? `<section class="painel espaco-topo">
        <div class="painel-titulo">Evolução mensal <small>${ano}</small></div>
        <div class="rolagem"><table>
          <thead><tr><th>Mês</th><th class="num">Irregularidades</th><th class="num">Boletas</th></tr></thead>
          <tbody>${r.por_mes.map((m) => `<tr><td>${MESES[m.mes - 1]}</td><td class="num">${n(m.irregularidades)}</td><td class="num">${n(m.boletas)}</td></tr>`).join("")}</tbody>
        </table></div></section>` : ""}`;
  }

  $("#r-mes").onchange = (e) => { mes = +e.target.value; recarregar(); };
  $("#r-ano").onchange = (e) => { ano = +e.target.value; recarregar(); };
  $("#r-filial").onchange = (e) => { filialId = +e.target.value; recarregar(); };
  $("#r-cat").onchange = (e) => { catId = +e.target.value; recarregar(); };
  $("#r-imprimir").onclick = () => window.print();
  $("#r-excel").onclick = () => api.baixar(`/exportar/relatorio?${filtrosUrl()}`).catch((e) => aviso(e.message, "erro"));
  await carregar();
}
