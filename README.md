# Conferência de Orçamentos — Render (até 6 arquivos)

Pacote compacto com 4 arquivos. Não exige Node.js, npm nem banco de dados externo.

## Configuração no Render
- **Runtime:** Python 3
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `python app.py`

O servidor lê automaticamente a variável `PORT` fornecida pelo Render e escuta em `0.0.0.0`.

## Arquivos
- `app.py`: servidor HTTP, rotas, regras, banco SQLite local e exportações.
- `index.html`: interface completa.
- `requirements.txt`: sem dependências externas (somente biblioteca padrão do Python).
- `README.md`: instruções.

## Dados
O SQLite é criado automaticamente em `data/conferencias.db`. Isso não é uma conexão com banco externo. Em hospedagens como Render, o disco local pode ser temporário; para manter os registros entre reinicializações e novos deploys, configure um Persistent Disk e direcione `CONFERENCIA_DB` para um caminho dentro dele. Sem disco persistente, os dados podem ser perdidos em reinicializações ou deploys.
