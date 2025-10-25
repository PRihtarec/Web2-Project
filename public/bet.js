
function parseNumbers(input) {
  if (Array.isArray(input)) return input.map(Number);
  return String(input).split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => Number(s));
}


function validateCardNumber(input) {

  if (typeof input !== 'string' || input.length === 0) return 'Osobni dokument je obavezan.';

  if (input.length > 20) return 'Osobni dokument smije imati najviše 20 znakova.';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char < '0' || char > '9') {
      return 'Svi znakovi u osobnom dokumentu moraju biti znamenke';
    }
  }

  return null;
}

function validateNumbers(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 'Brojevi su obavezni.';

  if (numbers.length < 6 || numbers.length > 10) return 'Potrebno je upisati između 6 i 10 brojeva.';

  if (new Set(numbers).size !== numbers.length) return 'Duplikati nisu dozvoljeni.';

  for (let i = 0; i < numbers.length; i++) {
    const n = numbers[i];
    if (n < 1 || n > 45) {
      return 'Svi brojevi moraju biti u rasponu 1–45.';
    }
  }
  return null;
}

const form = document.getElementById('bet-form');
const msg = document.getElementById('message');
const submitBtn = document.getElementById('submit-btn');
const qrContainer = document.getElementById('qr-container');
const qrImage = document.getElementById('qr-image');
const ticketLink = document.getElementById('ticket-link');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  msg.className = '';

  const cardNumber = document.getElementById('card_number').value.trim();
  const numbersRaw = document.getElementById('numbers').value.trim();

  //validacija
  const cardValidationMessage = validateCardNumber(cardNumber);
  if (cardValidationMessage) {
    msg.textContent = cardValidationMessage; msg.className = 'error'; return;
  }

  const numbers = parseNumbers(numbersRaw);
  const numbersValidationMessage = validateNumbers(numbers);
  if (numbersValidationMessage) {
    msg.textContent = numbersValidationMessage; msg.className = 'error'; return;
  }


  try {
    
    const payload = { cardNumber: cardNumber, numbers: numbers };
    const resp = await fetch('/api/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', 
      body: JSON.stringify(payload)
    });

    if (resp.status === 401 || resp.status === 403) {
      msg.textContent = 'Morate biti prijavljeni za uplatu.'; msg.className = 'error';
      return;
    }

    if (!resp.ok) {

      msg.textContent = `Greška: ${resp.status}`; msg.className = 'error';
      return;
    }


      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      qrImage.src = url;
      qrContainer.style.display = 'block';

 
      msg.textContent = 'Listić uspješno spremljen.'; msg.className = 'success';

  } catch (err) {
    console.error(err);
    msg.textContent = 'Greška'; msg.className = 'error';
  } 
});