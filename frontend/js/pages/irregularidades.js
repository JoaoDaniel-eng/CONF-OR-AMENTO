/* Irregularidades: uma aba por categoria, cadastro por boleta, edição e exclusão */
let _ultimaFilialIrr = 0;
let _ultimaDataIrr = "";

function dataBr(iso) {
  return `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

async function paginaIrregularidades(app) {
  const hoje = new Date();
  const hojeIso = dataIsoHoje();
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const [filiais, categorias] = await Promise.all([api.get("/api/filiais"), api.get("/api/categorias")]);

  let filialId = +q.get("filial") || 0;          // 0 = todas as filiais
  let ano = +q.get("ano") || hoje.getFullYear();
  let mes = q.has("mes") ? +q.get("mes") : hoje.getMonth() + 1;   // 0 = o ano todo
  let catId = +q.get("categoria") || 0;          // 0 = todas as categorias
  let busca = q.get("busca") || "";
  let dados = null;
  let pedido = 0;

  app.innerHTML = `
    <div class="barra">
      <label>Filial <select id="f-filial">
        <option value="0">Todas as filiais</option>
        ${filiais.map((f) => `<option value="${f.id}" ${f.id === filialId ? "selected" : ""}>${esc(f.nome)}</option>`).join("")}
      </select></label>
      <label>Mês <select id="f-mes"><option value="0" ${mes === 0 ? "selected" : ""}>Ano todo</option>${opcoesMeses(mes)}</select></label>
      <label>Ano <select id="f-ano">${opcoesAnos(ano)}</select></label>
      <label>Boleta <input type="text" id="f-busca" maxlength="30" placeholder="Buscar nº" autocomplete="off" value="${esc(busca)}"></label>
      <span class="espaco"></span>
      <button class="sec" id="btn-excel">Exportar Excel</button>
      <button id="btn-nova">Nova boleta</button>
    </div>
    <div class="abas" role="tablist" id="abas" aria-label="Categorias de irregularidade"></div>
    <section class="painel">
      <div class="painel-titulo"><span id="titulo-lista">Registros</span><small id="legenda"></small></div>
      <div class="rolagem" id="lista"></div>
    </section>`;

  const $ = (s) => app.querySelector(s);

  async function carregar() {
    const meu = ++pedido;
    const p = new URLSearchParams({ ano, mes });
    if (filialId) p.set("filial", filialId);
    if (catId) p.set("categoria", catId);
    if (busca.trim()) p.set("busca", busca.trim());
    const r = await api.get(`/api/irregularidades?${p}`);
    if (meu !== pedido) return;            // resposta antiga: já houve uma consulta mais recente
    dados = r;
    const h = new URLSearchParams({ ano, mes });
    if (filialId) h.set("filial", filialId);
    if (catId) h.set("categoria", catId);
    if (busca.trim()) h.set("busca", busca.trim());
    history.replaceState(null, "", `#/irregularidades?${h}`);
    desenhar();
  }
  const recarregar = () => carregar().catch((e) => aviso(e.message, "erro"));

  function desenhar() {
    const totalGeral = Object.values(dados.por_categoria).reduce((a, b) => a + b, 0);
    const aba = (id, nome, n) => `<button type="button" role="tab" class="aba ${id === catId ? "ativa" : ""}"
        aria-selected="${id === catId}" data-cat="${id}">${esc(nome)} <span class="selo ${n ? "erro" : ""}">${n}</span></button>`;
    $("#abas").innerHTML = aba(0, "Todas", totalGeral) +
      categorias.map((c) => aba(c.id, c.nome, dados.por_categoria[c.id] || 0)).join("");
    app.querySelectorAll(".aba").forEach((b) => (b.onclick = () => { catId = +b.dataset.cat; recarregar(); }));

    const cat = categorias.find((c) => c.id === catId);
    $("#titulo-lista").textContent = cat ? cat.nome : "Todas as irregularidades";
    $("#legenda").textContent = `${dados.total} registro(s)` +
      (dados.total > dados.itens.length ? ` · mostrando os ${dados.itens.length} mais recentes` : "") +
      ` · ${mes ? MESES[mes - 1] + " de " : ""}${ano}`;

    if (!dados.itens.length) {
      $("#lista").innerHTML = `<div class="vazio"><strong>Nenhuma irregularidade encontrada</strong>
        ${busca.trim() ? "Nenhuma boleta corresponde à busca neste período." : "Não há registros com os filtros selecionados."}</div>`;
      return;
    }
    $("#lista").innerHTML = `<table>
      <thead><tr><th>Data</th><th>Filial</th><th>Boleta</th>${cat ? "" : "<th>Irregularidade</th>"}<th>Observação</th><th class="acoes-col">Ações</th></tr></thead>
      <tbody>${dados.itens.map((i) => `<tr>
        <td>${dataBr(i.data)}</td>
        <td>${esc(i.filial)}</td>
        <td><strong>${esc(i.boleta)}</strong></td>
        ${cat ? "" : `<td>${esc(i.categoria)}</td>`}
        <td class="obs">${esc(i.observacao)}</td>
        <td class="acoes">
          <button type="button" class="sec mini" data-editar="${i.id}" aria-label="Editar boleta ${esc(i.boleta)}, ${esc(i.categoria)}">Editar</button>
          <button type="button" class="sec mini perigo" data-excluir="${i.id}" aria-label="Excluir boleta ${esc(i.boleta)}, ${esc(i.categoria)}">Excluir</button>
        </td></tr>`).join("")}</tbody></table>`;
    app.querySelectorAll("[data-editar]").forEach((b) => (b.onclick = () => abrirFormulario(dados.itens.find((x) => x.id === +b.dataset.editar))));
    app.querySelectorAll("[data-excluir]").forEach((b) => (b.onclick = () => excluir(dados.itens.find((x) => x.id === +b.dataset.excluir))));
  }

  async function excluir(i) {
    if (!confirm(`Excluir esta irregularidade?\n\nBoleta ${i.boleta} · ${i.categoria}\n${i.filial} · ${dataBr(i.data)}`)) return;
    try {
      await api.del(`/api/irregularidades?id=${i.id}`);
      aviso("Irregularidade excluída.");
      await carregar();
    } catch (err) { aviso(err.message, "erro"); carregar().catch(() => {}); }
  }

  /* Formulário único: novo (item = null, várias categorias) ou edição (uma categoria) */
  function abrirFormulario(item) {
    const edicao = !!item;
    const filialInicial = edicao ? item.filial_id : (_ultimaFilialIrr || filialId || filiais[0].id);
    const dataInicial = edicao ? item.data : (_ultimaDataIrr || hojeIso);
    const dlg = document.createElement("dialog");
    dlg.className = "janela larga";
    dlg.innerHTML = `
      <form method="dialog" id="form-irr" novalidate>
        <h2>${edicao ? "Editar irregularidade" : "Nova boleta com irregularidade"}</h2>
        <div class="grade-campos">
          <label class="campo">Filial
            <select id="i-filial">${filiais.map((f) => `<option value="${f.id}" ${f.id === filialInicial ? "selected" : ""}>${esc(f.nome)}</option>`).join("")}</select>
          </label>
          <label class="campo">Data da conferência
            <input type="date" id="i-data" value="${dataInicial}" max="${hojeIso}" min="2000-01-01">
          </label>
          <label class="campo">Número da boleta
            <input type="text" id="i-boleta" maxlength="30" autocomplete="off" value="${esc(edicao ? item.boleta : "")}">
          </label>
        </div>
        <fieldset>
          <legend>${edicao ? "Irregularidade" : "Irregularidades encontradas (marque uma ou mais)"}</legend>
          ${categorias.map((c) => `<label class="opcao"><input type="${edicao ? "radio" : "checkbox"}" name="cat" value="${c.id}"
              ${(edicao ? item.categoria_id === c.id : catId === c.id) ? "checked" : ""}> ${esc(c.nome)}</label>`).join("")}
        </fieldset>
        <label class="campo">Observação (opcional)
          <textarea id="i-obs" rows="2" maxlength="300">${esc(edicao ? item.observacao : "")}</textarea>
        </label>
        <p class="erro-form" id="erro-irr" role="alert"></p>
        <div class="botoes">
          <button type="button" class="sec" id="cancelar">${edicao ? "Cancelar" : "Fechar"}</button>
          ${edicao ? "" : '<button type="submit" class="sec" value="nova" id="salvar-nova">Salvar e cadastrar outra</button>'}
          <button type="submit" value="fechar" id="salvar">Salvar</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    const f = (s) => dlg.querySelector(s);
    const fechar = () => { dlg.close(); dlg.remove(); };
    f("#cancelar").onclick = fechar;
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); fechar(); });

    f("#form-irr").onsubmit = async (e) => {
      e.preventDefault();
      const manter = e.submitter?.value === "nova";
      const erro = f("#erro-irr");
      erro.textContent = "";
      const marcadas = [...dlg.querySelectorAll('input[name="cat"]:checked')].map((x) => +x.value);
      if (!f("#i-boleta").value.trim()) { erro.textContent = "Informe o número da boleta."; f("#i-boleta").focus(); return; }
      if (!f("#i-data").value) { erro.textContent = "Informe a data."; f("#i-data").focus(); return; }
      if (!marcadas.length) { erro.textContent = "Marque ao menos uma irregularidade."; return; }
      const base = { filial_id: +f("#i-filial").value, data: f("#i-data").value, boleta: f("#i-boleta").value, observacao: f("#i-obs").value };
      dlg.querySelectorAll("button[type=submit]").forEach((b) => (b.disabled = true));
      try {
        if (edicao) {
          await api.put("/api/irregularidades", { ...base, id: item.id, categoria_id: marcadas[0] });
          aviso("Irregularidade atualizada.");
        } else {
          const r = await api.post("/api/irregularidades", { ...base, categorias: marcadas });
          _ultimaFilialIrr = base.filial_id; _ultimaDataIrr = base.data;
          aviso(`Boleta ${base.boleta.trim()}: ${r.criadas.length} irregularidade(s) registrada(s).` +
                (r.repetidas.length ? ` ${r.repetidas.length} já existia(m).` : ""));
        }
        await carregar();
        if (manter) {
          f("#i-boleta").value = ""; f("#i-obs").value = "";
          dlg.querySelectorAll('input[name="cat"]').forEach((x) => (x.checked = +x.value === catId));
          dlg.querySelectorAll("button[type=submit]").forEach((b) => (b.disabled = false));
          f("#i-boleta").focus();
        } else fechar();
      } catch (err) {
        erro.textContent = err.message;
        dlg.querySelectorAll("button[type=submit]").forEach((b) => (b.disabled = false));
      }
    };
    dlg.showModal();
    f("#i-boleta").focus();
  }

  $("#f-filial").onchange = (e) => { filialId = +e.target.value; recarregar(); };
  $("#f-mes").onchange = (e) => { mes = +e.target.value; recarregar(); };
  $("#f-ano").onchange = (e) => { ano = +e.target.value; recarregar(); };
  let espera;
  $("#f-busca").oninput = (e) => { busca = e.target.value; clearTimeout(espera); espera = setTimeout(recarregar, 300); };
  $("#btn-nova").onclick = () => abrirFormulario(null);
  $("#btn-excel").onclick = () => {
    const p = new URLSearchParams({ ano, mes });
    if (filialId) p.set("filial", filialId);
    if (catId) p.set("categoria", catId);
    if (busca.trim()) p.set("busca", busca.trim());
    api.baixar(`/exportar/irregularidades?${p}`).catch((e) => aviso(e.message, "erro"));
  };

  await carregar();
}
