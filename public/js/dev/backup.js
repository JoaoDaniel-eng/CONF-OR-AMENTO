$('#download-backup').addEventListener('click', async () => {
  try {
    const r = await fetch('/api/dev/backup', { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || 'Não foi possível gerar o backup.');
    }
    const blob = await r.blob(), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = 'acai-da-roca-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    $('#backup-message').textContent = 'Backup baixado. Guarde o arquivo em local seguro.';
  }
  catch (e) {
    $('#backup-message').textContent = e.message;
  }
});
$('#backup-file').addEventListener('change', e => {
  $('#restore-backup').disabled = !e.target.files?.[0];
  $('#backup-message').textContent = e.target.files?.[0] ? 'Arquivo selecionado. Clique em validar e restaurar.' : '';
});
$('#restore-backup').addEventListener('click', async () => {
  const file = $('#backup-file').files?.[0];
  if (!file)
    return;
  try {
    const backup = JSON.parse(await file.text());
    const check = await api('/backup/verify', { method: 'POST', body: JSON.stringify(backup) });
    if (!check.valid)
      throw new Error('Backup inválido.');
    const summary = Object.entries(check.counts).map(([k, v]) => `${k}: ${v}`).join('\n');
    if (!confirm(`Backup válido (${fmtDate(check.createdAt)}).\n\n${summary}\n\nA restauração substituirá os dados atuais. Deseja continuar?`))
      return;
    if ((prompt('Para confirmar, digite RESTAURAR em maiúsculas:') || '').trim() !== 'RESTAURAR') {
      $('#backup-message').textContent = 'Restauração cancelada: a confirmação não confere.';
      return;
    }
    const restored = await api('/backup/restore', { method: 'POST', body: JSON.stringify({ ...backup, confirmRestore: true }) });
    $('#backup-message').textContent = restored.message;
    $('#backup-file').value = '';
    $('#restore-backup').disabled = true;
  }
  catch (e) {
    $('#backup-message').textContent = e.message;
  }
});
