async function loadData() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    document.getElementById('round-info').textContent =
      data.roundActive ? "Kolo je trenutno aktivirano." : "Kolo je trenutno deaktivirano.";

    document.getElementById('ticket-count').textContent =
      data.ticketCount ?? "Nema podataka.";

    document.getElementById('drawn-numbers').textContent =
      data.drawnNumbers?.length ? data.drawnNumbers.join(', ') : "Još nisu izvučeni.";

    document.getElementById('bet-section').style.display =
      data.roundActive ? "block" : "none";
  } catch (err) {
    console.error('Greska', err);
  }
}

async function updateUserInfo() {
  try {
    const res = await fetch('/user');
    if (res.ok) {
      const user = await res.json();
      if (user) {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'inline-block';
        const span = document.createElement('span');
        span.textContent = `Prijavljen: ${user.name ?? user.sub}`;
        document.getElementById('user-info').appendChild(span);
      }
    }
  } catch (err) {
    console.log('Korisnik nije prijavljen.');
  }
}

loadData();
updateUserInfo();