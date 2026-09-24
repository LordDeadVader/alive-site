/* ═══ Alive — autenticação (client-side, uso pessoal) ═══
   A credencial não fica em texto puro: o par usuário:senha é
   comparado por hash SHA-256. */
const AUTH_HASHES = [
  '5bc573ce735e6befdcee538f79cf5ee82a24eb1fb3070bd5060968f60d413028', // DAVI
  '4700685aaf8dde573aa8b5f059c52a9f3ede216871dce251368a59db34a40e54'  // ADMIN (provisório)
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
