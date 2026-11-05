// Dados salvos neste aparelho.
// Cadastro rápido opcional: dados ficam somente neste aparelho, sem criar conta ou enviar senha.
function restoreSavedDetails() {
  try {
    const saved = JSON.parse(localStorage.getItem('acaiCustomerDetails') || 'null');
    if (saved) {
      for (const [key, value] of Object.entries({ customerName: saved.customerName, phone: saved.phone, address: saved.address })) {
        const field = document.querySelector(`#checkout-form [name="${key}"]`);
        if (field && value)
          field.value = value;
      }
      if (saved.zoneId)
        $('#zone-select').value = saved.zoneId;
      $('#save-customer-details').checked = true;
    }
  }
  catch { }
}
