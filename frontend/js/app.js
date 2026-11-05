/* Roteador simples baseado em hash (#/inicio, #/conferencias ...) */
const ROTAS = {
  inicio: { titulo: "Início", fn: paginaInicio },
  conferencias: { titulo: "Conferências", fn: paginaConferencias },
  irregularidades: { titulo: "Irregularidades", fn: paginaIrregularidades },
  pesquisa: { titulo: "Pesquisa", fn: paginaPesquisa },
  relatorios: { titulo: "Relatórios", fn: paginaRelatorios },
};

async function navegar() {
  const caminho = (location.hash.replace(/^#\/?/, "") || "inicio").split("?")[0];
  const nome = ROTAS[caminho] ? caminho : "inicio";
  const rota = ROTAS[nome];
  document.getElementById("titulo-pagina").textContent = rota.titulo;
  document.title = rota.titulo + " · Conferência de Orçamentos";
  document.querySelectorAll("#menu a").forEach((a) => a.classList.toggle("ativo", a.dataset.rota === nome));
  document.getElementById("lateral").classList.remove("aberta");
  const app = document.getElementById("app");
  try {
    await rota.fn(app);
  } catch (e) {
    app.innerHTML = `<div class="painel"><div class="vazio"><strong>Não foi possível carregar esta área</strong>${esc(e.message)}</div></div>`;
  }
}

async function verificarServidor() {
  const el = document.getElementById("status-servidor");
  try {
    await api.get("/api/saude");
    el.textContent = "Servidor conectado"; el.className = "lateral-rodape on";
  } catch {
    el.textContent = "Servidor indisponível"; el.className = "lateral-rodape off";
  }
}

document.getElementById("btn-menu").onclick = () => document.getElementById("lateral").classList.toggle("aberta");
window.addEventListener("hashchange", navegar);
navegar();
verificarServidor();
setInterval(verificarServidor, 20000);
