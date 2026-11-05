-- Esquema relacional completo (criado na Etapa 1 para evitar retrabalho nas próximas)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS filiais (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nome   TEXT NOT NULL UNIQUE,
    ativa  INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0,1))
);

-- Uma linha por filial + dia (criada sob demanda na Etapa 2)
CREATE TABLE IF NOT EXISTS conferencias (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filial_id     INTEGER NOT NULL REFERENCES filiais(id) ON DELETE RESTRICT,
    data          TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    situacao      TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (situacao IN ('pendente','conferido','nao_util')),
    responsavel   TEXT,
    concluido_em  TEXT,
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE (filial_id, data),
    CHECK (situacao <> 'conferido' OR (responsavel IS NOT NULL AND trim(responsavel) <> ''))
);
CREATE INDEX IF NOT EXISTS idx_conf_data ON conferencias(data);

CREATE TABLE IF NOT EXISTS categorias_irregularidade (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nome  TEXT NOT NULL UNIQUE,
    ordem INTEGER NOT NULL
);

-- Uma boleta pode ter várias irregularidades (uma linha por boleta + categoria)
CREATE TABLE IF NOT EXISTS irregularidades (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    conferencia_id INTEGER NOT NULL REFERENCES conferencias(id) ON DELETE RESTRICT,
    boleta         TEXT NOT NULL CHECK (trim(boleta) <> ''),
    categoria_id   INTEGER NOT NULL REFERENCES categorias_irregularidade(id) ON DELETE RESTRICT,
    observacao     TEXT,
    criado_em      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE (conferencia_id, boleta, categoria_id)
);
CREATE INDEX IF NOT EXISTS idx_irreg_boleta ON irregularidades(boleta);
CREATE INDEX IF NOT EXISTS idx_irreg_cat ON irregularidades(categoria_id);

-- Trilha de auditoria: preserva o histórico de alterações
CREATE TABLE IF NOT EXISTS historico (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entidade    TEXT NOT NULL,
    entidade_id INTEGER,
    acao        TEXT NOT NULL,
    detalhe     TEXT,
    criado_em   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
