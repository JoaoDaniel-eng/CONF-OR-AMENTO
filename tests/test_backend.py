"""Testes automatizados básicos da API e das exportações.

Execute na pasta do projeto com:
    python -m unittest discover -s tests -v
Os testes usam um banco temporário e não alteram data/conferencias.db.
"""
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE / "backend"))

import db
import routes
import exportar


class BackendSmokeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self._db_original = db.DB_PATH
        db.DB_PATH = Path(self.tmp.name) / "teste.db"
        db.iniciar()
        self.con = db.conectar()
        self.filial = routes.despachar(
            self.con, "GET", "/api/filiais", {}, None
        )[1][0]["id"]
        self.categoria = routes.despachar(
            self.con, "GET", "/api/categorias", {}, None
        )[1][0]["id"]

    def tearDown(self):
        self.con.close()
        db.DB_PATH = self._db_original
        self.tmp.cleanup()

    def api(self, method, path, query=None, body=None):
        return routes.despachar(self.con, method, path, query or {}, body)

    def test_rotas_basicas(self):
        for path in ("/api/saude", "/api/filiais", "/api/categorias",
                     "/api/resumo", "/api/responsaveis"):
            status, _ = self.api("GET", path)
            self.assertEqual(status, 200, path)

    def test_conferencia_exige_responsavel(self):
        with self.assertRaises(routes.ErroAPI):
            self.api("PUT", "/api/conferencias", body={
                "filial_id": self.filial, "data": date.today().isoformat(),
                "situacao": "conferido", "responsavel": ""
            })

    def test_ciclo_irregularidade_pesquisa_relatorio(self):
        hoje = date.today().isoformat()
        self.api("PUT", "/api/conferencias", body={
            "filial_id": self.filial, "data": hoje,
            "situacao": "conferido", "responsavel": "Teste automatizado"
        })
        status, criado = self.api("POST", "/api/irregularidades", body={
            "filial_id": self.filial, "data": hoje, "boleta": "TESTE-001",
            "categorias": [self.categoria], "observacao": "Teste"
        })
        self.assertEqual(status, 201)
        self.assertEqual(len(criado["criadas"]), 1)
        _, pesquisa = self.api("GET", "/api/pesquisa", {"q": ["TESTE-001"]})
        self.assertEqual(pesquisa["total"], 1)
        _, relatorio = self.api("GET", "/api/relatorio", {
            "ano": [str(date.today().year)]
        })
        self.assertEqual(relatorio["totais"]["irregularidades"], 1)

    def test_exportacoes_excel(self):
        ano, mes = str(date.today().year), str(date.today().month)
        consultas = [
            ("/exportar/conferencias", {"ano": [ano], "mes": [mes]}),
            ("/exportar/irregularidades", {"ano": [ano], "mes": [mes]}),
            ("/exportar/relatorio", {"ano": [ano]}),
        ]
        for caminho, query in consultas:
            nome, conteudo = exportar.gerar(self.con, caminho, query)
            self.assertTrue(nome.endswith(".xlsx"))
            self.assertTrue(conteudo.startswith(b"PK"))
            self.assertGreater(len(conteudo), 500)

    def test_rota_inexistente_retorna_404(self):
        with self.assertRaises(routes.ErroAPI) as erro:
            self.api("GET", "/api/nao-existe")
        self.assertEqual(erro.exception.status, 404)


if __name__ == "__main__":
    unittest.main()
