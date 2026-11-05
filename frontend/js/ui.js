/* Utilitários de interface */
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
               "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function aviso(msg, tipo = "") {
  const el = document.createElement("div");
  el.className = "aviso " + tipo;
  el.textContent = msg;
  document.getElementById("avisos").appendChild(el);
  setTimeout(() => el.remove(), tipo === "erro" ? 6000 : 3500);
}

function opcoesMeses(selecionado) {
  return MESES.map((m, i) => `<option value="${i + 1}" ${i + 1 === selecionado ? "selected" : ""}>${m}</option>`).join("");
}

function opcoesAnos(selecionado) {
  const atual = new Date().getFullYear();
  let h = "";
  for (let a = atual + 1; a >= atual - 6; a--) h += `<option ${a === selecionado ? "selected" : ""}>${a}</option>`;
  return h;
}
