/* ═══ Alive — autenticação (client-side, uso pessoal) ═══
   A credencial não fica em texto puro: o par usuário:senha é
   comparado por hash SHA-256. */
const AUTH_HASHES = [
  '1811faaaf596016e099f8e220d66e284284f1ae60d3195468b2b640234521dc6', // DAVI
  '9103aee92e45283053eb18a2ff26a40bf9de5ec69eaa1e849cf0a2560904a8f6'  // ADMIN (provisório)
];

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById('loginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const user = document.getElementById('user').value.trim().toUpperCase();
  const pass = document.getElementById('pass').value;
  const hash = await sha256(`${user}:${pass}`);
  if (AUTH_HASHES.includes(hash)) {
    sessionStorage.setItem('alive_session', user);
    location.href = 'dashboard.html';
  } else {
    document.getElementById('loginErr').hidden = false;
  }
});
