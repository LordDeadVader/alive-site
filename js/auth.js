/* ═══ Alive — autenticação (client-side, uso pessoal) ═══
   A credencial não fica em texto puro: o par usuário:senha é
   comparado por hash SHA-256. */
const AUTH_HASH = '1811faaaf596016e099f8e220d66e284284f1ae60d3195468b2b640234521dc6';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById('loginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const user = document.getElementById('user').value.trim().toUpperCase();
  const pass = document.getElementById('pass').value;
  const hash = await sha256(`${user}:${pass}`);
  if (hash === AUTH_HASH) {
    sessionStorage.setItem('alive_session', user);
    location.href = 'dashboard.html';
  } else {
    document.getElementById('loginErr').hidden = false;
  }
});
