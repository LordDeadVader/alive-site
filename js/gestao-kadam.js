/* Painel Alive · gestão do Kadam Cut.
   Os dados ficam no servidor (Cloudflare). A senha é conferida lá; aqui só guardamos
   a sessão (válida por 12 horas) enquanto a aba estiver aberta. */

if (!sessionStorage.getItem('alive_session')) location.replace('login.html');

// Endereço da API. Para testar no computador: gestao-kadam.html?api=http://localhost:8788
const API = (() => {
  const p = new URLSearchParams(location.search).get('api');
  if (p && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(p)) sessionStorage.setItem('kadam_api', p);
  return (sessionStorage.getItem('kadam_api') || 'https://kadam-cut.pages.dev') + '/api/kadam/admin/';
})();

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = c => ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
const dataHora = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const diaBR = d => d ? d.split('-').reverse().join('/') : '—';
const MEIO = { pix: 'Pix', cartao: 'Cartão', boleto: 'Boleto', saldo: 'Saldo MP', dinheiro: 'Dinheiro', transferencia: 'Transferência', cortesia: 'Cortesia', manual: 'Manual' };
const ACAO = {
  venda: 'Venda', emissao: 'Licença criada', ativacao: 'Ativou um computador', desativacao: 'Liberou um computador',
  bloqueio: 'Licença bloqueada', desbloqueio: 'Licença desbloqueada', entrega: 'Entrega', email: 'E-mail enviado',
  erro_email: 'Falha no e-mail', erro_webhook: 'Erro no aviso do Mercado Pago', erro_checkout: 'Erro ao abrir pagamento',
  pagamento_divergente: 'Pagamento com valor diferente', admin_login: 'Entrada no painel', admin_login_falhou: 'Senha errada no painel',
  config: 'Configurações alteradas', erro_admin: 'Erro no painel', demo: 'Demonstração',
};

let token = sessionStorage.getItem('kadam_token') || '';
let cache = { licencas: [] };

async function api(rota, opts = {}) {
  const r = await fetch(API + rota, {
    method: opts.body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).catch(() => null);
  if (!r) throw new Error('Sem conexão com o servidor do Kadam.');
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && rota !== 'login') { sair(); throw new Error('Sessão expirada. Entre de novo.'); }
  if (!r.ok) throw new Error(j.mensagem || 'Erro ' + r.status);
  return j;
}

/* ─── Entrar / sair ─── */
function mostrar(logado) {
  $('telaLogin').hidden = logado; $('telaGestao').hidden = !logado; $('btnSair').hidden = !logado;
  if (logado) carregar(); else $('senha').focus();
}
function sair() { token = ''; sessionStorage.removeItem('kadam_token'); mostrar(false); }
$('btnSair').onclick = sair;
$('formLogin').onsubmit = async e => {
  e.preventDefault();
  $('loginMsg').hidden = true;
  try {
    const j = await api('login', { body: { senha: $('senha').value } });
    token = j.token; sessionStorage.setItem('kadam_token', token); $('senha').value = '';
    mostrar(true);
  } catch (err) { $('loginMsg').textContent = err.message; $('loginMsg').hidden = false; }
};

/* ─── Abas ─── */
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => abrirAba(b.dataset.tab));
function abrirAba(t) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  ['resumo', 'licencas', 'vendas', 'demos', 'config'].forEach(s => $('sec-' + s).hidden = s !== t);
  if (t === 'vendas') carregarVendas();
  if (t === 'demos') carregarDemos();
  if (t === 'config') carregarConfig();
}

/* ─── Resumo + licenças ─── */
async function carregar() {
  try {
    const [r, l] = await Promise.all([api('resumo'), api('licencas')]);
    cache.licencas = l.licencas;
    $('kLic').textContent = r.licencas.ativas;
    $('kPcs').textContent = r.computadores_ativos;
    $('kEntregar').textContent = r.licencas.a_entregar;
    $('kDemo').textContent = r.demos.em_teste;
    $('kDemo7').textContent = `${r.demos.d7} em 7 dias · ${r.demos.d7_compras} compraram`;
    $('kDemo30').textContent = r.demos.d30;
    $('kDemo30c').textContent = `${r.demos.d30_compras} viraram compra`;
    $('kMes').textContent = brl(r.vendas.mes_bruto);
    $('kMesQtd').textContent = `${r.vendas.mes_qtd} venda${r.vendas.mes_qtd === 1 ? '' : 's'}`;
    $('kLiq').textContent = brl(r.vendas.liquido);
    $('kLiqQtd').textContent = `${r.vendas.qtd} venda${r.vendas.qtd === 1 ? '' : 's'} no total`;
    $('nEntregar').textContent = r.licencas.a_entregar; $('nEntregar').hidden = !r.licencas.a_entregar;
    $('histResumo').innerHTML = r.historico.length ? r.historico.map(h => `
      <li><time>${dataHora(h.criado_em)}</time><span>${h.licenca ? `<button class="link-btn" data-lic="${h.licenca}">Nº ${h.licenca}</button> · ` : ''}<b>${esc(ACAO[h.acao] || h.acao)}</b>${h.detalhe ? ` <span class="muted">· ${esc(h.detalhe)}</span>` : ''}</span></li>`).join('')
      : '<li class="vazio">Nada ainda.</li>';
    const av = [];
    if (r.licencas.a_entregar) av.push(`<div class="aviso aviso-warn">${r.licencas.a_entregar} chave${r.licencas.a_entregar > 1 ? 's' : ''} para enviar. Veja em <button class="link-btn" data-aba="licencas">Licenças</button>.</div>`);
    if (!r.brevo) av.push('<div class="aviso aviso-warn">O envio de e-mails ainda não está ligado (falta a BREVO_API_KEY na Cloudflare). Até lá, mande a chave pelo seu e-mail ou WhatsApp e marque como enviada.</div>');
    $('avisos').innerHTML = av.join('');
    renderLicencas();
  } catch (err) { $('avisos').innerHTML = `<div class="aviso aviso-bad">${esc(err.message)}</div>`; }
}
$('btnAtualizar').onclick = carregar;
document.addEventListener('click', e => {
  const l = e.target.closest('[data-lic]'); if (l) abrirLicenca(Number(l.dataset.lic));
  const a = e.target.closest('[data-aba]'); if (a) { abrirAba(a.dataset.aba); if (a.dataset.aba === 'licencas') { $('fLic').value = 'entregar'; renderLicencas(); } }
  if (e.target.closest('[data-fechar]') || e.target.classList.contains('modal')) document.querySelectorAll('.modal').forEach(m => m.hidden = true);
});

function situacao(l) {
  if (l.status === 'bloqueada') return '<span class="tag tag-bad">Bloqueada</span>';
  if (!l.entregue_em) return '<span class="tag tag-warn">Enviar chave</span>';
  return '<span class="tag tag-ok">Ativa</span>';
}
function renderLicencas() {
  const q = $('buscaLic').value.trim().toLowerCase(), f = $('fLic').value;
  const lista = cache.licencas.filter(l =>
    (!q || [l.numero, l.nome, l.email, l.whatsapp].join(' ').toLowerCase().includes(q)) &&
    (!f || (f === 'entregar' ? l.status === 'ativa' && !l.entregue_em : l.status === f)));
  $('tbLic').innerHTML = lista.length ? lista.map(l => `
    <tr class="click" data-lic="${l.numero}">
      <td>${l.numero}</td>
      <td>${esc(l.nome)}<small>${esc(l.email)}</small></td>
      <td>${l.tipo === 2 ? 'Empresa' : 'Individual'}</td>
      <td>${l.ativos} de ${l.max_computadores}${l.ultima_ativacao ? `<small>última: ${data(l.ultima_ativacao)}</small>` : ''}</td>
      <td class="num">${l.valor ? brl(l.valor) : (l.origem === 'manual' ? 'Cortesia' : '—')}${l.meio && l.valor ? `<small>${MEIO[l.meio] || esc(l.meio)}</small>` : ''}</td>
      <td>${diaBR(l.suporte_ate)}</td>
      <td>${situacao(l)}</td>
    </tr>`).join('') : '<tr><td colspan="7" class="vazio">Nenhuma licença encontrada.</td></tr>';
}
$('buscaLic').oninput = renderLicencas;
$('fLic').onchange = renderLicencas;

$('btnCsv').onclick = () => {
  const linhas = [['Nº', 'Cliente', 'E-mail', 'WhatsApp', 'Tipo', 'Computadores ativos', 'Limite', 'Valor', 'Compra', 'Suporte até', 'Situação', 'Chave enviada em', 'Observação']];
  cache.licencas.forEach(l => linhas.push([l.numero, l.nome, l.email, l.whatsapp || '', l.tipo === 2 ? 'Empresa' : 'Individual', l.ativos, l.max_computadores,
    ((l.valor || 0) / 100).toFixed(2).replace('.', ','), diaBR(l.compra), diaBR(l.suporte_ate), l.status, l.entregue_em ? data(l.entregue_em) : '', l.obs || '']));
  const csv = '﻿' + linhas.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `kadam-licencas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
};

/* ─── Detalhe da licença ─── */
async function abrirLicenca(n) {
  const box = $('mLicBody');
  box.innerHTML = '<p class="muted">Carregando…</p>'; $('mLic').hidden = false;
  try {
    const { licenca: l, ativacoes, compras, historico } = await api('licenca?numero=' + n);
    const ativos = ativacoes.filter(a => !a.liberado_em);
    const wa = l.whatsapp ? `https://wa.me/55${l.whatsapp.replace(/\D/g, '').replace(/^55/, '')}` : '';
    box.innerHTML = `
      <div class="modal-head">
        <div><h2>Licença nº ${l.numero} · ${esc(l.nome)}</h2><p class="muted">${esc(l.email)}${l.whatsapp ? ' · ' + esc(l.whatsapp) : ''}</p></div>
        <button class="btn btn-sm" data-fechar>Fechar</button>
      </div>
      <div class="dados">
        <div><span>Situação</span><strong>${situacao(l)}</strong></div>
        <div><span>Tipo</span><strong>${l.tipo === 2 ? 'Empresa' : 'Individual'}</strong></div>
        <div><span>Computadores</span><strong>${ativos.length} de ${l.max_computadores}</strong></div>
        <div><span>Compra</span><strong>${diaBR(l.compra)}</strong></div>
        <div><span>Suporte até</span><strong>${diaBR(l.suporte_ate)}</strong></div>
        <div><span>Chave enviada</span><strong>${l.entregue_em ? data(l.entregue_em) : 'Não'}</strong></div>
      </div>

      <div class="secao">
        <h3>Chave</h3>
        <div class="chave" id="chaveTxt">${esc(l.chave)}</div>
        <div class="linha" style="margin-top:10px">
          <button class="btn btn-sm" id="bCopiar">Copiar chave</button>
          <button class="btn btn-primary btn-sm" id="bEnviar" ${l.status !== 'ativa' ? 'disabled' : ''}>Enviar chave e download por e-mail</button>
          ${wa ? `<a class="btn btn-sm" target="_blank" rel="noopener" href="${wa}">Abrir WhatsApp</a>` : ''}
          <button class="btn btn-sm" id="bEntregue">${l.entregue_em ? 'Marcar como não enviada' : 'Marcar como enviada'}</button>
        </div>
        <p id="msgLic" class="aviso" style="margin-top:10px" hidden></p>
      </div>

      <div class="secao">
        <h3>Computadores</h3>
        <div class="box table-wrap" style="margin:0">
          <table><thead><tr><th>Computador</th><th>Versão</th><th>Ativado em</th><th>Situação</th><th></th></tr></thead><tbody>
          ${ativacoes.length ? ativacoes.map(a => `<tr>
            <td style="font-family:Consolas,monospace">${esc(a.computador)}</td><td>${esc(a.versao || '—')}</td><td>${dataHora(a.criado_em)}</td>
            <td>${a.liberado_em ? `<span class="tag">Liberado ${data(a.liberado_em)}</span>` : '<span class="tag tag-ok">Em uso</span>'}</td>
            <td class="num">${a.liberado_em ? '' : `<button class="icon-btn" data-liberar="${esc(a.computador)}">Liberar</button>`}</td></tr>`).join('')
          : '<tr><td colspan="5" class="vazio">Ainda não foi ativada em nenhum computador.</td></tr>'}
          </tbody></table>
        </div>
        <p class="muted" style="margin-top:6px">"Liberar" abre a vaga para o cliente ativar em outro computador (ex.: computador quebrou).</p>
      </div>

      <div class="secao">
        <h3>Ativar sem internet</h3>
        <p class="muted" style="margin-bottom:8px">O cliente sem internet te manda o código do computador (13 letras e números que aparecem no Kadam Cut). Cole aqui e mande de volta o código de ativação. Este computador entra na contagem.</p>
        <div class="linha"><input type="text" id="manualPc" style="flex:1;font-family:Consolas,monospace" placeholder="Código do computador" ${l.status !== 'ativa' ? 'disabled' : ''}><button class="btn btn-sm" id="bManual" ${l.status !== 'ativa' ? 'disabled' : ''}>Gerar código de ativação</button></div>
        <div id="manualOut" hidden style="margin-top:10px"><div class="chave" id="manualCod"></div><div class="linha" style="margin-top:8px"><button class="btn btn-sm" id="bCopiarManual">Copiar código de ativação</button><span class="muted" id="manualInfo"></span></div></div>
      </div>

      ${compras.length ? `<div class="secao"><h3>Pagamento</h3><div class="dados">${compras.map(c => `
        <div><span>Valor</span><strong>${c.valor_centavos ? brl(c.valor_centavos) : 'Cortesia'}</strong></div>
        <div><span>Forma</span><strong>${MEIO[c.meio] || esc(c.meio || '—')}${c.parcelas > 1 ? ` em ${c.parcelas}x` : ''}</strong></div>
        <div><span>Taxa Mercado Pago</span><strong>${c.taxa_centavos != null ? brl(c.taxa_centavos) : '—'}</strong></div>
        <div><span>Situação</span><strong>${{ aprovada: 'Paga', cortesia: 'Cortesia', reembolsada: 'Reembolsada', chargeback: 'Contestada', pendente: 'Pendente' }[c.status] || esc(c.status)}</strong></div>`).join('')}</div></div>` : ''}

      <div class="secao">
        <h3>Observação</h3>
        <div class="linha"><input type="text" id="obsTxt" style="flex:1" value="${esc(l.obs || '')}" placeholder="Anotação só sua"><button class="btn btn-sm" id="bObs">Salvar</button></div>
      </div>

      <div class="secao">
        <h3>Histórico</h3>
        <ul class="hist box" style="margin:0">${historico.map(h => `<li><time>${dataHora(h.criado_em)}</time><span><b>${esc(ACAO[h.acao] || h.acao)}</b>${h.detalhe ? ` <span class="muted">· ${esc(h.detalhe)}</span>` : ''}</span></li>`).join('') || '<li class="vazio">Sem registros.</li>'}</ul>
      </div>

      <div class="secao linha" style="justify-content:space-between;border-top:1px solid var(--line);padding-top:16px">
        <span class="muted">${l.status === 'ativa' ? 'Bloquear impede a chave de ativar em qualquer computador.' : 'Desbloquear volta a aceitar a chave.'}</span>
        <button class="btn btn-sm ${l.status === 'ativa' ? 'btn-danger' : ''}" id="bBloq">${l.status === 'ativa' ? 'Bloquear licença' : 'Desbloquear licença'}</button>
      </div>`;

    const msg = (t, tipo = 'ok') => { const m = $('msgLic'); m.className = 'aviso aviso-' + tipo; m.textContent = t; m.hidden = false; };
    const fazer = async (body, ok) => { try { await api('acao', { body: { numero: l.numero, ...body } }); await carregar(); await abrirLicenca(l.numero); if (ok) msg(ok); } catch (err) { msg(err.message, 'bad'); } };

    $('bCopiar').onclick = async () => { await navigator.clipboard.writeText(l.chave); $('bCopiar').textContent = 'Copiada'; setTimeout(() => $('bCopiar') && ($('bCopiar').textContent = 'Copiar chave'), 1500); };
    $('bEnviar').onclick = async () => {
      if (!confirm(`Enviar a chave e o link de download para ${l.email}?`)) return;
      $('bEnviar').disabled = true; $('bEnviar').textContent = 'Enviando…';
      await fazer({ acao: 'enviar_chave' }, `E-mail enviado para ${l.email}.`);
    };
    $('bEntregue').onclick = () => fazer({ acao: 'entregue', entregue: !l.entregue_em });
    $('bObs').onclick = () => fazer({ acao: 'obs', obs: $('obsTxt').value }, 'Observação salva.');
    $('bBloq').onclick = () => {
      if (l.status === 'ativa') { const m = prompt('Motivo do bloqueio (ex.: reembolso, uso indevido):'); if (m === null) return; fazer({ acao: 'bloquear', motivo: m }); }
      else if (confirm('Desbloquear esta licença?')) fazer({ acao: 'desbloquear' });
    };
    $('bManual').onclick = async () => {
      try {
        const j = await api('acao', { body: { acao: 'ativar_manual', numero: l.numero, computador: $('manualPc').value } });
        await carregar();
        await abrirLicenca(l.numero);
        $('manualCod').textContent = j.ativacao;
        $('manualInfo').textContent = `Licença com ${j.computadores} computadores.`;
        $('manualOut').hidden = false;
        $('bCopiarManual').onclick = async () => { await navigator.clipboard.writeText(j.ativacao); $('bCopiarManual').textContent = 'Copiado'; };
      } catch (err) { msg(err.message, 'bad'); }
    };
    box.querySelectorAll('[data-liberar]').forEach(b => b.onclick = () => {
      if (confirm(`Liberar o computador ${b.dataset.liberar}? O cliente poderá ativar em outro.`)) fazer({ acao: 'liberar', computador: b.dataset.liberar }, 'Computador liberado.');
    });
  } catch (err) { box.innerHTML = `<div class="aviso aviso-bad">${esc(err.message)}</div><button class="btn btn-sm" data-fechar>Fechar</button>`; }
}

/* ─── Vendas ─── */
const SIT_VENDA = { aberto: ['Não concluída', ''], aprovado: ['Paga', 'tag-ok'], reembolsado: ['Reembolsada', 'tag-bad'], chargeback: ['Contestada', 'tag-bad'], cancelado: ['Cancelada', ''] };
async function carregarVendas() {
  $('tbVendas').innerHTML = '<tr><td colspan="7" class="vazio">Carregando…</td></tr>';
  try {
    const { vendas } = await api('vendas');
    $('tbVendas').innerHTML = vendas.length ? vendas.map(v => {
      const [txt, cls] = SIT_VENDA[v.status] || [v.status, ''];
      return `<tr>
        <td>${dataHora(v.criado_em)}</td>
        <td>${esc(v.nome)}<small>${esc(v.email)}</small></td>
        <td>${MEIO[v.meio] || esc(v.meio)}${v.parcelas > 1 ? ` em ${v.parcelas}x` : ''}</td>
        <td class="num">${brl(v.pago_centavos ?? v.valor_centavos)}</td>
        <td class="num">${v.taxa_centavos != null ? brl(v.taxa_centavos) : '—'}</td>
        <td><span class="tag ${cls}">${txt}</span></td>
        <td>${v.licenca ? `<button class="link-btn" data-lic="${v.licenca}">Nº ${v.licenca}</button>` : '—'}</td></tr>`;
    }).join('') : '<tr><td colspan="7" class="vazio">Nenhuma compra pelo site ainda.</td></tr>';
  } catch (err) { $('tbVendas').innerHTML = `<tr><td colspan="7" class="vazio">${esc(err.message)}</td></tr>`; }
}

/* ─── Demonstrações ─── */
let demosCache = [], demoAberta = null;
const tempo = m => { const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${String(r).padStart(2, '0')}` : `${r} min`; };
async function carregarDemos() {
  $('tbDemos').innerHTML = '<tr><td colspan="9" class="vazio">Carregando…</td></tr>';
  try { demosCache = (await api('demos')).demos; renderDemos(); }
  catch (err) { $('tbDemos').innerHTML = `<tr><td colspan="9" class="vazio">${esc(err.message)}</td></tr>`; }
}
function situacaoDemo(d) {
  if (d.licenca) return `<button class="link-btn" data-lic="${d.licenca}">Comprou: licença nº ${d.licenca}</button>`;
  if (d.restante_min > 0) return `<span class="tag tag-info">Faltam ${tempo(d.restante_min)}</span>`;
  return `<span class="tag">${d.encerrada_por === 'admin' ? 'Encerrada' : 'Terminada'}</span>`;
}
function renderDemos() {
  const q = $('buscaDemo').value.trim().toUpperCase().replace(/[-\s]/g, ''), f = $('fDemo').value;
  const lista = demosCache.filter(d => (!q || d.computador.includes(q) || (d.obs || '').toUpperCase().includes(q)) &&
    (!f || (f === 'comprou' ? d.licenca : f === 'ativa' ? d.restante_min > 0 && !d.licenca : d.restante_min === 0 && !d.licenca)));
  $('tbDemos').innerHTML = lista.length ? lista.map(d => `<tr>
    <td style="font-family:Consolas,monospace">${esc(d.computador)}</td>
    <td>${dataHora(d.inicio)}</td>
    <td>${dataHora(d.fim)}</td>
    <td>${situacaoDemo(d)}</td>
    <td>${esc(d.versao || '—')}</td>
    <td class="num">${d.usos}</td>
    <td>${dataHora(d.ultimo_uso)}</td>
    <td>${esc(d.obs || '')}</td>
    <td class="num"><button class="icon-btn" data-demo="${esc(d.computador)}">Gerenciar</button></td>
  </tr>`).join('') : '<tr><td colspan="9" class="vazio">Nenhuma demonstração ainda.</td></tr>';
}
$('buscaDemo').oninput = renderDemos;
$('fDemo').onchange = renderDemos;
$('tbDemos').addEventListener('click', e => {
  const b = e.target.closest('[data-demo]'); if (!b) return;
  demoAberta = demosCache.find(x => x.computador === b.dataset.demo);
  $('mdInfo').textContent = `${demoAberta.computador} · fim ${dataHora(demoAberta.fim)}`;
  $('mdObs').value = demoAberta.obs || ''; $('mdAte').value = ''; $('mdMsg').hidden = true;
  $('mDemo').hidden = false;
});
async function acaoDemo(body, ok) {
  try {
    const j = await api('acao', { body: { computador: demoAberta.computador, ...body } });
    await carregarDemos(); carregar();
    demoAberta = demosCache.find(x => x.computador === demoAberta.computador);
    $('mdInfo').textContent = `${demoAberta.computador} · fim ${dataHora(demoAberta.fim)}`;
    $('mdMsg').className = 'aviso aviso-ok'; $('mdMsg').textContent = ok || (j.fim ? 'Novo fim: ' + dataHora(j.fim) : 'Salvo.'); $('mdMsg').hidden = false;
  } catch (err) { $('mdMsg').className = 'aviso aviso-bad'; $('mdMsg').textContent = err.message; $('mdMsg').hidden = false; }
}
document.querySelectorAll('[data-mais]').forEach(b => b.onclick = () => acaoDemo({ acao: 'demo_mais_tempo', minutos: Number(b.dataset.mais) }));
$('mdAteBtn').onclick = () => { if (!$('mdAte').value) return; acaoDemo({ acao: 'demo_mais_tempo', ate: new Date($('mdAte').value).toISOString() }); };
$('mdObsBtn').onclick = () => acaoDemo({ acao: 'demo_obs', obs: $('mdObs').value }, 'Anotação salva.');
$('mdEncerrar').onclick = () => { if (confirm('Encerrar a demonstração deste computador agora?')) acaoDemo({ acao: 'demo_encerrar' }, 'Demonstração encerrada.'); };

/* ─── Configurações ─── */
const CAMPOS = { cfPix: ['preco_pix_centavos', 'reais'], cfCartao: ['preco_cartao_centavos', 'reais'], cfParcelas: ['parcelas_max'], cfSuporte: ['suporte_dias'],
  cfTroca: ['troca_intervalo_dias'], cfDemo: ['demo_minutos'], cfCheckout: ['checkout_ativo'], cfVersao: ['versao_atual'], cfLink: ['link_instalador'], cfTitulo: ['produto_titulo'] };
async function carregarConfig() {
  try {
    const { config } = await api('config');
    for (const [id, [k, t]] of Object.entries(CAMPOS)) $(id).value = t === 'reais' ? (Number(config[k] || 0) / 100).toFixed(2) : (config[k] ?? (id === 'cfCheckout' ? '0' : ''));
  } catch (err) { $('cfMsg').textContent = err.message; }
}
$('formConfig').onsubmit = async e => {
  e.preventDefault();
  const valores = {};
  for (const [id, [k, t]] of Object.entries(CAMPOS)) valores[k] = t === 'reais' ? String(Math.round(Number($(id).value) * 100)) : $(id).value.trim();
  try { await api('config', { body: { valores } }); $('cfMsg').textContent = 'Salvo.'; } catch (err) { $('cfMsg').textContent = err.message; }
  setTimeout(() => $('cfMsg').textContent = '', 3000);
};

/* ─── Nova licença ─── */
$('btnEmitir').onclick = () => { $('formEmitir').reset(); $('emPcs').disabled = true; $('emMsg').hidden = true; $('mEmitir').hidden = false; $('emNome').focus(); };
$('emTipo').onchange = () => { const emp = $('emTipo').value === 'empresa'; $('emPcs').disabled = !emp; $('emPcs').value = emp ? 2 : 1; };
$('formEmitir').onsubmit = async e => {
  e.preventDefault();
  try {
    const j = await api('acao', { body: { acao: 'emitir', nome: $('emNome').value, email: $('emEmail').value, whatsapp: $('emWhats').value, tipo: $('emTipo').value,
      pcs: Number($('emPcs').value), valor: Number($('emValor').value || 0), meio: $('emMeio').value, suporte_dias: $('emSuporte').value || undefined, obs: $('emObs').value } });
    $('mEmitir').hidden = true;
    await carregar();
    abrirLicenca(j.numero);
  } catch (err) { $('emMsg').textContent = err.message; $('emMsg').hidden = false; }
};

mostrar(!!token);
