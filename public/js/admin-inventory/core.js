/* Painel de estoque (admin): unidades, formatadores e estado.
   Depende de $, api, esc e say (admin/core.js). Os arquivos de js/admin-inventory/ são scripts clássicos
   carregados em ordem e compartilham o escopo global; events.js vem por último. */
'use strict';
const UNIT_LABEL = { kg: 'kg', g: 'g', un: 'un.', l: 'L', ml: 'ml' };
const MOVEMENT_LABEL = {
  entrada: 'Compra', saida: 'Retirada', desperdicio: 'Perda', conferencia: 'Correção de saldo',
  ajuste: 'Ajuste', consumo: 'Baixa de pedido', devolucao: 'Devolução'
};
const MOVEMENT_SIGN = { entrada: '+', devolucao: '+', saida: '−', desperdicio: '−', consumo: '−' };
const fmt = (n, max = 3) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: max });
const money = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const toNum = v => Number(String(v ?? '').trim().replace(',', '.'));
const unitLabel = u => UNIT_LABEL[u] || u || '';
const defaultConsumptionUnit = u => (u === 'kg' || u === 'g') ? 'g' : (u === 'l' || u === 'ml') ? 'ml' : 'un';
let items = [];
let recipes = [];
// Consumo por tamanho de um produto (receitas ligadas a tamanhos do cardápio).
const sizeRecipesOf = item => recipes.filter(r => Number(r.inventory_item_id) === Number(item.id) && r.size_id);
// O que está salvo na unidade do estoque volta para a medida de consumo (kg -> g, L -> ml).
const fromStock = (stored, item) => {
  const measure = defaultConsumptionUnit(item.unit);
  const factor = ((measure === 'g' && item.unit === 'kg') || (measure === 'ml' && item.unit === 'l')) ? 1000 : 1;
  return Math.round(Number(stored) * factor * 1000) / 1000;
};
// Sugere o volume a partir do nome do tamanho (ex.: "300 ml" -> 300, "Pote de 1 litro" -> 1000).
const guessMl = name => {
  const m = String(name).match(/(\d+(?:[.,]\d+)?)\s*(ml|litros?|l)\b/i);
  if (!m)
    return '';
  const n = Number(m[1].replace(',', '.'));
  return /^ml$/i.test(m[2]) ? String(n) : String(n * 1000);
};
const filters = { text: '', status: 'all' };
