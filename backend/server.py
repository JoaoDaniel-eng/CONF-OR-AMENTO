"""Servidor web + API JSON. Usa apenas a biblioteca padrão do Python (sem instalar pacotes)."""
import json
import mimetypes
import socket
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parent))
import db
import exportar
import routes

FRONT = (Path(__file__).resolve().parent.parent / "frontend").resolve()
PORTA = 8080


class Handler(BaseHTTPRequestHandler):
    server_version = "Conferencia/1.0"

    def log_message(self, fmt, *args):
        pass

    def _json(self, dados, status=200):
        corpo = json.dumps(dados, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def _api(self, metodo):
        url = urlparse(self.path)
        con = db.conectar()
        try:
            corpo = None
            tam = int(self.headers.get("Content-Length") or 0)
            if tam:
                corpo = json.loads(self.rfile.read(tam).decode("utf-8"))
            status, dados = routes.despachar(con, metodo, url.path, parse_qs(url.query), corpo)
            con.commit()
            self._json(dados, status)
        except routes.ErroAPI as e:
            con.rollback()
            self._json({"erro": str(e)}, e.status)
        except Exception as e:
            con.rollback()
            print("Erro:", repr(e))
            self._json({"erro": "Erro interno do servidor."}, 500)
        finally:
            con.close()

    def _exportar(self):
        url = urlparse(self.path)
        con = db.conectar()
        try:
            nome, dados = exportar.gerar(con, url.path, parse_qs(url.query))
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            self.send_header("Content-Disposition", f'attachment; filename="{nome}"')
            self.send_header("Content-Length", str(len(dados)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(dados)
        except routes.ErroAPI as e:
            self._json({"erro": str(e)}, e.status)
        except Exception as e:
            print("Erro na exportação:", repr(e))
            self._json({"erro": "Não foi possível gerar a planilha."}, 500)
        finally:
            con.close()

    def _estatico(self):
        caminho = urlparse(self.path).path
        if caminho in ("", "/"):
            caminho = "/index.html"
        alvo = (FRONT / caminho.lstrip("/")).resolve()
        if FRONT not in alvo.parents or not alvo.is_file():
            alvo = FRONT / "index.html"
        dados = alvo.read_bytes()
        tipo = mimetypes.guess_type(alvo.name)[0] or "application/octet-stream"
        if tipo.startswith("text") or tipo.endswith("javascript"):
            tipo += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(dados)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(dados)

    def do_GET(self):
        if self.path.startswith("/api/"):
            self._api("GET")
        elif self.path.startswith("/exportar/"):
            self._exportar()
        else:
            self._estatico()

    def do_POST(self):
        self._api("POST")

    def do_PUT(self):
        self._api("PUT")

    def do_DELETE(self):
        self._api("DELETE")


def ip_local():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "IP-DO-SERVIDOR"


if __name__ == "__main__":
    db.iniciar()
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else PORTA
    srv = ThreadingHTTPServer(("0.0.0.0", porta), Handler)
    print("=" * 58)
    print(" Conferência de Orçamentos — servidor ativo")
    print(f" Neste computador:    http://localhost:{porta}")
    print(f" Outros computadores: http://{ip_local()}:{porta}")
    print(" Para encerrar: Ctrl+C")
    print("=" * 58)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
