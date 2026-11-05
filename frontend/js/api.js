/* Cliente da API. Todos os dados vêm do servidor (banco de dados compartilhado). */
const api = {
  async chamar(metodo, url, corpo) {
    let resp;
    try {
      resp = await fetch(url, {
        method: metodo,
        headers: corpo ? { "Content-Type": "application/json" } : {},
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    } catch (e) {
      throw new Error("Sem conexão com o servidor. Verifique se ele está ligado.");
    }
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(dados.erro || "Não foi possível concluir a operação.");
    return dados;
  },
  get: (url) => api.chamar("GET", url),
  post: (url, corpo) => api.chamar("POST", url, corpo),
  put: (url, corpo) => api.chamar("PUT", url, corpo),
  del: (url) => api.chamar("DELETE", url),
  // Baixa um arquivo gerado pelo servidor (ex.: planilha Excel)
  async baixar(url) {
    let resp;
    try {
      resp = await fetch(url);
    } catch (e) {
      throw new Error("Sem conexão com o servidor. Verifique se ele está ligado.");
    }
    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      throw new Error(dados.erro || "Não foi possível gerar a planilha.");
    }
    const m = /filename="([^"]+)"/.exec(resp.headers.get("Content-Disposition") || "");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await resp.blob());
    a.download = m ? m[1] : "exportacao.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  },
};
