// Avaliações e foto da avaliação.
async function loadReviews() {
  try {
    const reviews = await api('/reviews');
    $('#reviews-list').innerHTML = reviews.length ? reviews.map(r => `<article class="review-card"><div class="stars" aria-label="Nota ${r.rating} de 5">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div><strong>${esc(r.name)}</strong><p>${esc(r.comment)}</p>${r.has_photo ? `<button type="button" class="review-photo-thumb" data-review-photo="/api/reviews/${Number(r.id)}/photo" aria-label="Ver foto enviada por ${esc(r.name)}"><img src="/api/reviews/${Number(r.id)}/photo" alt="Foto enviada por ${esc(r.name)}" loading="lazy"></button>` : ''}</article>`).join('') : '<p class="muted">Ainda não há avaliações publicadas. Seja a primeira pessoa a avaliar!</p>';
  }
  catch {
    $('#reviews-list').innerHTML = '<p class="muted">Avaliações indisponíveis no momento.</p>';
  }
}
$('#review-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const msg = $('#review-message');
  const btn = form.querySelector('[type=submit]');
  if (reviewPhotoBusy) {
    msg.textContent = 'Aguarde: a foto ainda está sendo preparada.';
    msg.classList.remove('is-success');
    return;
  }
  btn.disabled = true;
  msg.textContent = 'Enviando…';
  msg.classList.remove('is-success');
  try {
    const fd = new FormData(form);
    const data = await api('/reviews', { method: 'POST', body: JSON.stringify({ name: fd.get('name'), rating: Number(fd.get('rating')), comment: fd.get('comment'), photo: reviewPhoto || undefined }) });
    msg.textContent = data.message;
    msg.classList.add('is-success');
    form.reset();
    clearReviewPhoto();
  }
  catch (err) {
    msg.textContent = err.message;
    msg.classList.remove('is-success');
  }
  finally {
    btn.disabled = false;
  }
});
// ===== Foto na avaliação (reduzida e convertida para JPEG no próprio aparelho) =====
let reviewPhoto = '', reviewPhotoBusy = false;
const REVIEW_PHOTO_MAX_SIDE = 1000, REVIEW_PHOTO_MAX_BYTES = 600 * 1024, REVIEW_PHOTO_SOURCE_LIMIT = 25 * 1024 * 1024;
function photoMessage(text, error = true) { const m = $('#review-photo-message'); m.textContent = text; m.classList.toggle('error-message', !!text && error); }
function clearReviewPhoto() {
  reviewPhoto = '';
  const input = $('#review-photo');
  if (input)
    input.value = '';
  $('#review-photo-img').removeAttribute('src');
  $('#review-photo-preview').classList.add('hidden');
  $('#review-photo-remove').classList.add('hidden');
  $('#review-photo-pick').textContent = '📷 Adicionar foto';
  photoMessage('');
}
async function decodeImage(file) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    }
    catch { }
  }
  return await new Promise((resolve, reject) => { const url = URL.createObjectURL(file), img = new Image(); img.onload = () => { URL.revokeObjectURL(url); resolve(img); }; img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); }; img.src = url; });
}
async function shrinkToJpeg(file) {
  const img = await decodeImage(file);
  const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight;
  if (!w0 || !h0)
    throw new Error('decode');
  const scale = Math.min(1, REVIEW_PHOTO_MAX_SIDE / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  if (img.close)
    img.close();
  let quality = .82, url = canvas.toDataURL('image/jpeg', quality);
  while (url.length * 3 / 4 > REVIEW_PHOTO_MAX_BYTES && quality > .4) {
    quality -= .1;
    url = canvas.toDataURL('image/jpeg', quality);
  }
  if (!url.startsWith('data:image/jpeg') || url.length * 3 / 4 > REVIEW_PHOTO_MAX_BYTES)
    throw new Error('big');
  return url;
}
$('#review-photo-pick').addEventListener('click', () => $('#review-photo').click());
$('#review-photo-remove').addEventListener('click', clearReviewPhoto);
$('#review-photo').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file)
    return;
  photoMessage('');
  if (file.type && !file.type.startsWith('image/')) {
    clearReviewPhoto();
    photoMessage('Escolha um arquivo de imagem (JPG, PNG ou WebP).');
    return;
  }
  if (file.size > REVIEW_PHOTO_SOURCE_LIMIT) {
    clearReviewPhoto();
    photoMessage('Essa foto é muito pesada. Escolha outra de até 25 MB.');
    return;
  }
  reviewPhotoBusy = true;
  photoMessage('Preparando a foto…', false);
  try {
    reviewPhoto = await shrinkToJpeg(file);
    $('#review-photo-img').src = reviewPhoto;
    $('#review-photo-preview').classList.remove('hidden');
    $('#review-photo-remove').classList.remove('hidden');
    $('#review-photo-pick').textContent = '🔄 Trocar foto';
    photoMessage('');
  }
  catch {
    clearReviewPhoto();
    photoMessage('Não consegui ler essa foto. Tente outra em JPG ou PNG.');
  }
  finally {
    reviewPhotoBusy = false;
  }
});
// Ampliar foto da avaliação
function closePhotoViewer() {
  const v = document.getElementById('photo-viewer');
  if (v) {
    v.remove();
    document.body.classList.remove('viewer-open');
  }
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-viewer-close]')) {
    closePhotoViewer();
    return;
  }
  const b = e.target.closest('[data-review-photo]');
  if (!b)
    return;
  closePhotoViewer();
  const v = document.createElement('div');
  v.id = 'photo-viewer';
  v.className = 'photo-viewer';
  v.setAttribute('role', 'dialog');
  v.setAttribute('aria-modal', 'true');
  v.setAttribute('aria-label', 'Foto da avaliação');
  v.innerHTML = `<button type="button" class="photo-viewer-close" data-viewer-close aria-label="Fechar foto">×</button><img src="${esc(b.dataset.reviewPhoto)}" alt="Foto da avaliação ampliada" data-viewer-close>`;
  document.body.appendChild(v);
  document.body.classList.add('viewer-open');
  v.querySelector('button').focus();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    closePhotoViewer();
});
