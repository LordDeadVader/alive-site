/* ═══ Alive — painel de gestão de clientes e sites (localStorage) ═══ */

// Proteção: exige sessão iniciada no login
const session = sessionStorage.getItem('alive_session');
if (!session) location.replace('login.html');
document.getElementById('hello').textContent = `Olá, ${session}`;
document.getElementById('btnLogout').addEventListener('click', () => {
  sessionStorage.removeItem('alive_session');
  location.href = 'login.html';
});

const KEY = 'alive_clientes_v2';
const SEED_FLAG = 'alive_seed_v2';
const load = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const save = list => localStorage.setItem(KEY, JSON.stringify(list));
const fmt = v => (+v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Clientes iniciais (cadastrados uma única vez; depois tudo é editável no painel)
if (!localStorage.getItem(SEED_FLAG)) {
  const seed = [
    {
      id: crypto.randomUUID(),
      nome: 'PS Corretor',
      contato: 'Paulo Souza — +55 42 9954-9354',
      site: 'https://lorddeadvader.github.io/ps-corretor/',
      repo: 'https://github.com/LordDeadVader/ps-corretor',
      plano: 'Essencial',
      implValor: 320, implStatus: 'Pendente',
      recValor: 65, recPeriodo: 'Mensal',
      pagamento: 'Em dia',
      statusSite: 'No ar',
      proxVenc: '',
      obs: 'Plano Essencial: R$ 65,00/mês + implementação única de R$ 320,00. Servidor e manutenção inclusos. Suporte gratuito nos 2 primeiros meses (alterações simples); após, R$ 30,00/hora.'
    },
    {
      id: crypto.randomUUID(),
      nome: 'Trans Empri',
      contato: 'Walter Gomes — +55 42 9943-0145',
      site: 'https://lorddeadvader.github.io/transempri/',
      repo: 'https://github.com/LordDeadVader/transempri',
      plano: 'Condição Especial',
      implValor: 250, implStatus: 'Pendente',
      recValor: 200, recPeriodo: 'Anual',
      pagamento: 'Pendente',
      statusSite: 'Em desenvolvimento',
      proxVenc: '',
      obs: 'Proposta de 20/08/2026 (validade 15 dias): implementação única R$ 250,00 + manutenção R$ 200,00/ano. Migração completa do conteúdo do site atual para novo layout. Suporte gratuito nos 2 primeiros meses; após, R$ 30,00/hora.'
    }
  ];
  const existing = load();
  save([...seed, ...existing]);
  localStorage.setItem(SEED_FLAG, '1');
}

const tbody = document.getElementById('tbody');
const busca = document.getElementById('busca');
const fPag = document.getElementById('fPagamento');
const fSta = document.getElementById('fStatus');
const modal = document.getElementById('modal');
const form = document.getElementById('clientForm');

const tagClass = {
  'Em dia': 'tag-pago', 'Pago': 'tag-pago', 'Pendente': 'tag-pendente', 'Atrasado': 'tag-atrasado',
  'Em desenvolvimento': 'tag-andamento', 'No ar': 'tag-concluido', 'Manutenção': 'tag-pendente', 'Pausado': 'tag-pausado'
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// aceita "www.x.com" ou "https://x.com" e devolve URL clicável
const href = u => /^https?:\/\//i.test(u) ? u : 'https://' + u;

function linkIcons(c) {
  let out = '';
  if (c.site) out += `<a class="mini-link" href="${esc(href(c.site))}" target="_blank" rel="noopener" title="${esc(c.site)}">🌐 site</a>`;
  if (c.repo) out += `<a class="mini-link" href="${esc(href(c.repo))}" target="_blank" rel="noopener" title="${esc(c.repo)}">&lt;/&gt; repo</a>`;
  return out;
}

function render() {
  const q = busca.value.trim().toLowerCase();
  const list = load().filter(c =>
    (!q || [c.nome, c.contato, c.site, c.plano].join(' ').toLowerCase().includes(q)) &&
    (!fPag.value || c.pagamento === fPag.value) &&
    (!fSta.value || c.statusSite === fSta.value)
  );

  tbody.innerHTML = list.map(c => `
    <tr>
      <td>
        <strong>${esc(c.nome)}</strong>
        ${c.contato ? `<br><small style="color:var(--muted)">${esc(c.contato)}</small>` : ''}
        <div class="mini-links">${linkIcons(c)}</div>
      </td>
      <td>${esc(c.plano)}${c.obs ? `<br><small style="color:var(--muted)" title="${esc(c.obs)}">${esc(c.obs.length > 60 ? c.obs.slice(0, 60) + '…' : c.obs)}</small>` : ''}</td>
      <td>${fmt(c.implValor)}<br><span class="tag ${tagClass[c.implStatus] || ''}">${c.implStatus}</span></td>
      <td>${fmt(c.recValor)} <small style="color:var(--muted)">/ ${c.recPeriodo === 'Anual' ? 'ano' : 'mês'}</small></td>
      <td><span class="tag ${tagClass[c.pagamento] || ''}">${c.pagamento}</span></td>
      <td><span class="tag ${tagClass[c.statusSite] || ''}">${c.statusSite}</span></td>
      <td>${c.proxVenc ? new Date(c.proxVenc + 'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
      <td class="row-actions">
        <button class="icon-btn" data-edit="${c.id}" title="Editar">✏️</button>
        <button class="icon-btn" data-del="${c.id}" title="Excluir">🗑️</button>
      </td>
    </tr>`).join('');
  document.getElementById('empty').hidden = list.length > 0;

  // KPIs (sobre a lista completa, não filtrada)
  const all = load();
  const mrr = all.reduce((s, c) => s + (c.recPeriodo === 'Anual' ? (+c.recValor || 0) / 12 : (+c.recValor || 0)), 0);
  document.getElementById('kTotal').textContent = all.length;
  document.getElementById('kNoAr').textContent = all.filter(c => c.statusSite === 'No ar').length;
  document.getElementById('kMRR').textContent = fmt(mrr);
  document.getElementById('kAtraso').textContent = all.filter(c => c.pagamento === 'Atrasado').length;
}

function openModal(c) {
  document.getElementById('modalTitle').textContent = c ? 'Editar cliente' : 'Novo cliente';
  form.reset();
  document.getElementById('cId').value = c?.id || '';
  if (c) {
    cNome.value = c.nome; cContato.value = c.contato || ''; cSite.value = c.site || '';
    cRepo.value = c.repo || ''; cPlano.value = c.plano || 'Essencial';
    cImplValor.value = c.implValor ?? 0; cImplStatus.value = c.implStatus || 'Pendente';
    cRecValor.value = c.recValor ?? 0; cRecPeriodo.value = c.recPeriodo || 'Mensal';
    cPagamento.value = c.pagamento || 'Em dia'; cStatusSite.value = c.statusSite || 'Em desenvolvimento';
    cProxVenc.value = c.proxVenc || ''; cObs.value = c.obs || '';
  }
  modal.hidden = false;
  cNome.focus();
}

document.getElementById('btnNovo').addEventListener('click', () => openModal());
document.getElementById('btnCancelar').addEventListener('click', () => modal.hidden = true);
modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });

form.addEventListener('submit', e => {
  e.preventDefault();
  const list = load();
  const id = document.getElementById('cId').value || crypto.randomUUID();
  const item = {
    id,
    nome: cNome.value.trim(), contato: cContato.value.trim(),
    site: cSite.value.trim(), repo: cRepo.value.trim(),
    plano: cPlano.value,
    implValor: +cImplValor.value, implStatus: cImplStatus.value,
    recValor: +cRecValor.value, recPeriodo: cRecPeriodo.value,
    pagamento: cPagamento.value, statusSite: cStatusSite.value,
    proxVenc: cProxVenc.value, obs: cObs.value.trim()
  };
  const i = list.findIndex(c => c.id === id);
  i >= 0 ? list[i] = item : list.push(item);
  save(list);
  modal.hidden = true;
  render();
});

tbody.addEventListener('click', e => {
  const btn = e.target.closest('[data-edit],[data-del]');
  if (!btn) return;
  const editId = btn.dataset.edit, delId = btn.dataset.del;
  if (editId) openModal(load().find(c => c.id === editId));
  if (delId && confirm('Excluir este cliente?')) {
    save(load().filter(c => c.id !== delId));
    render();
  }
});

[busca, fPag, fSta].forEach(el => el.addEventListener('input', render));
render();
