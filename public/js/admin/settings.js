async function loadSettings() {
  const s = await api('/settings'), f = $('#settings-form');
  for (const key of ['store_name', 'whatsapp_number', 'opening_time', 'closing_time', 'minimum_schedule_minutes', 'max_free_toppings', 'combo_min_items', 'combo_discount_percent', 'estimated_minutes_min', 'estimated_minutes_max', 'pix_key', 'pix_name', 'pix_city'])
    f.elements[key].value = s[key] || '';
  f.elements.manual_closed.checked = s.manual_closed === 'true';
  const days = (s.opening_days || '2,3,4,5,6,0').split(',');
  f.querySelectorAll('[type=checkbox][value]').forEach(c => c.checked = days.includes(c.value));
  await loadPauseState();
}
$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget, fd = new FormData(f), openingDays = [...f.querySelectorAll('[type=checkbox][value]:checked')].map(c => c.value);
  const body = {};
  for (const key of ['store_name', 'whatsapp_number', 'opening_time', 'closing_time', 'minimum_schedule_minutes', 'max_free_toppings', 'combo_min_items', 'combo_discount_percent', 'estimated_minutes_min', 'estimated_minutes_max', 'pix_key', 'pix_name', 'pix_city'])
    body[key] = fd.get(key);
  body.manual_closed = f.elements.manual_closed.checked ? 'true' : 'false';
  body.opening_days = openingDays.join(',');
  try {
    await api('/settings', { method: 'PATCH', body: JSON.stringify(body) });
    say('Configurações salvas.');
    await loadStats();
    await loadPauseState();
  }
  catch (err) {
    say(err.message);
  }
});
