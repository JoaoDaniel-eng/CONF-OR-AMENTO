// Esqueci minha senha (pelo WhatsApp).
// ===== Esqueci minha senha (a loja redefine pelo WhatsApp) =====
$('#forgot-password-btn').addEventListener('click', () => $('#forgot-box').classList.toggle('hidden'));
$('#forgot-whatsapp').addEventListener('click', () => {
  const phone = String($('#customer-login-form [name=phone]').value || '').trim();
  const text = `Olá! Esqueci minha senha do site Açaí da Roça e gostaria de redefinir.${phone ? `\nMeu celular cadastrado: ${phone}` : ''}`;
  try {
    whatsapp(text, store?.whatsappNumber);
  }
  catch (err) {
    customerMessage('#customer-login-message', err.message, true);
  }
});
