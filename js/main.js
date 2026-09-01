/* ═══ Alive — interações do site ═══ */

// Nav: fundo ao rolar + menu mobile
const nav = document.getElementById('nav');
const navLinks = document.getElementById('navLinks');
const navToggle = document.getElementById('navToggle');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40));
navToggle?.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

// Parallax: elementos .plx deslocam conforme o scroll
const plx = [...document.querySelectorAll('.plx')];
function parallax() {
  const y = scrollY;
  plx.forEach(el => {
    el.style.transform = `translateY(${y * parseFloat(el.dataset.speed || 0.1)}px)`;
  });
  requestAnimationFrame(parallax);
}
requestAnimationFrame(parallax);

// Reveal on scroll
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Contadores animados
const ioCount = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    ioCount.unobserve(e.target);
    const el = e.target, end = +el.dataset.count, t0 = performance.now();
    (function tick(t) {
      const p = Math.min((t - t0) / 1400, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach(el => ioCount.observe(el));

// Efeito de fluido do hero: ver js/fluid.js

// Formulário de contato (demonstração: registra localmente)
document.getElementById('contactForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const leads = JSON.parse(localStorage.getItem('alive_leads') || '[]');
  leads.push({ ...data, data: new Date().toISOString() });
  localStorage.setItem('alive_leads', JSON.stringify(leads));
  e.target.reset();
  document.getElementById('formOk').hidden = false;
});

// Acesso discreto à área do cliente: 5 cliques na logo do rodapé
const footerLogo = document.getElementById('footerLogo');
if (footerLogo) {
  let clicks = 0, timer;
  footerLogo.addEventListener('click', () => {
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(() => clicks = 0, 2500);
    if (clicks >= 5) location.href = 'login.html';
  });
}
