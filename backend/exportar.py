"""Exportação para Excel (.xlsx). Etapa 5a. Usa as mesmas regras e filtros das telas."""
import calendar
from datetime import date, datetime

import routes
import xlsx
from routes import ErroAPI

MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
         "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
SITUACAO = {"pendente": "Pendente", "conferido": "Conferido", "nao_util": "Domingo/feriado"}
TITULO = "Conferência de Orçamentos — SHOP15"


def _get(q, chave):
    return ((q.get(chave) or [""])[0]).strip()


def _periodo(q, mes_obrigatorio=False):
    hoje = date.today()
    ano = routes._inteiro(_get(q, "ano") or hoje.year, "ano")
    mes = routes._inteiro(_get(q, "mes") or (hoje.month if mes_obrigatorio else 0), "mês")
    if not (2000 <= ano <= 2100 and 0 <= mes <= 12) or (mes_obrigatorio and not mes):
        raise ErroAPI("Mês ou ano inválido.")
    return ano, mes


def _rotulo_periodo(ano, mes):
    return f"{MESES[mes - 1]} de {ano}" if mes else f"Ano de {ano}"


def _sufixo(ano, mes):
    return f"{ano:04d}-{mes:02d}" if mes else f"{ano:04d}"


def _data_hora(texto):
    try:
        return datetime.strptime(texto, "%Y-%m-%d %H:%M:%S").strftime("%d/%m/%Y %H:%M")
    except (TypeError, ValueError):
        return texto or ""


def _iso(texto):
    return date(int(texto[:4]), int(texto[5:7]), int(texto[8:10]))


# ---------------------------------------------------------------- Relatório
def relatorio(con, q):
    _, r = routes.relatorio(con, query=q)
    ano, mes, t = r["ano"], r["mes"], r["totais"]
    cats = [c for c in r["categorias"] if not r["categoria_id"] or c["id"] == r["categoria_id"]]
    periodo = _rotulo_periodo(ano, mes)
    escopo = " · ".join([r["por_filial"][0]["nome"] if r["filial_id"] else "Todas as filiais",
                         cats[0]["nome"] if r["categoria_id"] else "Todas as categorias"])
    sub = f"{periodo} · {escopo}"

    p1 = xlsx.Planilha("Filial x categoria", [18] + [15] * len(cats) + [12, 12, 14])
    p1.add((f"{TITULO} — Irregularidades por filial e categoria", xlsx.TITULO))
    p1.add((sub, xlsx.SUBTITULO))
    p1.add()
    cab = p1.add(*[(h, xlsx.CAB) for h in ["Filial"] + [c["nome"] for c in cats] + ["Total", "Boletas", "Dias conferidos"]],
                 altura=48)
    for f in r["por_filial"]:
        p1.add(f["nome"], *[f["categorias"].get(str(c["id"]), 0) for c in cats],
               (f["irregularidades"], xlsx.NEG), f["boletas"], f["conferidos"])
    fim = len(p1.linhas)
    tot_cat = {c["id"]: c["total"] for c in r["por_categoria"]}
    p1.add(("Total", xlsx.TOTAL), *[(tot_cat.get(c["id"], 0), xlsx.TOTAL) for c in cats],
           (t["irregularidades"], xlsx.TOTAL), (t["boletas"], xlsx.TOTAL), (t["conferidos"], xlsx.TOTAL))
    p1.congelar, p1.filtro = (cab, 1), (cab, fim)

    p2 = xlsx.Planilha("Por categoria", [36, 14, 14])
    p2.add((f"{TITULO} — Resumo por categoria", xlsx.TITULO))
    p2.add((sub, xlsx.SUBTITULO))
    p2.add()
    cab2 = p2.add(*[(h, xlsx.CAB) for h in ["Categoria", "Irregularidades", "% do total"]], altura=30)
    soma = sum(c["total"] for c in r["por_categoria"])
    for c in r["por_categoria"]:
        p2.add(c["nome"], c["total"], ((c["total"] / soma) if soma else 0, xlsx.PCT))
    p2.add(("Total", xlsx.TOTAL), (soma, xlsx.TOTAL), (1 if soma else 0, xlsx.PCT))
    p2.congelar = (cab2, 0)

    folhas = [p1, p2]
    if r["por_mes"]:
        p3 = xlsx.Planilha("Por mês", [16, 16, 12])
        p3.add((f"{TITULO} — Evolução mensal", xlsx.TITULO))
        p3.add((sub, xlsx.SUBTITULO))
        p3.add()
        cab3 = p3.add(*[(h, xlsx.CAB) for h in ["Mês", "Irregularidades", "Boletas"]], altura=30)
        for m in r["por_mes"]:
            p3.add(MESES[m["mes"] - 1], m["irregularidades"], m["boletas"])
        p3.add(("Total", xlsx.TOTAL), (sum(m["irregularidades"] for m in r["por_mes"]), xlsx.TOTAL),
               (sum(m["boletas"] for m in r["por_mes"]), xlsx.TOTAL))
        p3.congelar = (cab3, 0)
        folhas.append(p3)
    return f"relatorio-{_sufixo(ano, mes)}.xlsx", xlsx.gerar(folhas)


# ---------------------------------------------------------- Irregularidades
def irregularidades(con, q):
    onde, params = [], []
    if _get(q, "filial"):
        onde.append("c.filial_id = ?")
        params.append(routes._inteiro(_get(q, "filial"), "filial"))
    if _get(q, "categoria"):
        onde.append("i.categoria_id = ?")
        params.append(routes._inteiro(_get(q, "categoria"), "categoria"))
    ano = mes = None
    if _get(q, "ano"):
        ano, mes = _periodo(q)
        onde.append("c.data LIKE ?")
        params.append(f"{ano:04d}-{mes:02d}-%" if mes else f"{ano:04d}-%")
    if _get(q, "busca"):
        txt = _get(q, "busca").replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        onde.append("i.boleta LIKE ? ESCAPE '\\'")
        params.append(f"%{txt}%")
    filtro = (" WHERE " + " AND ".join(onde)) if onde else ""
    linhas = con.execute(f"""
        SELECT c.data, f.nome AS filial, i.boleta, k.nome AS categoria, i.observacao, i.criado_em
        FROM irregularidades i
        JOIN conferencias c ON c.id = i.conferencia_id
        JOIN filiais f ON f.id = c.filial_id
        JOIN categorias_irregularidade k ON k.id = i.categoria_id
        {filtro} ORDER BY c.data, f.codigo, i.boleta, k.ordem""", params).fetchall()

    p = xlsx.Planilha("Irregularidades", [12, 18, 16, 34, 45, 18])
    cab = p.add(*[(h, xlsx.CAB) for h in ["Data", "Filial", "Boleta", "Categoria", "Observação", "Registrado em"]],
                altura=30)
    for l in linhas:
        p.add((_iso(l["data"]), xlsx.DATA), l["filial"], str(l["boleta"]), l["categoria"],
              l["observacao"] or "", _data_hora(l["criado_em"]))
    p.congelar, p.filtro = (cab, 0), (cab, len(p.linhas))
    return f"irregularidades-{_sufixo(ano, mes) if ano else 'todas'}.xlsx", xlsx.gerar([p])


# ------------------------------------------------------------- Conferências
def conferencias(con, q):
    ano, mes = _periodo(q, mes_obrigatorio=False)
    if not _get(q, "ano") and not _get(q, "mes"):
        ano, mes = _periodo(q, mes_obrigatorio=True)
    filial_id = routes._inteiro(_get(q, "filial"), "filial") if _get(q, "filial") else None
    sql = "SELECT id, codigo, nome FROM filiais WHERE ativa = 1" + (" AND id = ?" if filial_id else "") + " ORDER BY codigo"
    filiais = con.execute(sql, (filial_id,) if filial_id else ()).fetchall()
    if not filiais:
        raise ErroAPI("Filial não encontrada.", 404)

    prefixo = f"{ano:04d}-{mes:02d}-%" if mes else f"{ano:04d}-%"
    reg = {(r["filial_id"], r["data"]): r for r in con.execute("""
        SELECT c.filial_id, c.data, c.situacao, c.responsavel, c.concluido_em,
               (SELECT COUNT(*) FROM irregularidades i WHERE i.conferencia_id = c.id) AS irreg
        FROM conferencias c WHERE c.data LIKE ?""", (prefixo,))}
    if mes:
        datas = [date(ano, mes, d) for d in range(1, calendar.monthrange(ano, mes)[1] + 1)]
    else:
        datas = [date.fromordinal(n) for n in range(date(ano, 1, 1).toordinal(), date(ano, 12, 31).toordinal() + 1)]
    hoje = date.today()
    periodo = _rotulo_periodo(ano, mes)
    escopo = filiais[0]["nome"] if filial_id else "Todas as filiais"

    detalhe = xlsx.Planilha("Conferências", [18, 12, 15, 17, 24, 18, 14])
    cab = detalhe.add(*[(h, xlsx.CAB) for h in ["Filial", "Data", "Dia da semana", "Situação", "Responsável",
                                                  "Concluído em", "Irregularidades"]], altura=30)
    for f in filiais:
        for d in datas:
            r = reg.get((f["id"], d.isoformat()))
            detalhe.add(f["nome"], (d, xlsx.DATA), DIAS[d.weekday()], SITUACAO[r["situacao"]] if r else "Pendente",
                        (r["responsavel"] if r else "") or "", _data_hora(r["concluido_em"]) if r else "",
                        r["irreg"] if r else 0)
    detalhe.congelar, detalhe.filtro = (cab, 0), (cab, len(detalhe.linhas))

    folhas = [detalhe]
    if mes:
        cal = xlsx.Planilha("Calendário", [18] + [4.5] * len(datas) + [11, 18])
        cal.add((f"{TITULO} — Calendário de conferências", xlsx.TITULO))
        cal.add((f"{periodo} · {escopo} · C = conferido · — = domingo/feriado · vazio = pendente",
                 xlsx.SUBTITULO))
        cal.add()
        cab_c = cal.add(*[(h, xlsx.CAB) for h in ["Filial"] + [d.day for d in datas] + ["Conferidos", "Pendentes (até hoje)"]],
                        altura=45)
        for f in filiais:
            conf = pend = 0
            celulas = [f["nome"]]
            for d in datas:
                r = reg.get((f["id"], d.isoformat()))
                s = r["situacao"] if r else "pendente"
                celulas.append(("C" if s == "conferido" else "—" if s == "nao_util" else "", xlsx.CENTRO))
                conf += s == "conferido"
                pend += s == "pendente" and d <= hoje
            cal.add(*celulas, (conf, xlsx.CENTRO), (pend, xlsx.CENTRO))
        cal.congelar = (cab_c, 1)
        folhas.insert(0, cal)
    nome = f"conferencias-{_sufixo(ano, mes)}" + (f"-filial-{filiais[0]['codigo']}" if filial_id else "") + ".xlsx"
    return nome, xlsx.gerar(folhas)


EXPORTACOES = {
    "/exportar/relatorio": relatorio,
    "/exportar/irregularidades": irregularidades,
    "/exportar/conferencias": conferencias,
}


def gerar(con, caminho, query):
    fn = EXPORTACOES.get(caminho.rstrip("/"))
    if not fn:
        raise ErroAPI("Exportação não encontrada.", 404)
    return fn(con, query or {})
