/* Pesquisa global: encontra uma boleta em qualquer filial/dia e mostra todas as suas irregularidades */
async function paginaPesquisa(app) {
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  let termo = q.get("q") || "";
  let pedido = 0;
  let espera;

  app.innerHTML = `
    <div class="barra">
      <label class="busca-grande">Número da boleta
        <input type="text" id="p-busca" maxlength="30" autocomplete="off" placeholder="Digite o número (ou parte dele)" value="${esc(termo)}">
      </label>
    </div>
    <div id="p-resultado" aria-live="polite"></div>`;
  const $ = (s) => app.querySelector(s);
  const campo = $("#p-busca");

  function aguardando() {
    $("#p-resultado").innerHTML = `<section class="painel"><div class="vazio"><strong>Pesquise uma boleta</strong>
      Mostra a filial, a data e todas as irregularidades registradas para ela, em qualquer mês.</div></section>`;
  }

  async function buscar() {
    const t = campo.value.trim();
    termo = t;
    history.replaceState(null, "", t ? `#/pesquisa?q=${encodeURIComponent(t)}` : "#/pesquisa");
    if (!t) { pedido++; aguardando(); return; }
    const meu = ++pedido;
    let r;
    try { r = await api.get(`/api/pesquisa?q=${encodeURIComponent(t)}`); }
    catch (e) { if (meu === pedido) $("#p-resultado").innerHTML = `<div class="erro-form">${esc(e.message)}</div>`; return; }
    if (meu !== pedido) return;

    if (!r.total) {
      $("#p-resultado").innerHTML = `<section class="painel"><div class="vazio"><strong>Boleta não encontrada</strong>
        Nenhuma irregularidade registrada para “${esc(r.termo)}”.</div></section>`;
      return;
    }
    const cartoes = r.resultados.map((g) => {
      const mes = +g.data.slice(5, 7), ano = +g.data.slice(0, 4);
      return `<article class="painel ocorrencia">
        <div class="ocorrencia-cab">
          <div><span class="boleta-num">${esc(g.boleta)}</span>${g.exata ? "" : ' <span class="suave">(contém o número buscado)</span>'}</div>
          <span class="selo erro">${g.irregularidades.length} irregularidade(s)</span>
        </div>
        <dl class="ocorrencia-dados">
          <div><dt>Filial</dt><dd>${esc(g.filial)}</dd></div>
          <div><dt>Data</dt><dd>${dataBr(g.data)}</dd></div>
          <div><dt>Conferência do dia</dt><dd>${esc(SITUACAO_ROTULO[g.situacao] || g.situacao)}</dd></div>
        </dl>
        <ul class="lista-irr">${g.irregularidades.map((i) => `<li><strong>${esc(i.categoria)}</strong>${i.observacao ? `<span class="suave"> — ${esc(i.observacao)}</span>` : ""}</li>`).join("")}</ul>
        <div class="ocorrencia-links">
          <a href="#/irregularidades?filial=${g.filial_id}&ano=${ano}&mes=${mes}&busca=${encodeURIComponent(g.boleta)}">Editar nas irregularidades</a>
          <a href="#/conferencias?filial=${g.filial_id}&ano=${ano}&mes=${mes}">Ver calendário do mês</a>
        </div>
      </article>`;
    }).join("");
    $("#p-resultado").innerHTML = `<p class="suave contagem">${r.total} ocorrência(s) encontrada(s)` +
      (r.total > r.resultados.length ? ` · mostrando as ${r.resultados.length} primeiras; refine o número` : "") + `</p>${cartoes}`;
  }

  campo.oninput = () => { clearTimeout(espera); espera = setTimeout(buscar, 300); };
  campo.onkeydown = (e) => { if (e.key === "Enter") { clearTimeout(espera); buscar(); } };
  if (termo) await buscar(); else aguardando();
  campo.focus();
}
