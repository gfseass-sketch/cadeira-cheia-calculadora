/* ═══════════════════════════════════════════════════════════════════
   Cadeira Cheia — Calculadora de Cadeira Vazia
   Sem dependências. Funciona em file:// e em http://localhost:3001
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ── CONFIGURAÇÃO ──────────────────────────────────────────────────
   ⚠️ Troque pelo seu número real (com DDI, sem + e sem espaços).
   Teste rápido de outro número:  http://localhost:3001/?wa=5511999999999
   ─────────────────────────────────────────────────────────────────── */
const CONFIG = {
  whatsappNumero: '5535991485424',   // DDI + DDD + número, sem + e sem espaços
  empresa: 'Cadeira Cheia',
  // Parâmetros de mercado (fontes no README do projeto)
  TICKET_KIT:       147,      // preço do kit Essencial
  RECUP_NO_SHOW:    0.40,     // queda conservadora do no-show com régua de 4 toques
  LEAD_CONV_WA:     0.12,     // lead → agendamento via WhatsApp
  LEAD_CONV_RESP:   0.21,     // lead → agendamento entre os que respondem
  MSG_UTILITY:      0.0350,   // Meta BR — template Utility (rate card BRL, vigente 01/10/2026)
  TOQUES_POR_AGEND: 3.2,      // toques Utility por agendamento
  MIN_POR_ATEND:    3.3       // min de confirmação por atendimento (base: 900 agend/mês → 50 h/mês)
};

const params = new URLSearchParams(location.search);
if (params.get('wa')) CONFIG.whatsappNumero = params.get('wa');
if (CONFIG.whatsappNumero === '5500000000000') {
  console.warn('[Cadeira Cheia] Defina CONFIG.whatsappNumero em assets/app.js');
}

/* ── Helpers ─────────────────────────────────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const brl = n => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = n => Math.round(n || 0).toLocaleString('pt-BR');

/** Aceita "80", "1.200", "1,5", "R$ 300,50" → number */
function parseNum(raw, integer = true) {
  if (typeof raw === 'number') return integer ? Math.round(raw) : raw;
  if (!raw) return NaN;
  let s = String(raw).replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  const hasC = s.includes(','), hasD = s.includes('.');
  if (hasC && hasD)      s = s.replace(/\./g, '').replace(',', '.');   // 1.200,50
  else if (hasC)         s = s.replace(',', '.');                        // 300,50
  else if (hasD) {
    const parts = s.split('.');
    s = (parts.length === 2 && parts[1].length === 3)
      ? parts.join('')                                                // 1.200 → 1200
      : s;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? (integer ? Math.round(n) : n) : NaN;
}

function plural(n, um, muitos) { return n === 1 ? um : muitos; }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('is-on'), 2600);
}

/* ── Definição das perguntas ──────────────────────────────────────── */
const QUESTIONS = {
  atendimentos: { label: 'atendimentos por mês', chips: [40, 60, 80, 120, 200], fmt: v => num(v) + ' atend./mês' },
  ticket:       { label: 'ticket médio',            chips: [180, 280, 380, 500, 700], fmt: v => brl(v) },
  falta:        { label: 'de faltas',               chips: [10, 15, 20, 25, 30, 40], fmt: v => v + '%' },
  leads:        { label: 'leads por mês',           chips: [50, 100, 150, 300, 500], fmt: v => num(v) + ' leads/mês' },
  resposta:     { label: 'respondidos em <5 min',   chips: [20, 40, 60, 80, 100], fmt: v => v + '%' }
};
const ORDER = ['atendimentos', 'ticket', 'falta', 'leads', 'resposta'];

const state = {
  step: 0,
  values: { atendimentos: 80, ticket: 300, falta: 25, leads: 150, resposta: 40 },
  result: null
};

/* ── Montagem dos chips ──────────────────────────────────────────── */
function buildChips(key) {
  const host = $(`[data-chips="${key}"]`);
  if (!host) return;
  host.innerHTML = '';
  QUESTIONS[key].chips.forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.dataset.value = v;
    b.textContent = key === 'ticket' ? brl(v) : (key === 'falta' || key === 'resposta' ? v + '%' : num(v));
    b.addEventListener('click', () => {
      state.values[key] = v;
      const input = $('#' + key);
      if (input) input.value = v;
      $$('.chip', host).forEach(c => {
        const on = Number(c.dataset.value) === v;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      clearError(key);
      // avança sozinho em perguntas de escolha única
      if (key !== 'atendimentos' && key !== 'ticket') setTimeout(() => next(), 220);
    });
    host.appendChild(b);
  });
}

/* ── Navegação entre passos ──────────────────────────────────────── */
function showStep(i) {
  state.step = Math.max(0, Math.min(ORDER.length - 1, i));
  $$('.step').forEach(s => { s.hidden = Number(s.dataset.step) !== state.step + 1; });
  const pct = ((state.step + 1) / ORDER.length) * 100;
  $('#progress-bar').style.width = pct + '%';
  $('#progress-label').textContent = `${state.step + 1} de ${ORDER.length}`;
  $('#btn-back').hidden = state.step === 0;
  $('#btn-next').textContent = state.step === ORDER.length - 1 ? 'Ver meu resultado' : 'Continuar';

  // pré-preenche o campo com o valor atual
  const key = ORDER[state.step];
  const input = $('#' + key);
  if (input && document.activeElement !== input) input.value = state.values[key];
  syncChips(key);
  if (input) input.focus({ preventScroll: true });
}

function syncChips(key) {
  const host = $(`[data-chips="${key}"]`);
  if (!host) return;
  $$('.chip', host).forEach(c => {
    const on = Number(c.dataset.value) === Number(state.values[key]);
    c.classList.toggle('is-active', on);
    c.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function readStep() {
  const key = ORDER[state.step];
  const input = $('#' + key);

  // Perguntas de escolha única (falta, resposta): não têm input, usam o chip selecionado
  if (!input) {
    const v = state.values[key];
    if (!Number.isFinite(v) || v <= 0) {
      setError(key, 'Selecione uma das opções acima.');
      return false;
    }
    clearError(key);
    return true;
  }

  const raw = input.value;
  const v = parseNum(raw, key !== 'ticket');
  if (!Number.isFinite(v) || v <= 0) {
    setError(key, 'Preencha com um número maior que zero.');
    input.focus();
    return false;
  }
  state.values[key] = v;
  clearError(key);
  return true;
}

function next() {
  if (!readStep()) return;
  if (state.step < ORDER.length - 1) { showStep(state.step + 1); }
  else { calculate(); }
}
function back() {
  if (state.step > 0) showStep(state.step - 1);
}

function setError(key, msg) { const e = $(`[data-err="${key}"]`); if (e) e.textContent = msg; }
function clearError(key) { setError(key, ''); }

/* ── Cálculo ─────────────────────────────────────────────────────── */
function calculate() {
  const { atendimentos, ticket, falta, leads, resposta } = state.values;
  const C = CONFIG;

  const faltas          = atendimentos * (falta / 100);
  const perdaNoShow    = faltas * ticket;
  const faltasRecuper  = faltas * C.RECUP_NO_SHOW;
  const recupNoShow    = faltasRecuper * ticket;

  const leadsNaoAtend  = leads * (1 - resposta / 100);
  // agendamento é inteiro: 90 leads esfriados × 0,09 = 8,1 → 8 agendamentos
  const agendExtras    = Math.round(leadsNaoAtend * (C.LEAD_CONV_RESP - C.LEAD_CONV_WA));
  const recupLead      = agendExtras * ticket;

  const total          = recupNoShow + recupLead;
  const custoWa        = atendimentos * C.TOQUES_POR_AGEND * C.MSG_UTILITY;
  const paybackDias    = total > 0 ? C.TICKET_KIT / (total / 30) : Infinity;
  const fat12          = total * 12;
  const horasEquipe    = atendimentos * C.MIN_POR_ATEND / 60;

  state.result = {
    atendimentos, ticket, falta, leads, resposta,
    faltas, perdaNoShow, faltasRecuper, recupNoShow,
    leadsNaoAtend, agendExtras, recupLead,
    total, custoWa, paybackDias, fat12, horasEquipe
  };

  render();
  $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function paybackLabel(d) {
  if (!Number.isFinite(d)) return '—';
  if (d < 1)    return 'menos de 1 dia';
  if (d < 30)   return `${Math.ceil(d)} dias`;
  return `${(d / 30).toFixed(1).replace('.', ',')} meses`;
}

function render() {
  const r = state.result;
  if (!r) return;

  $('#r-loss').textContent = brl(r.perdaNoShow);
  $('#r-loss-label').textContent = 'Sua clínica perde';

  $('#r-noshow').textContent = brl(r.recupNoShow);
  $('#r-noshow-desc').textContent =
    `${num(r.faltas)} faltas/mês → ${num(r.faltasRecuper)} recuperadas com a régua de confirmação`;

  $('#r-lead').textContent = brl(r.recupLead);
  $('#r-lead-desc').textContent =
    `${num(r.leadsNaoAtend)} leads/mês sem resposta em 5 min → ${num(r.agendExtras)} agendamentos a mais`;

  $('#r-total').textContent = brl(r.total);
  $('#r-payback').textContent = paybackLabel(r.paybackDias);

  const facts = [
    `<strong>${num(r.faltas)} ${plural(r.faltas, 'falta', 'faltas')} por mês</strong> — ${num(r.faltas)} horários pagos sem ninguém sentado.`,
    `Em 12 meses, <strong>${brl(r.fat12)}</strong> recuperáveis.`,
    `Custo do WhatsApp da clínica: <strong>~${brl(r.custoWa)}/mês</strong> (4 toques por atendimento).`,
    `Hoje sua equipe gasta <strong>~${r.horasEquipe.toFixed(1).replace('.', ',')} h/mês</strong> só confirmando horário.`
  ];
  const ul = $('.result-facts');
  ul.innerHTML = '';
  facts.forEach(f => {
    const li = document.createElement('li');
    li.innerHTML = f;
    ul.appendChild(li);
  });

  $('#calc-form').hidden = true;
  $('#progress-wrap').hidden = true;
  $('#result').hidden = false;
  $('#lead-summary').textContent = buildSummary();
  updateWaLinks();
  saveLocal();
}

function buildSummary() {
  const r = state.result;
  if (!r) return '';
  return [
    '=== CALCULADORA DE CADEIRA VAZIA ===',
    '',
    'PERFIL DA CLÍNICA',
    `• Atendimentos/mês ............ ${num(r.atendimentos)}`,
    `• Ticket médio ................ ${brl(r.ticket)}`,
    `• Taxa de falta ............... ${r.falta}%`,
    `• Leads/mês ................... ${num(r.leads)}`,
    `• Respondidos em <5 min ....... ${r.resposta}%`,
    '',
    'RESULTADO',
    `• Faltas por mês .............. ${num(r.faltas)}`,
    `• Perda atual ................. ${brl(r.perdaNoShow)}/mês`,
    `• Recuperável (no-show) ...... ${brl(r.recupNoShow)}/mês`,
    `• Recuperável (lead esfriou).. ${brl(r.recupLead)}/mês`,
    `• TOTAL RECUPERÁVEL .......... ${brl(r.total)}/mês`,
    `• Em 12 meses ................. ${brl(r.fat12)}`,
    `• Custo do WhatsApp ........... ~${brl(r.custoWa)}/mês`,
    `• Payback do kit (R$147) ...... ${paybackLabel(r.paybackDias)}`,
    '',
    'Estimativa baseada em faixas de mercado. Não é garantia de resultado.',
    `Gerado em ${new Date().toLocaleString('pt-BR')}`
  ].join('\n');
}

function waLink(text) {
  return `https://wa.me/${CONFIG.whatsappNumero}?text=${encodeURIComponent(text)}`;
}

function updateWaLinks() {
  const r = state.result;
  const generic = 'Oi! Quero calcular quanto minha clínica odontológica está perdendo em faltas.';

  const msg = !r ? generic : [
    'Oi! Quero o plano da Calculadora de Cadeira Vazia.',
    '',
    'Minha clínica:',
    `• Atendimentos/mês: ${num(r.atendimentos)}`,
    `• Ticket médio: ${brl(r.ticket)}`,
    `• Faltas: ${r.falta}%`,
    `• Leads/mês: ${num(r.leads)}`,
    `• Respondidos em <5 min: ${r.resposta}%`,
    '',
    'Meu cálculo:',
    `• Perda atual: ${brl(r.perdaNoShow)}/mês`,
    `• Recuperável: ${brl(r.total)}/mês`,
    `• Payback do kit (R$147): ${paybackLabel(r.paybackDias)}`
  ].join('\n');

  $('#r-wa').href    = waLink(msg);
  $('#hero-wa').href = waLink(generic);
  $('#lead-wa').href = waLink(msg);
}

/* ── Lead form ───────────────────────────────────────────────────── */
const LS_KEY = 'cadeira-cheia/leads';

function saveLocal() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    arr.push({ ...state.values, ...state.result, ts: new Date().toISOString() });
    localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(-50)));
  } catch (e) { /* storage indisponível — segue sem salvar */ }
}

async function submitLead(e) {
  e.preventDefault();
  const f = e.target;
  const data = Object.fromEntries(new FormData(f).entries());
  const payload = { ...data, ...state.values, ...state.result, origem: 'calculadora', ts: new Date().toISOString() };

  const btn = $('#lead-submit');
  btn.disabled = true;
  btn.textContent = 'Enviando…';

  let saved = false;
  try {
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    saved = res.ok;
  } catch (err) {
    saved = false;
  }

  try {
    const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    arr.push({ ...data, ...state.values, ts: new Date().toISOString() });
    localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(-50)));
  } catch (err) { /* ignora */ }

  btn.disabled = false;
  btn.textContent = 'Receber meu plano';

  $('#lead-form').hidden = true;
  $('#lead-done').hidden = false;
  $('#lead-done').querySelector('h3').textContent = `Resumo gerado, ${data.nome || 'vamos lá'}.`;

  if (saved) {
    $('#lead-note').textContent = 'Lead salvo no servidor local (data/leads.jsonl). Toque no botão para enviar pelo WhatsApp.';
    toast('Plano salvo ✓');
  } else {
    $('#lead-note').textContent = 'Resumo pronto ✓ Toque em "Enviar pelo WhatsApp" para eu te devolver o plano completo com os seus números.';
    toast('Resumo pronto ✓');
  }
  updateWaLinks();
  $('#lead-done').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ── Copiar / Baixar ─────────────────────────────────────────────── */
async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg || 'Copiado ✓');
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    toast(ok ? (okMsg || 'Copiado ✓') : 'Não consegui copiar — selecione manualmente');
    return ok;
  }
}

function downloadTxt() {
  const blob = new Blob([buildSummary()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cadeira-vazia-resultado.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('Arquivo baixado ✓');
}

/* ── Boot ────────────────────────────────────────────────────────── */
function init() {
  Object.keys(QUESTIONS).forEach(buildChips);

  // pré-preenchimento via query string: ?atendimentos=80&ticket=300&falta=25&leads=150&resposta=40
  ORDER.forEach(k => {
    const raw = params.get(k);
    if (raw === null) return;
    const v = parseNum(raw, k !== 'ticket');
    if (Number.isFinite(v) && v > 0) state.values[k] = v;
  });

  $('#btn-next').addEventListener('click', next);
  $('#btn-back').addEventListener('click', back);
  $('#btn-copy').addEventListener('click', () => copyText(buildSummary()));
  $('#btn-download').addEventListener('click', downloadTxt);
  $('#btn-restart').addEventListener('click', () => {
    $('#result').hidden = true;
    $('#calc-form').hidden = false;
    $('#progress-wrap').hidden = false;
    showStep(0);
  });
  $('#lead-form').addEventListener('submit', submitLead);
  $('#lead-copy').addEventListener('click', () => copyText(buildSummary()));

  // entrada por teclado
  $('#calc-form').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      next();
    }
  });

  $('#footer-base').textContent = `© ${new Date().getFullYear()} ${CONFIG.empresa}. Estimativas baseadas em faixas de mercado — não constituem garantia de resultado.`;

  updateWaLinks();
  showStep(0);
}

document.addEventListener('DOMContentLoaded', init);
