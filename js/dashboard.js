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
const PIX_KEY_STORE = 'alive_pix_key';
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
      implValor: 320, implStatus: 'Pago',
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
      implValor: 250, implStatus: 'Pago',
      recValor: 200, recPeriodo: 'Anual',
      pagamento: 'Pendente',
      statusSite: 'Em desenvolvimento',
      proxVenc: '',
      obs: 'Proposta de 20/08/2026 (validade 15 dias): implementação única R$ 250,00 + manutenção R$ 200,00/ano. Migração completa do conteúdo do site atual para novo layout. Suporte gratuito nos 2 primeiros meses; após, R$ 30,00/hora.'
    }
  ];
  save([...seed, ...load()]);
  localStorage.setItem(SEED_FLAG, '1');
}

// Migração: implementações do PS Corretor e Trans Empri já foram pagas
if (!localStorage.getItem('alive_patch_impl_pago')) {
  const list = load();
  list.forEach(c => { if (['PS Corretor', 'Trans Empri'].includes(c.nome)) c.implStatus = 'Pago'; });
  save(list);
  localStorage.setItem('alive_patch_impl_pago', '1');
}

const cardsEl = document.getElementById('cards');
const busca = document.getElementById('busca');
const fPag = document.getElementById('fPagamento');
const fSta = document.getElementById('fStatus');
const modal = document.getElementById('modal');
const form = document.getElementById('clientForm');
const chargeModal = document.getElementById('chargeModal');

const tagClass = {
  'Em dia': 'tag-pago', 'Pago': 'tag-pago', 'Pendente': 'tag-pendente', 'Atrasado': 'tag-atrasado',
  'Em desenvolvimento': 'tag-andamento', 'No ar': 'tag-concluido', 'Manutenção': 'tag-pendente', 'Pausado': 'tag-pausado'
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
const href = u => /^https?:\/\//i.test(u) ? u : 'https://' + u;

// ─── Lembrete de vencimento ───
function vencInfo(c) {
  if (!c.proxVenc) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(c.proxVenc + 'T00:00');
  const dias = Math.round((venc - hoje) / 86400000);
  const data = venc.toLocaleDateString('pt-BR');
  if (dias < 0) return { cls: 'venc-red', txt: `Venceu há ${-dias} dia${dias < -1 ? 's' : ''} (${data})` };
  if (dias === 0) return { cls: 'venc-red', txt: `Vence hoje (${data})` };
  if (dias <= 7) return { cls: 'venc-amber', txt: `Vence em ${dias} dia${dias > 1 ? 's' : ''} (${data})` };
  return { cls: 'venc-ok', txt: `Próximo vencimento: ${data}` };
}

function clientPhone(c) {
  const m = (c.contato || '').match(/\+?[\d][\d\s().-]{8,}/);
  return m ? m[0].replace(/\D/g, '').replace(/^(?!55)/, '55') : '';
}

// ─── Render dos cards ───
function render() {
  const q = busca.value.trim().toLowerCase();
  const list = load().filter(c =>
    (!q || [c.nome, c.contato, c.site, c.plano].join(' ').toLowerCase().includes(q)) &&
    (!fPag.value || c.pagamento === fPag.value) &&
    (!fSta.value || c.statusSite === fSta.value)
  );

  cardsEl.innerHTML = list.map(c => {
    const v = vencInfo(c);
    return `
    <article class="ccard">
      <div class="ccard-head">
        <div>
          <h3>${esc(c.nome)}</h3>
          ${c.contato ? `<p class="ccard-contato">${esc(c.contato)}</p>` : ''}
        </div>
        <span class="tag ${tagClass[c.pagamento] || ''}">${c.pagamento}</span>
      </div>
      <div class="ccard-links">
        ${c.site ? `<a class="mini-link" href="${esc(href(c.site))}" target="_blank" rel="noopener">🌐 Ver site</a>` : ''}
        ${c.repo ? `<a class="mini-link" href="${esc(href(c.repo))}" target="_blank" rel="noopener">&lt;/&gt; Repositório</a>` : ''}
        ${clientPhone(c) ? `<a class="mini-link" href="https://wa.me/${clientPhone(c)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
      </div>
      <div class="ccard-grid">
        <div><span>Plano</span><strong>${esc(c.plano)}</strong></div>
        <div><span>Implementação</span><strong>${fmt(c.implValor)} <em class="tag ${tagClass[c.implStatus] || ''}">${c.implStatus}</em></strong></div>
        <div><span>Recorrência</span><strong>${fmt(c.recValor)} <small>/ ${c.recPeriodo === 'Anual' ? 'ano' : 'mês'}</small></strong></div>
        <div><span>Site</span><strong><em class="tag ${tagClass[c.statusSite] || ''}">${c.statusSite}</em></strong></div>
      </div>
      ${v ? `<div class="ccard-venc ${v.cls}">⏰ ${v.txt}</div>` : ''}
      ${c.obs ? `<details class="ccard-obs"><summary>Observações</summary><p>${esc(c.obs)}</p></details>` : ''}
      <div class="ccard-actions">
        <button class="btn btn-primary btn-sm" data-charge="${c.id}">⚡ Cobrança PIX</button>
        <button class="icon-btn" data-edit="${c.id}">✏️ Editar</button>
        <button class="icon-btn" data-del="${c.id}">🗑️</button>
      </div>
    </article>`;
  }).join('');
  document.getElementById('empty').hidden = list.length > 0;

  // KPIs (sobre a lista completa, não filtrada)
  const all = load();
  const mrr = all.reduce((s, c) => s + (c.recPeriodo === 'Anual' ? (+c.recValor || 0) / 12 : (+c.recValor || 0)), 0);
  const vencendo = all.filter(c => {
    const v = c.proxVenc && Math.round((new Date(c.proxVenc + 'T00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000);
    return c.proxVenc && v <= 7;
  }).length;
  document.getElementById('kTotal').textContent = all.length;
  document.getElementById('kNoAr').textContent = all.filter(c => c.statusSite === 'No ar').length;
  document.getElementById('kMRR').textContent = fmt(mrr);
  document.getElementById('kVencendo').textContent = vencendo;
}

// ─── Cadastro / edição ───
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

cardsEl.addEventListener('click', e => {
  const btn = e.target.closest('[data-edit],[data-del],[data-charge]');
  if (!btn) return;
  if (btn.dataset.edit) openModal(load().find(c => c.id === btn.dataset.edit));
  if (btn.dataset.charge) openCharge(load().find(c => c.id === btn.dataset.charge));
  if (btn.dataset.del && confirm('Excluir este cliente?')) {
    save(load().filter(c => c.id !== btn.dataset.del));
    render();
  }
});

[busca, fPag, fSta].forEach(el => el.addEventListener('input', render));

/* ═══════════ Cobrança PIX ═══════════ */
const chForm = document.getElementById('chargeForm');
const chResult = document.getElementById('chargeResult');
let currentCharge = null;

function openCharge(c) {
  if (!c) return;
  currentCharge = null;
  chForm.reset();
  chResult.hidden = true;
  document.getElementById('chClienteId').value = c.id;
  document.getElementById('chClienteNome').textContent = '— ' + c.nome;
  document.getElementById('chPixKey').value = localStorage.getItem(PIX_KEY_STORE) || '+5542999318784';
  setChargeDefaults(c, 'rec');
  chargeModal.hidden = false;
}

function setChargeDefaults(c, tipo) {
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  if (tipo === 'rec') {
    chValor.value = c.recValor || '';
    chDesc.value = (c.recPeriodo === 'Anual' ? 'Manutenção anual' : 'Mensalidade') + ' — ' + mes;
  } else if (tipo === 'impl') {
    chValor.value = c.implValor || '';
    chDesc.value = 'Implementação do site';
  } else {
    chValor.value = '';
    chDesc.value = '';
  }
  if (c.proxVenc) chVenc.value = c.proxVenc;
  else {
    const d = new Date(); d.setDate(d.getDate() + 7);
    chVenc.value = d.toISOString().slice(0, 10);
  }
}

document.getElementById('chTipo').addEventListener('change', e => {
  const c = load().find(x => x.id === document.getElementById('chClienteId').value);
  if (c) setChargeDefaults(c, e.target.value);
});
document.getElementById('btnChFechar').addEventListener('click', () => chargeModal.hidden = true);
chargeModal.addEventListener('click', e => { if (e.target === chargeModal) chargeModal.hidden = true; });

// EMV BR Code (PIX estático) + CRC16-CCITT
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
const emv = (id, v) => id + String(v.length).padStart(2, '0') + v;
const semAcento = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function pixPayload({ key, amount, txid }) {
  const mai = emv('00', 'br.gov.bcb.pix') + emv('01', key);
  let p = emv('00', '01') + emv('26', mai) + emv('52', '0000') + emv('53', '986');
  if (amount > 0) p += emv('54', amount.toFixed(2));
  p += emv('58', 'BR') + emv('59', 'DAVI HENRIQUE') + emv('60', 'PONTA GROSSA');
  p += emv('62', emv('05', txid));
  p += '6304';
  return p + crc16(p);
}

chForm.addEventListener('submit', async e => {
  e.preventDefault();
  const c = load().find(x => x.id === document.getElementById('chClienteId').value);
  if (!c) return;
  const key = chPixKey.value.trim();
  localStorage.setItem(PIX_KEY_STORE, key);
  const valor = +chValor.value;
  const txid = ('ALIVE' + semAcento(c.nome).replace(/[^A-Za-z0-9]/g, '').toUpperCase()).slice(0, 25);
  const code = pixPayload({ key, amount: valor, txid });
  const venc = new Date(chVenc.value + 'T12:00').toLocaleDateString('pt-BR');

  currentCharge = { cliente: c, valor, venc, desc: chDesc.value.trim() || 'Cobrança', code };
  document.getElementById('pixCode').value = code;
  const qrBox = document.getElementById('qrBox');
  qrBox.innerHTML = '';
  new QRCode(qrBox, { text: code, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
  chResult.hidden = false;
  chResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

document.getElementById('btnCopiar').addEventListener('click', async () => {
  await navigator.clipboard.writeText(document.getElementById('pixCode').value);
  document.getElementById('btnCopiar').textContent = '✓ Copiado!';
  setTimeout(() => document.getElementById('btnCopiar').textContent = 'Copiar código', 2000);
});

// ─── Arquivo de cobrança (imagem PNG) ───
function qrDataUrl() {
  const c = document.querySelector('#qrBox canvas');
  const i = document.querySelector('#qrBox img');
  return c ? c.toDataURL('image/png') : (i ? i.src : '');
}

function chargeImage() {
  return new Promise(resolve => {
    const { cliente, valor, venc, desc, code } = currentCharge;
    const W = 1080, H = 1660;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext('2d');

    // fundo e cabeçalho
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    const grad = x.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#2d5fd0'); grad.addColorStop(1, '#37d6ff');
    x.fillStyle = grad; x.fillRect(0, 0, W, 14);

    const logo = new Image();
    logo.onload = () => {
      const lw = 260, lh = lw * (logo.height / logo.width);
      x.drawImage(logo, 70, 60, lw, lh);

      x.fillStyle = '#0a1226';
      x.font = '700 52px Sora, Arial';
      x.fillText('Cobrança', 70, 300);
      x.fillStyle = '#667'; x.font = '400 30px Inter, Arial';
      x.fillText('Alive — Criação de Sites & Design', 70, 348);

      // dados
      const rows = [['Cliente', cliente.nome], ['Descrição', desc], ['Valor', fmt(valor)], ['Vencimento', venc]];
      let y = 440;
      rows.forEach(([k, v]) => {
        x.fillStyle = '#8a93a8'; x.font = '600 26px Inter, Arial';
        x.fillText(k.toUpperCase(), 70, y);
        x.fillStyle = '#0a1226'; x.font = (k === 'Valor' ? '800 46px' : '600 36px') + ' Sora, Arial';
        x.fillText(String(v).slice(0, 48), 70, y + 46);
        x.strokeStyle = '#e3e8f2'; x.beginPath(); x.moveTo(70, y + 74); x.lineTo(W - 70, y + 74); x.stroke();
        y += 130;
      });

      // QR
      const qr = new Image();
      qr.onload = () => {
        const qs = 380;
        x.fillStyle = '#f4f7fd';
        roundRect(x, 70, y + 10, W - 140, qs + 150, 26); x.fill();
        x.drawImage(qr, (W - qs) / 2, y + 40, qs, qs);
        x.fillStyle = '#3a4358'; x.font = '500 28px Inter, Arial'; x.textAlign = 'center';
        x.fillText('Pague com PIX: aponte a câmera do app do seu banco', W / 2, y + qs + 90);
        x.fillText('ou use o código copia e cola enviado junto.', W / 2, y + qs + 128);
        x.textAlign = 'left';

        // rodapé
        x.fillStyle = '#8a93a8'; x.font = '400 26px Inter, Arial';
        x.fillText('Davi Henrique · (42) 99931-8784 · davihenriqueded@gmail.com', 70, H - 60);

        cv.toBlob(b => resolve(b), 'image/png');
      };
      qr.src = qrDataUrl();
    };
    logo.src = 'assets/alive-logo.png';
  });
}

function roundRect(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

function chargeFileName() {
  const { cliente } = currentCharge;
  return 'cobranca-' + cliente.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
}

document.getElementById('btnArquivo').addEventListener('click', async () => {
  if (!currentCharge) return;
  const blob = await chargeImage();
  const file = new File([blob], chargeFileName(), { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Cobrança Alive' });
      return;
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  // fallback: baixa o arquivo (anexe no WhatsApp em seguida)
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = chargeFileName();
  a.click();
  URL.revokeObjectURL(a.href);
});

// Mensagem curta: descrição + código copiável (o arquivo vai em anexo)
document.getElementById('btnWhats').addEventListener('click', () => {
  if (!currentCharge) return;
  const { cliente, valor, venc, desc, code } = currentCharge;
  const primeiroNome = (cliente.contato || cliente.nome).split(/[—-]/)[0].trim().split(' ')[0];
  const msg = `Olá, ${primeiroNome}! Segue a cobrança em anexo 📎\n` +
    `${desc} · ${fmt(valor)} · vence ${venc}\n\n` +
    `PIX copia e cola:\n${code}`;
  const fone = clientPhone(cliente);
  window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, '_blank');
});

document.getElementById('btnImprimir').addEventListener('click', () => {
  if (!currentCharge) return;
  const { cliente, valor, venc, desc } = currentCharge;
  document.getElementById('prCliente').textContent = cliente.nome + (cliente.contato ? ' — ' + cliente.contato : '');
  document.getElementById('prDesc').textContent = desc;
  document.getElementById('prValor').textContent = fmt(valor);
  document.getElementById('prVenc').textContent = venc;
  document.getElementById('prCode').textContent = currentCharge.code;
  const qrCanvas = document.querySelector('#qrBox canvas');
  const qrImg = document.querySelector('#qrBox img');
  document.getElementById('prQr').src = qrCanvas ? qrCanvas.toDataURL('image/png') : (qrImg ? qrImg.src : '');
  window.print();
});

render();
