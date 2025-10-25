async function loadTicket() {
  const parts = window.location.pathname.split('/');
  const id = parts[parts.length - 1]
  const container = document.getElementById('ticket-info');
  const qrContainer = document.getElementById('qr');

 

  try {
    const res = await fetch(`/api/ticket/${id}`);
    if (!res.ok) {
      const text = await res.text();
      container.innerHTML = `<p class="error">Greška ${res.status}: ${text}</p>`;
      return;
    }

    const data = await res.json();

   
    container.innerHTML = `
          <p><strong>ID listića:</strong> ${data.id}</p>
          <p><strong>Osobni dokument:</strong> ${data.card_number ?? '—'}</p>
          <p><strong>Brojevi na listiću:</strong> ${data.ticket_numbers.join(', ')}</p>
          <p><strong>Izvučeni brojevi u tom kolu:</strong> ${data.drawn_numbers ? data.drawn_numbers.join(', ') : "nisu izvučeni"}</p>
        `;

   


  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="error">Greška</p>`;
  }
}

loadTicket();