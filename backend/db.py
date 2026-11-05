"""Acesso ao banco SQLite (relacional, persistente, compartilhado via servidor)."""
import os
import sqlite3
from pathlib import Path

BASE = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("CONFERENCIA_DB", BASE.parent / "data" / "conferencias.db"))

FILIAIS = ["03", "05", "06", "07", "08", "09", "11", "14", "16",
           "19", "22", "24", "25", "31", "32", "33", "34"]

CATEGORIAS = [
    "FALTA PLANO ANEXADO",
    "FALTA LIBERAÇÃO ANALISTA",
    "FALTOU PRINT ASSINATURA OK",
    "FALTA RUBRICA COMPROV. CRÉDITO",
    "FALTOU FUNC ASSINAR VALE",
    "FALTOU BOLETA COM ASS",
    "FALTA LIBERAÇÃO SUPERVISOR",
    "ORÇAMENTO NÃO VEIO",
    "NADA ANEXADO",
    "ASSINOU ERRADO",
]


def conectar():
    """Nova conexão por requisição (thread-safe). WAL permite leituras e escritas simultâneas."""
    con = sqlite3.connect(DB_PATH, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA busy_timeout = 15000")
    return con


def iniciar():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = conectar()
    con.execute("PRAGMA journal_mode = WAL")
    con.execute("PRAGMA synchronous = NORMAL")
    con.executescript((BASE / "schema.sql").read_text(encoding="utf-8"))
    for c in FILIAIS:
        con.execute("INSERT OR IGNORE INTO filiais (codigo, nome) VALUES (?, ?)",
                    (c, f"SHOP15 FL {c}"))
    for i, n in enumerate(CATEGORIAS, 1):
        con.execute("INSERT OR IGNORE INTO categorias_irregularidade (nome, ordem) VALUES (?, ?)", (n, i))
    con.commit()
    con.close()
