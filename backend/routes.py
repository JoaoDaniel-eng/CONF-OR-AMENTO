"""Rotas da API. Cada etapa acrescenta rotas aqui sem alterar as anteriores."""
import calendar
import sqlite3
from datetime import date, datetime


class ErroAPI(Exception):
    def __init__(self, msg, status=400):
        super().__init__(msg)
        self.status = status


def filiais(con, **_):
    linhas = con.execute("SELECT id, codigo, nome FROM filiais WHERE ativa = 1 ORDER BY codigo").fetchall()
    return 200, [dict(r) for r in linhas]


def categorias(con, **_):
    linhas = con.execute("SELECT id, nome, ordem FROM categorias_irregularidade ORDER BY ordem").fetchall()
    return 200, [dict(r) for r in linhas]


def resumo(con, query=None, **_):
    """Resumo do mês para a tela Início (a Etapa 2 passa a preencher os dados)."""
    hoje = date.today()
    q = query or {}
    ano = int(q.get("ano", [hoje.year])[0])
    mes = int(q.get("mes", [hoje.month])[0])
    prefixo = f"{ano:04d}-{mes:02d}-%"
    linhas = con.execute("""
        SELECT f.id, f.nome,
          COALESCE(SUM(c.situacao = 'conferido'), 0) AS conferidos,
          COALESCE(SUM(c.situacao = 'nao_util'), 0)  AS nao_uteis,
          (SELECT COUNT(*) FROM irregularidades i JOIN conferencias c2 ON c2.id = i.conferencia_id
            WHERE c2.filial_id = f.id AND c2.data LIKE ?) AS irregularidades
        FROM filiais f LEFT JOIN conferencias c ON c.filial_id = f.id AND c.data LIKE ?
        WHERE f.ativa = 1 GROUP BY f.id ORDER BY f.codigo
    """, (prefixo, prefixo)).fetchall()
    return 200, {"ano": ano, "mes": mes, "filiais": [dict(r) for r in linhas]}


def saude(con, **_):
    con.execute("SELECT 1")
    return 200, {"ok": True}


# ---------------------------------------------------------------- Etapa 2: conferências
SITUACOES = ("pendente", "conferido", "nao_util")


def _inteiro(valor, nome):
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ErroAPI(f"Valor inválido para {nome}.")


def _filial(con, filial_id):
    f = con.execute("SELECT id, codigo, nome FROM filiais WHERE id = ? AND ativa = 1", (filial_id,)).fetchone()
    if not f:
        raise ErroAPI("Filial não encontrada.", 404)
    return f


def _periodo(ano, mes):
    if not (2000 <= ano <= 2100 and 1 <= mes <= 12):
        raise ErroAPI("Mês ou ano inválido.")


def _dia(con, filial_id, data):
    r = con.execute("""
        SELECT c.id, c.data, c.situacao, c.responsavel, c.concluido_em,
               (SELECT COUNT(*) FROM irregularidades i WHERE i.conferencia_id = c.id) AS irregularidades
        FROM conferencias c WHERE c.filial_id = ? AND c.data = ?""", (filial_id, data)).fetchone()
    if r:
        return dict(r)
    return {"id": None, "data": data, "situacao": "pendente", "responsavel": None,
            "concluido_em": None, "irregularidades": 0}


def _historico(con, entidade_id, acao, detalhe):
    con.execute("INSERT INTO historico (entidade, entidade_id, acao, detalhe) VALUES ('conferencia', ?, ?, ?)",
                (entidade_id, acao, detalhe))


def conferencias_mes(con, query=None, **_):
    """Todos os dias de um mês para uma filial (dias sem registro aparecem como pendentes)."""
    q = query or {}
    filial = _filial(con, _inteiro((q.get("filial") or [None])[0], "filial"))
    hoje = date.today()
    ano = _inteiro((q.get("ano") or [hoje.year])[0], "ano")
    mes = _inteiro((q.get("mes") or [hoje.month])[0], "mês")
    _periodo(ano, mes)
    prefixo = f"{ano:04d}-{mes:02d}-%"
    linhas = con.execute("""
        SELECT c.id, c.data, c.situacao, c.responsavel, c.concluido_em,
               (SELECT COUNT(*) FROM irregularidades i WHERE i.conferencia_id = c.id) AS irregularidades
        FROM conferencias c WHERE c.filial_id = ? AND c.data LIKE ?""", (filial["id"], prefixo)).fetchall()
    por_data = {r["data"]: dict(r) for r in linhas}
    dias = []
    for n in range(1, calendar.monthrange(ano, mes)[1] + 1):
        data = f"{ano:04d}-{mes:02d}-{n:02d}"
        dias.append(por_data.get(data) or {"id": None, "data": data, "situacao": "pendente",
                                           "responsavel": None, "concluido_em": None, "irregularidades": 0})
    return 200, {"filial": dict(filial), "ano": ano, "mes": mes, "dias": dias}


def registrar_conferencia(con, corpo=None, **_):
    """Define a situação de um dia: conferido (exige responsável), não útil, ou pendente (reabre)."""
    c = corpo or {}
    filial = _filial(con, _inteiro(c.get("filial_id"), "filial"))
    try:
        data = date.fromisoformat(str(c.get("data", "")))
    except ValueError:
        raise ErroAPI("Data inválida.")
    situacao = c.get("situacao")
    if situacao not in SITUACOES:
        raise ErroAPI("Situação inválida.")
    responsavel = (c.get("responsavel") or "").strip() or None
    if situacao == "conferido":
        if not responsavel:
            raise ErroAPI("Informe o responsável pela conferência.")
        if data > date.today():
            raise ErroAPI("Não é possível marcar como conferido um dia que ainda não chegou.")
    if len(responsavel or "") > 80:
        raise ErroAPI("Nome do responsável muito longo (máximo 80 caracteres).")

    iso = data.isoformat()
    atual = _dia(con, filial["id"], iso)
    if situacao == "nao_util" and atual["irregularidades"]:
        raise ErroAPI("Este dia tem irregularidades registradas. Remova-as antes de marcá-lo como domingo/feriado.", 409)
    if situacao == "pendente":
        responsavel = None
    concluido = datetime.now().strftime("%Y-%m-%d %H:%M:%S") if situacao == "conferido" else None
    nome = {"pendente": "reaberto", "conferido": "conferido", "nao_util": "marcado como não útil"}[situacao]
    detalhe = f"{filial['nome']} · {iso} · de {atual['situacao']} para {situacao}" + \
              (f" · responsável: {responsavel}" if responsavel else "")

    if atual["id"] is None:
        if situacao == "pendente":
            return 200, atual
        cur = con.execute(
            "INSERT INTO conferencias (filial_id, data, situacao, responsavel, concluido_em) VALUES (?,?,?,?,?)",
            (filial["id"], iso, situacao, responsavel, concluido))
        conf_id = cur.lastrowid
    else:
        conf_id = atual["id"]
        con.execute("""UPDATE conferencias SET situacao = ?, responsavel = ?, concluido_em = ?,
                       atualizado_em = datetime('now','localtime') WHERE id = ?""",
                    (situacao, responsavel, concluido, conf_id))
    _historico(con, conf_id, nome, detalhe)
    return 200, _dia(con, filial["id"], iso)


def marcar_domingos(con, corpo=None, **_):
    """Marca como não úteis todos os domingos ainda pendentes do mês (feriados são marcados à mão)."""
    c = corpo or {}
    filial = _filial(con, _inteiro(c.get("filial_id"), "filial"))
    ano, mes = _inteiro(c.get("ano"), "ano"), _inteiro(c.get("mes"), "mês")
    _periodo(ano, mes)
    marcados = 0
    for n in range(1, calendar.monthrange(ano, mes)[1] + 1):
        d = date(ano, mes, n)
        if d.weekday() != 6:
            continue
        cur = con.execute("INSERT OR IGNORE INTO conferencias (filial_id, data, situacao) VALUES (?, ?, 'nao_util')",
                          (filial["id"], d.isoformat()))
        marcados += cur.rowcount
    if marcados:
        _historico(con, None, "domingos marcados", f"{filial['nome']} · {ano:04d}-{mes:02d} · {marcados} domingo(s)")
    return 200, {"marcados": marcados}


def responsaveis(con, **_):
    """Nomes já usados, do mais recente ao mais antigo (sugestões para o campo Responsável)."""
    linhas = con.execute("""
        SELECT responsavel FROM conferencias WHERE responsavel IS NOT NULL
        GROUP BY responsavel ORDER BY MAX(atualizado_em) DESC LIMIT 30""").fetchall()
    return 200, [r["responsavel"] for r in linhas]


# ---------------------------------------------------------------- Etapa 3: irregularidades
LIMITE_LISTA = 500


def _boleta(valor):
    b = " ".join(str(valor or "").split())
    if not b:
        raise ErroAPI("Informe o número da boleta.")
    if len(b) > 30:
        raise ErroAPI("Número da boleta muito longo (máximo 30 caracteres).")
    return b


def _observacao(valor):
    o = (str(valor).strip() if valor else "") or None
    if o and len(o) > 300:
        raise ErroAPI("Observação muito longa (máximo 300 caracteres).")
    return o


def _data_irreg(valor):
    try:
        d = date.fromisoformat(str(valor or ""))
    except ValueError:
        raise ErroAPI("Data inválida.")
    if d.year < 2000:
        raise ErroAPI("Data inválida.")
    if d > date.today():
        raise ErroAPI("Não é possível registrar irregularidade em um dia que ainda não chegou.")
    return d.isoformat()


def _categoria(con, cat_id):
    c = con.execute("SELECT id, nome FROM categorias_irregularidade WHERE id = ?", (cat_id,)).fetchone()
    if not c:
        raise ErroAPI("Categoria não encontrada.", 404)
    return c


def _conferencia_do_dia(con, filial, iso):
    """Devolve o id da conferência do dia (criando-a como pendente se ainda não existir)."""
    atual = _dia(con, filial["id"], iso)
    if atual["situacao"] == "nao_util":
        raise ErroAPI(f"{iso[8:]}/{iso[5:7]}/{iso[:4]} está marcado como domingo/feriado em {filial['nome']}. "
                      "Reabra o dia na tela Conferências para registrar irregularidades.", 409)
    if atual["id"] is not None:
        return atual["id"]
    return con.execute("INSERT INTO conferencias (filial_id, data, situacao) VALUES (?, ?, 'pendente')",
                       (filial["id"], iso)).lastrowid


def _historico_irreg(con, irr_id, acao, detalhe):
    con.execute("INSERT INTO historico (entidade, entidade_id, acao, detalhe) VALUES ('irregularidade', ?, ?, ?)",
                (irr_id, acao, detalhe))


def _irregularidade(con, irr_id):
    r = con.execute("""
        SELECT i.id, i.boleta, i.observacao, i.criado_em, i.categoria_id, k.nome AS categoria,
               c.id AS conferencia_id, c.data, f.id AS filial_id, f.nome AS filial
        FROM irregularidades i
        JOIN conferencias c ON c.id = i.conferencia_id
        JOIN filiais f ON f.id = c.filial_id
        JOIN categorias_irregularidade k ON k.id = i.categoria_id
        WHERE i.id = ?""", (irr_id,)).fetchone()
    if not r:
        raise ErroAPI("Registro não encontrado (talvez já tenha sido excluído por outra pessoa).", 404)
    return r


def _resumo_irreg(r):
    return f"{r['filial']} · {r['data']} · boleta {r['boleta']} · {r['categoria']}"


def listar_irregularidades(con, query=None, **_):
    """Lista filtrada (filial, período, categoria, boleta) + contagem por categoria para as abas."""
    q = query or {}
    get = lambda k: ((q.get(k) or [""])[0]).strip()
    onde, params = [], []
    if get("filial"):
        onde.append("c.filial_id = ?")
        params.append(_inteiro(get("filial"), "filial"))
    if get("ano"):
        ano = _inteiro(get("ano"), "ano")
        mes = _inteiro(get("mes") or 0, "mês")
        if not (2000 <= ano <= 2100 and 0 <= mes <= 12):
            raise ErroAPI("Mês ou ano inválido.")
        onde.append("c.data LIKE ?")
        params.append(f"{ano:04d}-{mes:02d}-%" if mes else f"{ano:04d}-%")
    if get("busca"):
        txt = get("busca").replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        onde.append("i.boleta LIKE ? ESCAPE '\\'")
        params.append(f"%{txt}%")
    base = """FROM irregularidades i
              JOIN conferencias c ON c.id = i.conferencia_id
              JOIN filiais f ON f.id = c.filial_id
              JOIN categorias_irregularidade k ON k.id = i.categoria_id"""
    filtro = (" WHERE " + " AND ".join(onde)) if onde else ""

    contagem = {r["categoria_id"]: r["n"] for r in con.execute(
        f"SELECT i.categoria_id, COUNT(*) AS n {base}{filtro} GROUP BY i.categoria_id", params)}

    onde_lista, params_lista = list(onde), list(params)
    if get("categoria"):
        onde_lista.append("i.categoria_id = ?")
        params_lista.append(_inteiro(get("categoria"), "categoria"))
    filtro_lista = (" WHERE " + " AND ".join(onde_lista)) if onde_lista else ""
    total = con.execute(f"SELECT COUNT(*) {base}{filtro_lista}", params_lista).fetchone()[0]
    linhas = con.execute(f"""
        SELECT i.id, i.boleta, i.observacao, i.categoria_id, k.nome AS categoria,
               c.data, f.id AS filial_id, f.nome AS filial
        {base}{filtro_lista}
        ORDER BY c.data DESC, f.codigo, i.boleta, k.ordem LIMIT {LIMITE_LISTA}""", params_lista).fetchall()
    return 200, {"total": total, "limite": LIMITE_LISTA, "por_categoria": contagem,
                 "itens": [dict(r) for r in linhas]}


def criar_irregularidades(con, corpo=None, **_):
    """Cadastro por boleta: uma boleta pode receber várias categorias de uma vez."""
    c = corpo or {}
    filial = _filial(con, _inteiro(c.get("filial_id"), "filial"))
    iso = _data_irreg(c.get("data"))
    boleta = _boleta(c.get("boleta"))
    obs = _observacao(c.get("observacao"))
    cats = c.get("categorias")
    if not isinstance(cats, list) or not cats:
        raise ErroAPI("Marque ao menos uma irregularidade.")
    ids = list(dict.fromkeys(_inteiro(x, "categoria") for x in cats))
    categorias_ = [_categoria(con, i) for i in ids]

    conf_id = _conferencia_do_dia(con, filial, iso)
    criadas, repetidas = [], []
    for cat in categorias_:
        cur = con.execute("INSERT OR IGNORE INTO irregularidades (conferencia_id, boleta, categoria_id, observacao) "
                          "VALUES (?, ?, ?, ?)", (conf_id, boleta, cat["id"], obs))
        if cur.rowcount:
            criadas.append(cat["nome"])
            _historico_irreg(con, cur.lastrowid, "registrada", f"{filial['nome']} · {iso} · boleta {boleta} · {cat['nome']}")
        else:
            repetidas.append(cat["nome"])
    if not criadas:
        raise ErroAPI("Esta boleta já está registrada neste dia, nesta filial, com " +
                      ("esta irregularidade." if len(repetidas) == 1 else "estas irregularidades."), 409)
    return 201, {"criadas": criadas, "repetidas": repetidas}


def editar_irregularidade(con, corpo=None, **_):
    c = corpo or {}
    atual = _irregularidade(con, _inteiro(c.get("id"), "registro"))
    filial = _filial(con, _inteiro(c.get("filial_id"), "filial"))
    iso = _data_irreg(c.get("data"))
    boleta = _boleta(c.get("boleta"))
    obs = _observacao(c.get("observacao"))
    cat = _categoria(con, _inteiro(c.get("categoria_id"), "categoria"))

    conf_id = _conferencia_do_dia(con, filial, iso)
    try:
        con.execute("""UPDATE irregularidades SET conferencia_id = ?, boleta = ?, categoria_id = ?, observacao = ?
                       WHERE id = ?""", (conf_id, boleta, cat["id"], obs, atual["id"]))
    except sqlite3.IntegrityError:
        raise ErroAPI("Já existe esta mesma boleta com esta irregularidade neste dia e filial.", 409)
    depois = _irregularidade(con, atual["id"])
    _historico_irreg(con, atual["id"], "editada", f"de [{_resumo_irreg(atual)}] para [{_resumo_irreg(depois)}]")
    return 200, dict(depois)


def excluir_irregularidade(con, query=None, **_):
    q = query or {}
    atual = _irregularidade(con, _inteiro((q.get("id") or [None])[0], "registro"))
    con.execute("DELETE FROM irregularidades WHERE id = ?", (atual["id"],))
    _historico_irreg(con, atual["id"], "excluída", _resumo_irreg(atual))
    return 200, {"excluida": atual["id"]}


# ---------------------------------------------------------------- Etapa 4: pesquisa e relatórios
LIMITE_PESQUISA = 200


def _like(texto):
    """Escapa %, _ e \\ para busca literal com LIKE ... ESCAPE '\\'."""
    return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def pesquisa(con, query=None, **_):
    """Busca global por número de boleta: cada ocorrência (filial + dia + boleta) com todas as suas irregularidades."""
    termo = " ".join(((query or {}).get("q") or [""])[0].split())
    if not termo:
        raise ErroAPI("Digite o número da boleta.")
    if len(termo) > 30:
        raise ErroAPI("Número da boleta muito longo (máximo 30 caracteres).")
    linhas = con.execute(f"""
        SELECT i.id, i.boleta, i.observacao, k.nome AS categoria, k.ordem,
               c.id AS conferencia_id, c.data, c.situacao, f.id AS filial_id, f.nome AS filial
        FROM irregularidades i
        JOIN conferencias c ON c.id = i.conferencia_id
        JOIN filiais f ON f.id = c.filial_id
        JOIN categorias_irregularidade k ON k.id = i.categoria_id
        WHERE i.boleta LIKE ? ESCAPE '\\'
        ORDER BY (i.boleta = ?) DESC, c.data DESC, f.codigo, i.boleta, k.ordem""",
        (f"%{_like(termo)}%", termo)).fetchall()
    grupos, ordem = {}, []
    for r in linhas:
        chave = (r["conferencia_id"], r["boleta"])
        if chave not in grupos:
            grupos[chave] = {"boleta": r["boleta"], "exata": r["boleta"] == termo, "filial_id": r["filial_id"],
                             "filial": r["filial"], "data": r["data"], "situacao": r["situacao"], "irregularidades": []}
            ordem.append(chave)
        grupos[chave]["irregularidades"].append(
            {"id": r["id"], "categoria": r["categoria"], "observacao": r["observacao"]})
    total = len(ordem)
    return 200, {"termo": termo, "total": total, "limite": LIMITE_PESQUISA,
                 "resultados": [grupos[k] for k in ordem[:LIMITE_PESQUISA]]}


def relatorio(con, query=None, **_):
    """Relatório do período: totais, matriz filial x categoria, resumo por categoria e (no ano todo) por mês."""
    q = query or {}
    get = lambda k: ((q.get(k) or [""])[0]).strip()
    hoje = date.today()
    ano = _inteiro(get("ano") or hoje.year, "ano")
    mes = _inteiro(get("mes") or 0, "mês")
    if not (2000 <= ano <= 2100 and 0 <= mes <= 12):
        raise ErroAPI("Mês ou ano inválido.")
    prefixo = f"{ano:04d}-{mes:02d}-%" if mes else f"{ano:04d}-%"
    filial_id = _inteiro(get("filial"), "filial") if get("filial") else None
    cat_id = _inteiro(get("categoria"), "categoria") if get("categoria") else None
    if cat_id is not None:
        _categoria(con, cat_id)

    sql_f = "SELECT id, codigo, nome FROM filiais WHERE ativa = 1" + (" AND id = ?" if filial_id else "") + " ORDER BY codigo"
    filiais_ = con.execute(sql_f, (filial_id,) if filial_id else ()).fetchall()
    if filial_id and not filiais_:
        raise ErroAPI("Filial não encontrada.", 404)
    cats = con.execute("SELECT id, nome FROM categorias_irregularidade ORDER BY ordem").fetchall()

    por_filial = {f["id"]: {"id": f["id"], "codigo": f["codigo"], "nome": f["nome"], "conferidos": 0, "nao_uteis": 0,
                            "boletas": 0, "irregularidades": 0, "categorias": {}} for f in filiais_}
    for r in con.execute("""SELECT filial_id, SUM(situacao = 'conferido') AS conf, SUM(situacao = 'nao_util') AS nu
                            FROM conferencias WHERE data LIKE ? GROUP BY filial_id""", (prefixo,)):
        if r["filial_id"] in por_filial:
            por_filial[r["filial_id"]]["conferidos"] = r["conf"] or 0
            por_filial[r["filial_id"]]["nao_uteis"] = r["nu"] or 0

    onde = "WHERE c.data LIKE ?"
    params = [prefixo]
    if cat_id is not None:
        onde += " AND i.categoria_id = ?"
        params.append(cat_id)
    base = "FROM irregularidades i JOIN conferencias c ON c.id = i.conferencia_id"
    for r in con.execute(f"SELECT c.filial_id, i.categoria_id, COUNT(*) AS n {base} {onde} GROUP BY c.filial_id, i.categoria_id", params):
        f = por_filial.get(r["filial_id"])
        if f:
            f["categorias"][str(r["categoria_id"])] = r["n"]
            f["irregularidades"] += r["n"]
    for r in con.execute(f"SELECT c.filial_id, COUNT(DISTINCT c.id || '|' || i.boleta) AS n {base} {onde} GROUP BY c.filial_id", params):
        if r["filial_id"] in por_filial:
            por_filial[r["filial_id"]]["boletas"] = r["n"]

    lista = list(por_filial.values())
    por_categoria = [{"id": c["id"], "nome": c["nome"],
                      "total": sum(f["categorias"].get(str(c["id"]), 0) for f in lista)} for c in cats]
    if cat_id is not None:
        por_categoria = [c for c in por_categoria if c["id"] == cat_id]
    visiveis = set(por_filial)
    marcadores = ",".join("?" * len(visiveis)) or "NULL"
    por_mes = []
    if not mes:
        meses = {r["m"]: r for r in con.execute(f"""
            SELECT substr(c.data, 6, 2) AS m, COUNT(*) AS irreg, COUNT(DISTINCT c.id || '|' || i.boleta) AS bol
            {base} {onde} AND c.filial_id IN ({marcadores}) GROUP BY m""", params + list(visiveis))}
        por_mes = [{"mes": n, "irregularidades": (meses.get(f"{n:02d}") or {"irreg": 0})["irreg"],
                    "boletas": (meses.get(f"{n:02d}") or {"bol": 0})["bol"]} for n in range(1, 13)]
    totais = {"irregularidades": sum(f["irregularidades"] for f in lista),
              "boletas": sum(f["boletas"] for f in lista),
              "conferidos": sum(f["conferidos"] for f in lista),
              "nao_uteis": sum(f["nao_uteis"] for f in lista),
              "filiais_com_irregularidade": sum(1 for f in lista if f["irregularidades"])}
    return 200, {"ano": ano, "mes": mes, "filial_id": filial_id, "categoria_id": cat_id, "totais": totais,
                 "categorias": [dict(c) for c in cats], "por_filial": lista,
                 "por_categoria": por_categoria, "por_mes": por_mes}


ROTAS = {
    ("GET", "/api/filiais"): filiais,
    ("GET", "/api/categorias"): categorias,
    ("GET", "/api/resumo"): resumo,
    ("GET", "/api/saude"): saude,
    ("GET", "/api/conferencias"): conferencias_mes,
    ("PUT", "/api/conferencias"): registrar_conferencia,
    ("POST", "/api/conferencias/domingos"): marcar_domingos,
    ("GET", "/api/responsaveis"): responsaveis,
    ("GET", "/api/irregularidades"): listar_irregularidades,
    ("POST", "/api/irregularidades"): criar_irregularidades,
    ("PUT", "/api/irregularidades"): editar_irregularidade,
    ("DELETE", "/api/irregularidades"): excluir_irregularidade,
    ("GET", "/api/pesquisa"): pesquisa,
    ("GET", "/api/relatorio"): relatorio,
}


def despachar(con, metodo, caminho, query, corpo):
    fn = ROTAS.get((metodo, caminho.rstrip("/")))
    if not fn:
        raise ErroAPI("Rota não encontrada.", 404)
    return fn(con, query=query, corpo=corpo)
