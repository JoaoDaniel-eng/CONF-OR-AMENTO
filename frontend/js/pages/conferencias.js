/* Conferências: calendário mensal por filial */
let _ultimoResponsavel = "";

const SITUACAO_ROTULO = { pendente: "Pendente", conferido: "Conferido", nao_util: "Domingo/feriado" };
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_LONGO = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function dataIsoHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dataExtenso(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS_SEMANA_LONGO[dt.getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
}

async function paginaConferencias(app) {
  const hoje = new Date();
  const hojeIso = dataIsoHoje();
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const filiais = await api.get("/api/filiais");
  if (!filiais.length) {
    app.innerHTML = `<div class="painel"><div class="vazio"><strong>Nenhuma filial ativa</strong></div></div>`;
    return;
  }
  let filialId = +q.get("filial") || filiais[0].id;
  if (!filiais.some((f) => f.id === filialId)) filialId = filiais[0].id;
  let ano = +q.get("ano") || hoje.getFullYear();
  let mes = +q.get("mes") || hoje.getMonth() + 1;
  let dados = null;

  app.innerHTML = `
    <div class="barra">
      <label>Filial <select id="f-filial">${filiais.map((f) =>
        `<option value="${f.id}" ${f.id === filialId ? "selected" : ""}>${esc(f.nome)}</option>`).join("")}</select></label>
      <button class="sec" id="mes-ant" aria-label="Mês anterior">‹</button>
      <label>Mês <select id="f-mes">${opcoesMeses(mes)}</select></label>
      <label>Ano <select id="f-ano">${opcoesAnos(ano)}</select></label>
      <button class="sec" id="mes-prox" aria-label="Próximo mês">›</button>
      <span class="espaco"></span>
      <button class="sec" id="btn-excel">Exportar mês (Excel)</button>
      <button class="sec" id="btn-domingos">Marcar domingos</button>
    </div>
    <div class="resumo" id="resumo"></div>
    <section class="painel">
      <div class="painel-titulo">Calendário <small id="legenda"></small></div>
      <div class="calendario" id="calendario"></div>
    </section>
    <datalist id="lista-resp"></datalist>`;

  const $ = (s) => app.querySelector(s);

  async function carregar() {
    dados = await api.get(`/api/conferencias?filial=${filialId}&ano=${ano}&mes=${mes}`);
    history.replaceState(null, "", `#/conferencias?filial=${filialId}&ano=${ano}&mes=${mes}`);
    desenhar();
  }

  function desenhar() {
    const dias = dados.dias;
    const conf = dias.filter((d) => d.situacao === "conferido").length;
    const nu = dias.filter((d) => d.situacao === "nao_util").length;
    const pend = dias.filter((d) => d.situacao === "pendente" && d.data <= hojeIso).length;
    const irr = dias.reduce((s, d) => s + d.irregularidades, 0);
    $("#resumo").innerHTML = `
      <div class="indicador ok"><div class="valor">${conf}</div><div class="rotulo">Dias conferidos</div></div>
      <div class="indicador ${pend ? "pend" : ""}"><div class="valor">${pend}</div><div class="rotulo">Dias pendentes até hoje</div></div>
      <div class="indicador"><div class="valor">${nu}</div><div class="rotulo">Domingos/feriados</div></div>
      <div class="indicador ${irr ? "alerta" : ""}"><div class="valor">${irr}</div><div class="rotulo">Irregularidades no mês</div></div>`;
    $("#legenda").textContent = `${dados.filial.nome} · ${MESES[mes - 1]} de ${ano}`;

    const primeiro = new Date(ano, mes - 1, 1).getDay();
    let h = DIAS_SEMANA.map((n) => `<div class="cab-dia">${n}</div>`).join("");
    h += '<div class="dia fora"></div>'.repeat(primeiro);
    h += dias.map((d) => {
      const n = +d.data.slice(8);
      const futuro = d.data > hojeIso;
      const detalhe = d.situacao === "conferido" ? esc(d.responsavel)
        : d.situacao === "nao_util" ? "Não útil" : (futuro ? "" : "Pendente");
      const rotulo = `${dataExtenso(d.data)}: ${SITUACAO_ROTULO[d.situacao]}` +
        (d.responsavel ? `, responsável ${d.responsavel}` : "") +
        (d.irregularidades ? `, ${d.irregularidades} irregularidade(s)` : "");
      return `<button type="button" class="dia ${d.situacao} ${d.data === hojeIso ? "hoje" : ""} ${futuro ? "futuro" : ""}"
          data-data="${d.data}" aria-label="${esc(rotulo)}">
        <span class="dia-num">${n}</span>
        <span class="dia-info">${detalhe}</span>
        ${d.irregularidades ? `<span class="selo erro dia-irr">${d.irregularidades}</span>` : ""}
      </button>`;
    }).join("");
    $("#calendario").innerHTML = h;
    app.querySelectorAll(".dia[data-data]").forEach((b) => (b.onclick = () => abrirDia(b.dataset.data)));
  }

  async function abrirDia(data) {
    const d = dados.dias.find((x) => x.data === data);
    const futuro = data > hojeIso;
    let sugestoes = [];
    try { sugestoes = await api.get("/api/responsaveis"); } catch { /* sugestões são opcionais */ }
    $("#lista-resp").innerHTML = sugestoes.map((r) => `<option value="${esc(r)}">`).join("");

    const dlg = document.createElement("dialog");
    dlg.className = "janela";
    dlg.innerHTML = `
      <form method="dialog" id="form-dia">
        <h2>${esc(dataExtenso(data))}</h2>
        <p class="suave">${esc(dados.filial.nome)}</p>
        <fieldset>
          <legend>Situação do dia</legend>
          <label class="opcao"><input type="radio" name="sit" value="conferido" ${futuro ? "disabled" : ""}> Conferido</label>
          <label class="opcao"><input type="radio" name="sit" value="nao_util"> Domingo/feriado (não útil)</label>
          <label class="opcao"><input type="radio" name="sit" value="pendente"> Pendente${d.situacao !== "pendente" ? " (reabrir)" : ""}</label>
        </fieldset>
        <label id="campo-resp" class="campo">Responsável pela conferência
          <input type="text" id="resp" list="lista-resp" maxlength="80" autocomplete="off">
        </label>
        ${d.irregularidades ? `<p class="suave">Este dia tem ${d.irregularidades} irregularidade(s) registrada(s).</p>` : ""}
        ${d.concluido_em ? `<p class="suave">Conferido em ${esc(d.concluido_em)}</p>` : ""}
        <p class="erro-form" id="erro-dia" role="alert"></p>
        <div class="botoes">
          <button type="button" class="sec" id="cancelar">Cancelar</button>
          <button type="submit" id="salvar">Salvar</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    const radios = dlg.querySelectorAll('input[name="sit"]');
    const resp = dlg.querySelector("#resp");
    const marcado = d.situacao === "pendente" && !futuro ? "conferido" : (d.situacao === "pendente" ? "nao_util" : d.situacao);
    radios.forEach((r) => (r.checked = r.value === marcado));
    resp.value = d.responsavel || _ultimoResponsavel;
    const situacaoAtual = () => dlg.querySelector('input[name="sit"]:checked')?.value;
    const atualizarCampo = () => { dlg.querySelector("#campo-resp").hidden = situacaoAtual() !== "conferido"; };
    radios.forEach((r) => (r.onchange = atualizarCampo));
    atualizarCampo();

    const fechar = () => { dlg.close(); dlg.remove(); };
    dlg.querySelector("#cancelar").onclick = fechar;
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); fechar(); });
    dlg.querySelector("#form-dia").onsubmit = async (e) => {
      e.preventDefault();
      const sit = situacaoAtual();
      const erro = dlg.querySelector("#erro-dia");
      erro.textContent = "";
      if (sit === "conferido" && !resp.value.trim()) {
        erro.textContent = "Informe o responsável pela conferência.";
        resp.focus();
        return;
      }
      const btn = dlg.querySelector("#salvar");
      btn.disabled = true;
      try {
        await api.put("/api/conferencias", { filial_id: filialId, data, situacao: sit, responsavel: resp.value });
        if (sit === "conferido") _ultimoResponsavel = resp.value.trim();
        fechar();
        aviso("Dia atualizado.");
        await carregar();
      } catch (err) {
        erro.textContent = err.message;
        btn.disabled = false;
      }
    };
    dlg.showModal();
    (marcado === "conferido" ? resp : radios[0]).focus();
  }

  $("#f-filial").onchange = (e) => { filialId = +e.target.value; carregar().catch((x) => aviso(x.message, "erro")); };
  const mudarPeriodo = () => {
    $("#f-mes").value = mes; $("#f-ano").value = ano;
    carregar().catch((x) => aviso(x.message, "erro"));
  };
  $("#f-mes").onchange = (e) => { mes = +e.target.value; mudarPeriodo(); };
  $("#f-ano").onchange = (e) => { ano = +e.target.value; mudarPeriodo(); };
  const limites = [hoje.getFullYear() - 6, hoje.getFullYear() + 1];
  function deslocar(delta) {
    let m = mes + delta, a = ano;
    if (m < 1) { m = 12; a--; } else if (m > 12) { m = 1; a++; }
    if (a < limites[0] || a > limites[1]) return;
    mes = m; ano = a; mudarPeriodo();
  }
  $("#mes-ant").onclick = () => deslocar(-1);
  $("#mes-prox").onclick = () => deslocar(1);
  $("#btn-excel").onclick = () =>
    api.baixar(`/exportar/conferencias?ano=${ano}&mes=${mes}`).catch((e) => aviso(e.message, "erro"));
  $("#btn-domingos").onclick = async () => {
    if (!confirm(`Marcar como "Domingo/feriado" todos os domingos ainda pendentes de ${MESES[mes - 1]} de ${ano} em ${dados.filial.nome}?`)) return;
    try {
      const r = await api.post("/api/conferencias/domingos", { filial_id: filialId, ano, mes });
      aviso(r.marcados ? `${r.marcados} domingo(s) marcado(s).` : "Nenhum domingo pendente neste mês.");
      await carregar();
    } catch (err) { aviso(err.message, "erro"); }
  };

  await carregar();
}
