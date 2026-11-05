async function loadZones() {
  const zones = await api('/zones');
  $('#zones-list').innerHTML = zones.length ? zones.map(z => `<form class="zone-row" data-id="${z.id}"><label>Bairro<input name="name" value="${esc(z.name)}" required></label><label>Taxa (R$)<input name="fee" type="number" min="0" step="0.01" value="${moneyInput(z.fee)}" required></label><label class="mini-check"><input name="active" type="checkbox" ${z.active ? 'checked' : ''}> Ativo</label><button class="button button-small button-primary">Salvar</button><button type="button" class="button button-small button-danger" data-delete-zone="${z.id}">Excluir</button></form>`).join('') : '<p class="muted">Nenhum bairro cadastrado.</p>';
  document.querySelectorAll('.zone-row').forEach(form => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await api('/zones/' + form.dataset.id, { method: 'PATCH', body: JSON.stringify({ name: fd.get('name'), feeCents: Math.round(Number(fd.get('fee')) * 100), active: fd.get('active') === 'on' }) });
      say('Bairro atualizado.');
      loadZones();
    }
    catch (err) {
      say(err.message);
    }
  }));
  document.querySelectorAll('[data-delete-zone]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Excluir este bairro da lista de entrega?'))
      return;
    try {
      await api('/zones/' + btn.dataset.deleteZone, { method: 'DELETE' });
      say('Bairro excluído.');
      loadZones();
    }
    catch (e) {
      say(e.message);
    }
  }));
}
$('#zone-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget, fd = new FormData(form);
  try {
    await api('/zones', { method: 'POST', body: JSON.stringify({ name: fd.get('name'), feeCents: Math.round(Number(fd.get('fee')) * 100) }) });
    form.reset();
    say('Bairro adicionado.');
    await loadZones();
  }
  catch (err) {
    say(err.message);
  }
});
