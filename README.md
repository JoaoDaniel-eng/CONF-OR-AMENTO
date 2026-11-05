# Conferência de Orçamentos

Sistema web para substituir a planilha Excel de conferência mensal de orçamentos (17 filiais SHOP15).

## Como executar
1. Instale o **Python 3.9+** em UM computador (o servidor). Não há mais nada para instalar.
2. Dê duplo clique em `iniciar.bat` (Windows) ou execute `./iniciar.sh` (Linux/Mac).
3. Neste computador acesse `http://localhost:8080`. Nos demais computadores da rede, use o endereço
   "Outros computadores" mostrado na janela do servidor. Todos compartilham o mesmo banco.

## Banco de dados
SQLite (relacional) em `data/conferencias.db`, com chaves estrangeiras, restrições e modo WAL (vários usuários simultâneos).
**Backup:** basta copiar a pasta `data/` com o servidor parado (ou a qualquer momento: o WAL é seguro).
Deixe o servidor sempre ligado em um computador fixo.

## Estrutura
- `backend/` servidor, API (`routes.py`), banco (`db.py`, `schema.sql`)
- `frontend/` interface (HTML/CSS/JS, sem dependências externas)
- `data/` banco de dados (criado automaticamente)

## Andamento
- [x] Etapa 1 — Estrutura, interface e banco de dados
- [x] Etapa 2 — Filiais e controle mensal de conferências
- [x] Etapa 3 — Irregularidades
- [x] Etapa 4 — Pesquisa global e relatórios
- [x] Etapa 5a — Exportação Excel (botões "Exportar Excel" em Conferências, Irregularidades e Relatórios; arquivo .xlsx gerado pelo servidor, sem instalar nada)
- [x] Etapa 5b — Testes automatizados básicos de API e exportações Excel

## Testes
Execute na pasta do projeto: `python -m unittest discover -s tests -v`.
Os testes usam banco temporário e não alteram `data/conferencias.db`.
A validação visual nos navegadores e o teste em rede local devem ser feitos no ambiente de implantação.
