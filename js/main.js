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

// Partículas do hero
const canvas = document.getElementById('particles');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let W, H, pts;
  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    pts = Array.from({ length: Math.min(70, W / 16) }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
      r: Math.random() * 1.8 + .6
    }));
  }
  resize();
  addEventListener('resize', resize);
  (function draw() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => {
      p.x = (p.x + p.vx + W) % W;
      p.y = (p.y + p.vy + H) % H;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fillStyle = 'rgba(90,160,255,.55)';
      ctx.fill();
    });
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 130) {
        ctx.strokeStyle = `rgba(80,140,255,${.16 * (1 - d / 130)})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    requestAnimationFrame(draw);
  })();
}

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
