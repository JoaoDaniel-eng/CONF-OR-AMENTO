/* Início: resumo das conferências do mês */
async function paginaInicio(app) {
  const hoje = new Date();
  let ano = hoje.getFullYear(), mes = hoje.getMonth() + 1;

  async function carregar() {
    const r = await api.get(`/api/resumo?ano=${ano}&mes=${mes}`);
    const totConf = r.filiais.reduce((s, f) => s + f.conferidos, 0);
    const totIrr = r.filiais.reduce((s, f) => s + f.irregularidades, 0);
    const iniciadas = r.filiais.filter((f) => f.conferidos > 0).length;

    app.querySelector("#resumo").innerHTML = `
      <div class="indicador"><div class="valor">${r.filiais.length}</div><div class="rotulo">Filiais ativas</div></div>
      <div class="indicador ok"><div class="valor">${totConf}</div><div class="rotulo">Dias conferidos no mês</div></div>
      <div class="indicador"><div class="valor">${iniciadas}</div><div class="rotulo">Filiais com conferência iniciada</div></div>
      <div class="indicador ${totIrr ? "alerta" : ""}"><div class="valor">${totIrr}</div><div class="rotulo">Irregularidades registradas</div></div>`;

    app.querySelector("#tabela").innerHTML = r.filiais.map((f) => `
      <tr>
        <td><a href="#/conferencias?filial=${f.id}">${esc(f.nome)}</a></td>
        <td class="num ${f.conferidos ? "" : "zero"}">${f.conferidos}</td>
        <td class="num ${f.nao_uteis ? "" : "zero"}">${f.nao_uteis}</td>
        <td class="num">${f.irregularidades ? `<span class="selo erro">${f.irregularidades}</span>` : '<span class="zero">0</span>'}</td>
      </tr>`).join("");
  }

  app.innerHTML = `
    <div class="barra">
      <label>Mês <select id="f-mes">${opcoesMeses(mes)}</select></label>
      <label>Ano <select id="f-ano">${opcoesAnos(ano)}</select></label>
    </div>
    <div class="resumo" id="resumo"></div>
    <section class="painel">
      <div class="painel-titulo">Situação por filial <small>Dados do mês selecionado</small></div>
      <table>
        <thead><tr><th>Filial</th><th class="num">Dias conferidos</th><th class="num">Domingos/feriados</th><th class="num">Irregularidades</th></tr></thead>
        <tbody id="tabela"></tbody>
      </table>
    </section>`;

  app.querySelector("#f-mes").onchange = (e) => { mes = +e.target.value; carregar(); };
  app.querySelector("#f-ano").onchange = (e) => { ano = +e.target.value; carregar(); };
  await carregar();
}
