'use strict';
/* Alvorada — criação rápida, cartão de detalhes, editor completo, recorrência e vínculos */

let popEl = null, popOnClose = null;
const Pop = { id: '', key: '' };
function closePop() { if (!popEl) return; popEl.remove(); popEl = null; Pop.id = ''; const f = popOnClose; popOnClose = null; f && f(); }
function showPop(anchor, html, cls, onClose, keepPos) {
  const prev = keepPos && popEl ? { left: popEl.style.left, top: popEl.style.top } : null;
  if (keepPos) { popOnClose = null; }
  closePop();
  const el = popEl = document.createElement('div');
  el.className = 'pop ' + (cls || ''); el.innerHTML = html;
  document.body.appendChild(el); popOnClose = onClose || null;
  if (prev) { el.style.left = prev.left; el.style.top = prev.top; return el; }
  const r = anchor && anchor.isConnected ? anchor.getBoundingClientRect() : { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 3, bottom: innerHeight / 3, width: 0 };
  const w = el.offsetWidth, h = el.offsetHeight;
  let left = r.right + 8; if (left + w > innerWidth - 8) left = r.left - w - 8; if (left < 8) left = clamp(r.left, 8, Math.max(8, innerWidth - w - 8));
  el.style.left = left + 'px'; el.style.top = clamp(r.top, 8, Math.max(8, innerHeight - h - 8)) + 'px';
  return el;
}
addEventListener('pointerdown', e => { if (popEl && !popEl.contains(e.target) && !(menuEl && menuEl.contains(e.target)) && !e.target.closest('.mback')) closePop(); }, true);

/* ---------- Criação rápida ---------- */
const Quick = {
  open(anchor, preset, onClose) {
    const d = Object.assign({ type: preset.scope === 'time' || preset.scope === 'day' ? (S.set.quickType || 'event') : 'task', cal: defCal(), scope: 'none', start: '', end: '' }, preset);
    const cals = S.calendars.filter(c => !c.ro);
    const el = showPop(anchor, `<input id="qt" placeholder="Título · entende “amanhã 14h”, #etiqueta, !alta" autocomplete="off" maxlength="300">
      <div class="seg" id="qtype">${Object.entries(TYPES).map(([k, v]) => `<button data-t="${k}">${ic(k === 'event' ? 'cal' : k === 'task' ? 'check' : 'bell')}${v}</button>`).join('')}</div>
      <div class="qwhen" id="qw"></div>
      <select id="qc" title="Calendário">${cals.map(c => `<option value="${c.id}"${c.id === d.cal ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <div class="mfoot"><button class="btn ghost sm" id="qmore">Mais opções</button><button class="btn sm" id="qok">Salvar</button></div>`, 'quick', onClose);
    const inp = $('#qt', el);
    const build = () => {
      const p = parseQuick(inp.value, pd(d.start)), o = { type: p.type || d.type, cal: $('#qc', el).value, title: p.title, tags: p.tags, prio: p.prio, loc: p.loc, rrule: p.rrule, list: p.list || d.list || '', scope: d.scope, start: d.start, end: d.end };
      if (p.found) { o.scope = p.scope; o.start = p.start; o.end = p.end || ''; if (p.scope === 'time' && !p.end && d.scope === 'time' && d.end) o.end = iso(new Date(pd(p.start).getTime() + (pd(d.end) - pd(d.start)))); }
      if (o.type === 'event' && o.scope !== 'time' && o.scope !== 'day') o.type = 'task';
      if (o.type !== 'event' && o.scope === 'time' && !p.found && preset.end && d.type !== 'event' && !S.set.quickBlock) o.end = d.end;
      if (o.rrule && o.scope !== 'time' && o.scope !== 'day') o.rrule = '';
      return o;
    };
    const paint = () => { const o = build(), it = normItem(Object.assign({}, o)); $$('#qtype button', el).forEach(b => b.classList.toggle('on', b.dataset.t === o.type)); $('#qw', el).innerHTML = `${ic('clock')}<span>${esc(whenText(it))}${o.rrule ? ' · ' + esc(RR.describe(o.rrule, o.start)) : ''}</span>`; };
    const save = more => {
      const o = build();
      if (more) { closePop(); return Editor.open(newItem(o.type, o)); }
      if (!o.title) return inp.focus();
      o.tags = o.tags.map(ensureTag); Ops.create(o); closePop(); App.render();
    };
    inp.oninput = paint; inp.onkeydown = e => { if (e.key === 'Enter') save(e.shiftKey); };
    $('#qtype', el).onclick = e => { const b = e.target.closest('button'); if (b) { d.type = b.dataset.t; S.set.quickType = d.type; paint(); inp.focus(); } };
    $('#qok', el).onclick = () => save(); $('#qmore', el).onclick = () => save(true);
    paint(); setTimeout(() => inp.focus(), 20);
  },
};

/* ---------- Cartão de detalhes ---------- */
const mapUrl = loc => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loc);
const RSVP = { yes: 'Sim', no: 'Não', maybe: 'Talvez' };
function openPop(o, anchor, keep) {
  const it = o.it, c = colorOf(it), links = Ops.linksOf(it), bl = Ops.blockers(it), refs = S.notes.filter(n => (n.refs || []).includes(it.id));
  const html = `<div class="pophead"><span class="ptype">${ic(typeIcon(it))}${TYPES[it.type]}${it.kind ? ' · ' + KINDS[it.kind] : ''}</span><span class="grow"></span>
      <button class="icon sm" data-act="popEdit" title="Editar (E)">${ic('edit')}</button><button class="icon sm" data-act="popDel" title="Excluir (Del)">${ic('trash')}</button><button class="icon sm" data-act="itemMenu" data-id="${it.id}" data-key="${o.key}" title="Mais ações">${ic('more')}</button><button class="icon sm" data-act="popClose" title="Fechar">${ic('x')}</button></div>
    <div class="poptitle">${it.type === 'event' ? `<i class="sq" style="background:${c}"></i>` : ckBtn(o)}<h3 class="${o.done ? 'done' : ''}">${esc(it.title || '(sem título)')}</h3></div>
    <div class="popbody">
    <p class="pw">${ic('clock')}<span>${esc(whenText(it, o.s ? o : null))}${it.rrule ? `<br><small>${ic('repeat')} ${esc(RR.describe(it.rrule, it.start))}</small>` : ''}${it.tz && it.tz !== localTz() && o.s && it.scope === 'time' ? `<br><small>${esc(it.tz)}: ${timeIn(it.tz, o.s)}</small>` : ''}</span></p>
    ${it.due ? `<p class="${overdue(it) ? 'err' : ''}">${ic('flag')}<span>Prazo: ${fmtLong(pd(it.due))}${overdue(it) ? ' (atrasada)' : ''}</span></p>` : ''}
    ${it.url ? `<p>${ic('video')}<span><a class="btn sm" href="${esc(it.url)}" target="_blank" rel="noopener">Entrar na reunião</a> <button class="link" data-act="copy" data-text="${esc(it.url)}">copiar link</button></span></p>` : ''}
    ${it.loc ? `<p>${ic('loc')}<span><a href="${mapUrl(it.loc)}" target="_blank" rel="noopener">${esc(it.loc)}</a></span></p>` : ''}
    ${it.guests.length ? `<div class="prow">${ic('users')}<div>${it.guests.map(g => `<div class="guest"><i class="rs ${g.rsvp}"></i>${esc(g.name || g.email)}</div>`).join('')}<div class="rsvp">Você vai? ${Object.entries(RSVP).map(([k, v]) => `<button class="btn ghost sm${it.rsvp === k ? ' on' : ''}" data-act="popRsvp" data-v="${k}">${v}</button>`).join('')}</div></div></div>` : ''}
    ${it.type !== 'event' ? `<div class="prow">${ic('flag')}<div class="pst">${Object.entries(STATUS).map(([k, v]) => `<button class="btn ghost sm${it.status === k && !(it.rrule && k === 'done') ? ' on' : ''}" data-act="popStatus" data-v="${k}">${v}</button>`).join('')}${it.prio ? `<span class="tagc" style="--c:${PRIO_COLOR[it.prio]}">${PRIO[it.prio]}</span>` : ''}</div></div>` : ''}
    ${bl.length && !o.done ? `<p class="err">${ic('lock')}<span>Bloqueada por: ${bl.map(b => esc(cut(b.title, 40))).join(', ')}</span></p>` : ''}
    ${it.progress && it.progress < 100 ? `<p>${ic('chart')}<span class="prog"><i style="width:${it.progress}%"></i></span><small>${it.progress}%</small></p>` : ''}
    ${it.desc ? `<div class="prow">${ic('note')}<div class="pdesc rt">${clean(it.desc)}</div></div>` : ''}
    ${it.check.length ? `<div class="prow">${ic('check')}<div class="pcheck">${it.check.map((k, i) => `<label class="${k.done ? 'done' : ''}"><input type="checkbox" data-act="popCheck" data-i="${i}"${k.done ? ' checked' : ''}><span>${esc(k.text)}</span></label>`).join('')}</div></div>` : ''}
    ${links.length ? `<div class="prow">${ic('link')}<div>${links.map(l => `<button class="lk${isDone(l.other) ? ' done' : ''}" data-act="openItem" data-id="${l.other.id}"><small>${l.label}</small> ${esc(cut(l.other.title || '(sem título)', 44))}</button>`).join('')}</div></div>` : ''}
    ${refs.length ? `<div class="prow">${ic('book')}<div>${refs.map(n => `<button class="lk" data-act="openNote" data-key="${n.id}"><small>mencionada em</small> ${esc(noteTitle(n.id))}</button>`).join('')}</div></div>` : ''}
    ${it.files.length ? `<div class="prow">${ic('clip')}<div class="pfiles">${Files.chips(it.files)}</div></div>` : ''}
    ${it.tags.length || it.list ? `<p>${ic('tag')}<span>${it.list && byId(S.lists, it.list) ? `<span class="tagc" style="--c:${byId(S.lists, it.list).color}">${esc(byId(S.lists, it.list).name)}</span>` : ''}${it.tags.map(tagChip).join('')}</span></p>` : ''}
    ${it.rem.length ? `<p>${ic('bell')}<span>${it.rem.map(fmtRem).join(' · ')}</span></p>` : ''}
    <p class="muted">${ic('cal')}<span>${esc(calOf(it).name)}${it.gid ? ' · Google Agenda' : ''}${it.vis === 'private' ? ' · particular' : ''}${it.busy ? '' : ' · disponível'}${it.est ? ' · estimativa ' + fmtDur(it.est) : ''}</span></p></div>
    ${it.type !== 'event' ? `<div class="mfoot"><button class="btn ghost sm" data-act="snooze" data-id="${it.id}" data-key="${o.key}">${ic('clock')} Adiar</button><button class="btn sm" data-act="done" data-id="${it.id}" data-key="${o.key}">${o.done ? 'Reabrir' : 'Concluir'}</button></div>` : ''}`;
  Pop.o = o;
  showPop(anchor, html, 'detail', null, keep);
  Pop.id = it.id; Pop.key = o.key;
  Files.thumbs(popEl);
}
const refreshPop = () => { if (!popEl || !Pop.id) return; const o = getOcc(Pop.id, Pop.key); if (!o || o.it.deleted) return closePop(); openPop(o, null, true); };
Actions.pop = el => { const o = getOcc(el.dataset.id, el.dataset.key); if (o) openPop(o, el); };
Actions.popClose = closePop;
Actions.popEdit = () => { const o = Pop.o; Editor.open(o.it, { key: o.key }); };
Actions.popDel = () => Ops.trash(Pop.o.it, Pop.o.key);
Actions.popRsvp = el => { const it = Pop.o.it; it.rsvp = it.rsvp === el.dataset.v ? '' : el.dataset.v; Data.put('items', it); App.render(); refreshPop(); };
Actions.popStatus = el => { const it = Pop.o.it, v = el.dataset.v; if (v === 'done') return Ops.toggleDone(it, Pop.o.key); it.status = v; it.doneAt = 0; Data.put('items', it); App.render(); };
Actions.popCheck = el => { const it = Pop.o.it, c = it.check[+el.dataset.i]; c.done = el.checked; it.progress = Math.round(it.check.filter(x => x.done).length / it.check.length * 100); Data.put('items', it); App.render(); };
Actions.openItem = el => { const it = Ops.get(el.dataset.id); if (it) { const o = getOcc(it.id, ''); openPop(o, popEl || el, !!popEl); } };
Actions.copy = el => copyText(el.dataset.text);
Actions.snooze = el => {
  const o = getOcc(el.dataset.id, el.dataset.key), it = o.it, to = async d => { const t = await Ops.target(it, o.key, 'Adiar'); if (!t) return; Ops.setDate(t, d); closePop(); App.render(); toast(d ? 'Adiada para ' + relDay(d).toLowerCase() : 'Sem data', { label: 'Desfazer', fn: () => Hist.undo() }); };
  menu(el, [{ label: 'Hoje', fn: () => to(today()) }, { label: 'Amanhã', fn: () => to(addD(today(), 1)) }, { label: 'Em 2 dias', fn: () => to(addD(today(), 2)) }, { label: 'Próxima segunda', fn: () => to(addD(today(), ((8 - today().getDay()) % 7) || 7)) }, { label: 'Em 1 semana', fn: () => to(addD(today(), 7)) }, { label: 'Em 1 mês', fn: () => to(addM(today(), 1)) }, '-', { label: 'Sem data (algum dia)', fn: () => to(null) }]);
};
function itemText(it, o) { return `${it.title}\n${whenText(it, o && o.s ? o : null)}${it.loc ? '\nLocal: ' + it.loc : ''}${it.url ? '\nLink: ' + it.url : ''}${it.desc ? '\n\n' + plain(it.desc) : ''}`; }
Actions.itemMenu = el => {
  const o = getOcc(el.dataset.id, el.dataset.key); if (!o) return;
  const it = o.it, sub = items => setTimeout(() => menu(el, items), 0), upd = fn => () => { fn(); Data.put('items', it); App.render(); refreshPop(); };
  menu(el, [
    { label: 'Abrir e editar', icon: 'edit', fn: () => Editor.open(it, { key: o.key }) },
    it.type !== 'event' && { label: o.done ? 'Reabrir' : 'Concluir', icon: 'check', fn: () => Ops.toggleDone(it, o.key) },
    { label: 'Duplicar', icon: 'copy', fn: () => { const c = Ops.duplicate(it); toast('Duplicado', { label: 'Abrir', fn: () => Editor.open(c) }); } },
    { label: 'Repetir amanhã / na próxima semana…', icon: 'repeat', fn: () => sub([{ label: 'Cópia amanhã', fn: () => { const c = Ops.duplicate(it, { rrule: '' }); Ops.shift(c, o.s ? daysBetween(o.s, addD(today(), 1)) : 0); App.render(); } }, { label: 'Cópia daqui a 7 dias', fn: () => { const c = Ops.duplicate(it, { rrule: '' }); Ops.shift(c, o.s ? daysBetween(pd(c.start), o.s) + 7 : 7); App.render(); } }]) },
    '-',
    { label: 'Prioridade…', icon: 'flag', fn: () => sub(PRIO.map((p, i) => ({ label: p, color: PRIO_COLOR[i] || '#bbb', checked: it.prio === i, fn: upd(() => { it.prio = i; }) }))) },
    { label: 'Cor…', icon: 'circle', fn: () => sub([{ label: 'Cor do calendário', checked: !it.color, fn: upd(() => { it.color = ''; }) }, ...PALETTE.map(([n, c]) => ({ label: n, color: c, checked: it.color === c, fn: upd(() => { it.color = c; }) }))]) },
    { label: 'Mover para o calendário…', icon: 'cal', fn: () => sub(S.calendars.filter(c => !c.ro).map(c => ({ label: c.name, color: c.color, checked: it.cal === c.id, fn: upd(() => { it.cal = c.id; }) }))) },
    { label: 'Lista…', icon: 'folder', fn: () => sub([{ label: 'Sem lista', checked: !it.list, fn: upd(() => { it.list = ''; }) }, ...S.lists.map(l => ({ label: l.name, color: l.color, checked: it.list === l.id, fn: upd(() => { it.list = l.id; }) }))]) },
    { label: it.pin ? 'Desafixar' : 'Fixar no topo', icon: 'pin', fn: upd(() => { it.pin = !it.pin; }) },
    '-',
    { label: 'Adicionar vínculo…', icon: 'link', fn: () => linkPicker(it, () => { App.render(); refreshPop(); }) },
    it.type !== 'event' && { label: 'Nova subtarefa', icon: 'plus', fn: async () => { const t = await ask('Subtarefa de “' + cut(it.title, 30) + '”', '', 'Título', 'Criar'); if (t) { Ops.create({ type: 'task', title: t, parent: it.id, cal: it.cal, list: it.list, scope: 'none' }); App.render(); refreshPop(); } } },
    { label: 'Converter em…', icon: 'sync', fn: () => sub(Object.entries(TYPES).filter(([k]) => k !== it.type).map(([k, v]) => ({ label: v, fn: upd(() => { it.type = k; if (k === 'event' && it.scope !== 'time' && it.scope !== 'day') { it.scope = 'day'; it.start = ymd(tdate(it) || today()); } if (k === 'event' && it.scope === 'time' && !it.end) it.end = iso(addMin(pd(it.start), S.set.defDur)); }) }))) },
    { label: 'Salvar como modelo', icon: 'star', fn: async () => { const n = await ask('Nome do modelo', it.title); if (n) { const c = JSON.parse(JSON.stringify(it)); ['id', 'gid', 'gmod', 'doneOn', 'exdates', 'created', 'updated', 'mod', 'deleted', 'status', 'doneAt'].forEach(k => delete c[k]); Data.put('templates', NORM.templates({ id: uid(), name: n, item: c })); toast('Modelo salvo. Use em Criar › A partir de um modelo.'); } } },
    '-',
    { label: 'Copiar como texto', icon: 'copy', fn: () => copyText(itemText(it, o)) },
    { label: 'Exportar .ics', icon: 'dl', fn: () => download((it.title || 'item').replace(/[\\/:*?"<>|]/g, ' ') + '.ics', ICS.export([it]), 'text/calendar') },
    navigator.share && { label: 'Compartilhar…', icon: 'share', fn: () => navigator.share({ title: it.title, text: itemText(it, o) }).catch(() => {}) },
    { label: 'Abrir o diário do dia', icon: 'book', fn: () => o.s && App.go('journal', null, ymd(o.s)) },
    '-',
    { label: 'Excluir', icon: 'trash', danger: true, fn: () => Ops.trash(it, o.key) },
  ]);
};

/* ---------- Vínculos ---------- */
const LINK_OPTS = [['blocks', 0], ['blocks', 1], ['next', 0], ['next', 1], ['related', 0], ['parent', 0], ['parent', 1], ['dup', 0], ['ref', 0]];
function linkPicker(it, done) {
  const m = modal({ title: 'Adicionar vínculo', body: `<p class="muted">“${esc(cut(it.title || '(sem título)', 50))}”…</p><select id="lt">${LINK_OPTS.map(([t, d], i) => `<option value="${i}">${LINKS[t][d]}</option>`).join('')}</select><input id="lq" placeholder="Procurar tarefa, lembrete ou evento" autocomplete="off"><div class="picks" id="lr"></div><div class="mfoot"><button class="btn ghost" id="lnew">Criar nova tarefa vinculada</button><button class="btn ghost" data-close>Fechar</button></div>` });
  const apply = other => { const [t, d] = LINK_OPTS[+$('#lt', m.el).value]; d ? Ops.link(other, t, it) : Ops.link(it, t, other); toast('Vínculo criado'); m.close(); done && done(); };
  const paint = () => {
    const q = norm($('#lq', m.el).value), list = S.items.filter(o => !o.deleted && o.id !== it.id && norm(o.title).includes(q)).sort((a, b) => b.updated - a.updated).slice(0, 30);
    $('#lr', m.el).innerHTML = list.map(o => `<button class="pickb" data-id="${o.id}"><b>${ic(typeIcon(o))} ${esc(o.title || '(sem título)')}</b><span>${esc(whenText(o))}</span></button>`).join('') || '<p class="muted">Nada encontrado.</p>';
  };
  $('#lq', m.el).oninput = paint;
  $('#lr', m.el).onclick = e => { const b = e.target.closest('.pickb'); if (b) apply(Ops.get(b.dataset.id)); };
  $('#lnew', m.el).onclick = () => { const t = $('#lq', m.el).value.trim(); if (!t) return toast('Digite o título da nova tarefa'); apply(Ops.create({ type: 'task', title: t, cal: it.cal, list: it.list, scope: 'none' })); };
  paint();
}

/* ---------- Recorrência personalizada ---------- */
function recOptions(startStr) {
  const d = pd(startStr) || today(), dow = BYDAY[d.getDay()], nth = Math.ceil(d.getDate() / 7), lastWk = d.getDate() + 7 > dim(d);
  return [['', 'Não se repete'], ['FREQ=DAILY', 'Todos os dias'], ['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'Dias úteis (seg. a sex.)'], [`FREQ=WEEKLY;BYDAY=${dow}`, `Semanal: toda ${DOW[d.getDay()]}`], [`FREQ=WEEKLY;INTERVAL=2;BYDAY=${dow}`, `A cada 2 semanas: ${DOW[d.getDay()]}`],
    [`FREQ=MONTHLY;BYMONTHDAY=${d.getDate()}`, `Mensal: dia ${d.getDate()}`], nth <= 4 && [`FREQ=MONTHLY;BYDAY=${nth}${dow}`, `Mensal: ${nth}ª ${DOW[d.getDay()]}`], lastWk && [`FREQ=MONTHLY;BYDAY=-1${dow}`, `Mensal: última ${DOW[d.getDay()]}`], [`FREQ=YEARLY`, `Anual: ${d.getDate()} de ${MONTHS[d.getMonth()]}`]].filter(Boolean);
}
const customRec = (cur, startStr) => new Promise(res => {
  const r = RR.parse(cur), d = pd(startStr) || today(); let out;
  if (!r.freq) { r.freq = 'WEEKLY'; r.byday = [BYDAY[d.getDay()]]; }
  const nth = Math.ceil(d.getDate() / 7), dow = BYDAY[d.getDay()];
  const m = modal({ title: 'Recorrência personalizada', onClose: () => res(out), body: `<div class="row2"><div><label>Repetir a cada</label><input id="ri" type="number" min="1" max="99" value="${r.interval}"></div><div><label>Unidade</label><select id="rf"><option value="DAILY">dia(s)</option><option value="WEEKLY">semana(s)</option><option value="MONTHLY">mês(es)</option><option value="YEARLY">ano(s)</option></select></div></div>
    <div id="rw"><label>Nos dias</label><div class="dows">${[...Array(7).keys()].map(i => (i + S.set.weekStart) % 7).map(i => `<button type="button" data-d="${BYDAY[i]}" class="${r.byday.some(c => c.slice(-2) === BYDAY[i]) ? 'on' : ''}">${DOW3[i][0].toUpperCase()}</button>`).join('')}</div></div>
    <div id="rm"><label>No mês</label><select id="rmm"><option value="day">No dia ${d.getDate()}</option><option value="nth">Na ${nth}ª ${DOW[d.getDay()]}</option><option value="last">Na última ${DOW[d.getDay()]}</option><option value="lastday">No último dia do mês</option></select></div>
    <label>Termina</label><select id="re"><option value="">Nunca</option><option value="until">Em uma data</option><option value="count">Após um número de vezes</option></select>
    <input id="ru" type="date" value="${r.until || ymd(addM(d, 3))}" hidden><input id="rc" type="number" min="1" max="999" value="${r.count || 10}" hidden>
    <p class="muted" id="rd"></p><div class="mfoot"><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="rok">Aplicar</button></div>` });
  const g = id => $('#' + id, m.el);
  g('rf').value = r.freq; g('re').value = r.count ? 'count' : r.until ? 'until' : '';
  g('rmm').value = r.byday.length ? (r.byday[0].startsWith('-1') ? 'last' : 'nth') : r.bymonthday[0] === -1 ? 'lastday' : 'day';
  const build = () => {
    const f = g('rf').value, o = { freq: f, interval: clamp(+g('ri').value || 1, 1, 99), byday: [], bymonthday: [], bymonth: [], count: 0, until: '' };
    if (f === 'WEEKLY') o.byday = $$('.dows .on', m.el).map(b => b.dataset.d);
    if (f === 'MONTHLY') { const v = g('rmm').value; if (v === 'nth') o.byday = [nth + dow]; else if (v === 'last') o.byday = ['-1' + dow]; else if (v === 'lastday') o.bymonthday = [-1]; }
    if (g('re').value === 'until') o.until = g('ru').value; else if (g('re').value === 'count') o.count = clamp(+g('rc').value || 1, 1, 999);
    return RR.str(o);
  };
  const paint = () => { g('rw').hidden = g('rf').value !== 'WEEKLY'; g('rm').hidden = g('rf').value !== 'MONTHLY'; g('ru').hidden = g('re').value !== 'until'; g('rc').hidden = g('re').value !== 'count'; g('rd').textContent = RR.describe(build(), startStr); };
  m.el.addEventListener('input', paint); m.el.addEventListener('change', paint);
  $('.dows', m.el).onclick = e => { const b = e.target.closest('button'); if (b) { b.classList.toggle('on'); paint(); } };
  g('rok').onclick = () => { out = build(); m.close(); };
  paint();
});

/* ---------- Editor completo ---------- */
const REM_OPTS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];
const TZS = ['America/Sao_Paulo', 'America/Manaus', 'America/Rio_Branco', 'America/Noronha', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Mexico_City', 'America/Argentina/Buenos_Aires', 'Europe/Lisbon', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'UTC'];
const Editor = {
  open(src, opt = {}) {
    closePop();
    const orig = byId(S.items, src.id) || null, isNew = !orig, key = !isNew && opt.key && src.rrule ? opt.key : '';
    const w = normItem(JSON.parse(JSON.stringify(src)));
    const occ = key ? getOcc(src.id, key) : null;
    if (occ && occ.s) { const e0 = w.end; Ops.setSpan(w, occ.s, occ.e, w.scope === 'day'); if (!e0 && w.type !== 'event') w.end = ''; }
    const first = JSON.stringify(w);
    let saved = false;
    const frow = (icon, html, cls) => `<div class="frow ${cls || ''}">${ic(icon)}<div>${html}</div></div>`;
    const sel = (f, opts, v) => `<select data-f="${f}">${opts.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const m = modal({
      title: isNew ? 'Novo item' : 'Editar', wide: true, cls: 'editor',
      onClose: () => { if (!saved && JSON.stringify(w) !== first) toast('Alterações não salvas foram descartadas', { label: 'Voltar a editar', fn: () => Editor.open(w, isNew ? {} : { key }) }); },
      body: `<input id="et" class="big" data-f="title" value="${esc(w.title)}" placeholder="Título" maxlength="300"${isNew ? ' autofocus' : ''}>
      <div class="seg" id="etype">${Object.entries(TYPES).map(([k, v]) => `<button type="button" data-t="${k}">${ic(k === 'event' ? 'cal' : k === 'task' ? 'check' : 'bell')}${v}</button>`).join('')}</div>
      <div class="ecols"><div class="ecol">
        ${frow('clock', '<div id="ewhen"></div>')}
        ${frow('repeat', '<div id="erec"></div>', 'f-rec')}
        ${frow('bell', '<div id="erem" class="chips"></div>')}
        ${frow('loc', `<div class="inl"><input data-f="loc" value="${esc(w.loc)}" placeholder="Local" maxlength="300"><button type="button" class="btn ghost sm" data-e="map">Mapa</button></div>`)}
        ${frow('video', `<div class="inl"><input data-f="url" value="${esc(w.url)}" placeholder="Link da reunião ou página (https://…)" maxlength="600"><button type="button" class="btn ghost sm" data-e="meet" title="Cria uma sala gratuita no Jitsi Meet">Criar sala</button></div>`)}
        ${frow('users', '<div id="eguests"></div>', 'f-ev')}
        ${frow('note', '<div id="edesc"></div>')}
        ${frow('check', '<div id="echeck"></div>')}
      </div><div class="ecol">
        ${frow('cal', `<div class="row2"><div><label>Calendário</label>${sel('cal', S.calendars.filter(c => !c.ro || c.id === w.cal).map(c => [c.id, c.name]), w.cal)}</div><div><label>Lista / projeto</label>${sel('list', [['', 'Nenhuma'], ...S.lists.map(l => [l.id, l.name])], w.list)}</div></div>`)}
        ${frow('circle', `<label>Cor</label>${colorDots(w.color, true)}`)}
        ${frow('tag', '<div id="etags"></div>')}
        ${frow('flag', `<div class="row2"><div><label>Prioridade</label>${sel('prio', PRIO.map((p, i) => [i, p]), w.prio)}</div><div class="f-task"><label>Situação</label>${sel('status', Object.entries(STATUS), w.status)}</div></div>
          <div class="row2 f-task"><div><label>Progresso: <b id="epv">${w.progress}</b>%</label><input type="range" min="0" max="100" step="5" data-f="progress" value="${w.progress}"></div><div><label>Estimativa (min)</label><input type="number" min="0" step="5" data-f="est" value="${w.est || ''}" placeholder="ex.: 45"></div></div>`)}
        ${frow('link', '<div id="elinks"></div>')}
        ${frow('clip', '<div id="efiles"></div>')}
        ${frow('gear', `<div class="row2 f-ev"><div><label>Tipo de evento</label>${sel('kind', Object.entries(KINDS), w.kind)}</div><div><label>Visibilidade</label>${sel('vis', [['', 'Padrão'], ['public', 'Público'], ['private', 'Particular']], w.vis)}</div></div>
          <div class="row2"><div><label>Fuso horário</label>${sel('tz', [['', 'Local (' + localTz() + ')'], ...TZS.map(z => [z, z.replace(/_/g, ' ')])], w.tz)}</div><div class="cks"><label class="f-ev"><input type="checkbox" data-f="busy"${w.busy ? ' checked' : ''}> Ocupado neste horário</label><label><input type="checkbox" data-f="pin"${w.pin ? ' checked' : ''}> Fixar no topo</label></div></div>`)}
      </div></div>
      <div class="mfoot">${isNew ? '' : `<button class="btn ghost danger" data-e="del">${ic('trash')} Excluir</button><button class="btn ghost" data-e="dup">${ic('copy')} Duplicar</button>`}<span class="grow"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn" data-e="save">Salvar</button></div>`,
    });
    const el = m.el, g = id => $('#' + id, el);
    const DL = `<datalist id="taglist">${S.tags.map(t => `<option value="${esc(t.name)}">`).join('')}</datalist>`;
    const drawType = () => { $$('#etype button', el).forEach(b => b.classList.toggle('on', b.dataset.t === w.type)); $('.modal', el).dataset.type = w.type; };
    function drawWhen() {
      const ev = w.type === 'event', sc = w.scope, s = pd(w.start) || today(), sp = span(w);
      const scopes = ev ? [['time', 'Com horário'], ['day', 'Dia inteiro']] : [['time', 'Com horário'], ['day', 'No dia'], ['week', 'Na semana'], ['month', 'No mês'], ['year', 'No ano'], ['none', 'Sem data (algum dia)']];
      let h = `<div class="inl wrap"><select id="wsc">${scopes.map(([k, l]) => `<option value="${k}"${k === sc ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
      if (sc === 'time') h += `<input type="date" id="wd1" value="${ymd(sp.s)}"><input type="time" id="wt1" value="${hm(sp.s)}" step="300">${ev || w.end ? `<span>até</span><input type="time" id="wt2" value="${hm(sp.e)}" step="300"><input type="date" id="wd2" value="${ymd(sp.e)}" class="${sameD(sp.s, sp.e) ? 'dim' : ''}">${ev ? '' : '<button type="button" class="link" data-e="noend">sem fim</button>'}` : '<button type="button" class="link" data-e="addend">+ duração</button>'}`;
      else if (sc === 'day') h += `<input type="date" id="wd1" value="${w.start.slice(0, 10)}"><span>até</span><input type="date" id="wd2" value="${(w.end || w.start).slice(0, 10)}">`;
      else if (sc === 'week') h += `<input type="date" id="wd1" value="${ymd(weekStartOf(w.start) || sow(today()))}" title="Qualquer dia da semana desejada"><span class="muted">semana ${w.start.slice(6)}</span>`;
      else if (sc === 'month') h += `<select id="wm">${MONTHS.map((n, i) => `<option value="${i}"${i === s.getMonth() ? ' selected' : ''}>${n}</option>`).join('')}</select><input type="number" id="wy" value="${s.getFullYear()}" min="1970" max="2200">`;
      else if (sc === 'year') h += `<input type="number" id="wy" value="${s.getFullYear()}" min="1970" max="2200">`;
      h += `</div>${ev ? '' : `<div class="inl f-task"><label>Prazo</label><input type="date" id="wdue" value="${w.due.slice(0, 10)}"><span class="muted">${sc === 'time' && sp ? fmtDur(Math.round((sp.e - sp.s) / 60000)) : ''}</span></div>`}<p class="muted">${esc(whenText(w))}${w.tz && w.tz !== localTz() && sc === 'time' ? ` · em ${esc(w.tz)}: ${timeIn(w.tz, sp.s)}` : ''}</p>`;
      g('ewhen').innerHTML = h;
      $('.f-rec', el).hidden = sc !== 'time' && sc !== 'day';
    }
    function readWhen(ch) {
      const v = id => (g(id) || {}).value || '', sc = v('wsc');
      if (sc !== w.scope) { // troca de escopo: aproveita a data que já havia
        const d = tdate(w) || pd(w.start) || today();
        w.scope = sc;
        if (sc === 'time') { const n = new Date(); w.start = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.min(23, n.getHours() + 1))); w.end = w.type === 'event' ? iso(addMin(pd(w.start), S.set.defDur)) : ''; }
        else if (sc === 'day') { w.start = ymd(d); w.end = ''; } else if (sc === 'week') { w.start = weekKey(d); w.end = ''; } else if (sc === 'month') { w.start = monthKey(d); w.end = ''; } else if (sc === 'year') { w.start = String(d.getFullYear()); w.end = ''; } else { w.start = ''; w.end = ''; }
        if (sc !== 'time' && sc !== 'day') w.rrule = '';
      } else if (sc === 'time') {
        const old = span(w), len = old.e - old.s, s = pd(v('wd1') + 'T' + (v('wt1') || '09:00')); if (!s) return;
        w.start = iso(s);
        if (g('wt2')) { let e = pd((ch === 'wd1' || !v('wd2') ? ymd(new Date(s.getTime() + len)) : v('wd2')) + 'T' + (v('wt2') || '10:00')); if (ch === 'wt1' || ch === 'wd1') e = new Date(s.getTime() + len); if (e <= s) e = ch === 'wt2' && sameD(old.s, old.e) ? addD(e, 1) : addMin(s, durOf(w)); w.end = iso(e); }
      } else if (sc === 'day') { if (!v('wd1')) return; const n = w.end ? daysBetween(pd(w.start), pd(w.end)) : 0; w.start = v('wd1'); let e = ch === 'wd1' ? ymd(addD(pd(w.start), n)) : v('wd2'); w.end = e > w.start ? e : ''; }
      else if (sc === 'week') { if (v('wd1')) w.start = weekKey(pd(v('wd1'))); }
      else if (sc === 'month') w.start = `${clamp(+v('wy') || today().getFullYear(), 1970, 2200)}-${pad(+v('wm') + 1)}`;
      else if (sc === 'year') w.start = String(clamp(+v('wy') || today().getFullYear(), 1970, 2200));
      if (g('wdue')) w.due = v('wdue');
      drawWhen(); drawRec();
    }
    function drawRec() {
      const opts = recOptions(w.start), known = opts.some(o => o[0] === w.rrule);
      g('erec').innerHTML = `<select id="rsel">${opts.map(([k, l]) => `<option value="${k}"${k === w.rrule ? ' selected' : ''}>${l}</option>`).join('')}${!known && w.rrule ? `<option value="${esc(w.rrule)}" selected>${esc(RR.describe(w.rrule, w.start))}</option>` : ''}<option value="custom">Personalizar…</option></select>${key ? '<p class="muted">Ao salvar, você escolhe se a mudança vale para esta ocorrência, as seguintes ou todas.</p>' : ''}`;
      g('rsel').onchange = async e => { if (e.target.value === 'custom') { const r = await customRec(w.rrule, w.start); if (r !== undefined) w.rrule = r; } else w.rrule = e.target.value; drawRec(); };
    }
    function drawRem() {
      g('erem').innerHTML = w.rem.sort((a, b) => a - b).map((r, i) => `<span class="chipx">${fmtRem(r)}<button type="button" data-e="remx" data-i="${i}">×</button></span>`).join('') + `<button type="button" class="link" data-e="remadd">${ic('plus')} lembrete</button>`;
    }
    function drawTags() {
      g('etags').innerHTML = `<div class="chips">${w.tags.map((t, i) => `<span class="chipx" style="--c:${tagRec(t).color}">#${esc(tagRec(t).name)}<button type="button" data-e="tagx" data-i="${i}">×</button></span>`).join('')}<input id="tagin" list="taglist" placeholder="+ etiqueta" maxlength="40">${DL}</div>`;
      g('tagin').onkeydown = e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } };
      g('tagin').onchange = addTag;
    }
    const addTag = () => { const v = g('tagin').value.replace(/^#/, '').trim(); if (!v) return; const id = ensureTag(v); if (id && !w.tags.includes(id)) w.tags.push(id); drawTags(); g('tagin').focus(); };
    function drawGuests() {
      g('eguests').innerHTML = `${w.guests.map((x, i) => `<div class="inl guestrow"><i class="rs ${x.rsvp}"></i><span class="grow">${esc(x.name ? x.name + ' · ' : '')}${esc(x.email)}</span><select data-e="grsvp" data-i="${i}"><option value="">Sem resposta</option>${Object.entries(RSVP).map(([k, v]) => `<option value="${k}"${x.rsvp === k ? ' selected' : ''}>${v}</option>`).join('')}</select><button type="button" class="icon sm" data-e="gx" data-i="${i}">${ic('x')}</button></div>`).join('')}
        <div class="inl"><input id="gin" type="email" placeholder="Convidar: e-mail (Enter)" maxlength="120">${w.guests.length ? `<button type="button" class="btn ghost sm" data-e="invite" title="Abre seu e-mail com o convite pronto">Enviar convite</button>` : ''}</div>`;
      g('gin').onkeydown = e => { if (e.key !== 'Enter') return; e.preventDefault(); const v = g('gin').value.trim(); if (!/^\S+@\S+\.\S+$/.test(v)) return toast('E-mail inválido'); if (!w.guests.some(x => x.email === v)) w.guests.push({ email: v, name: '', rsvp: '' }); drawGuests(); g('gin').focus(); };
    }
    function drawCheck() {
      const dn = w.check.filter(c => c.done).length;
      g('echeck').innerHTML = `<label>Subitens${w.check.length ? ` (${dn}/${w.check.length})` : ''}</label>${w.check.map((c, i) => `<div class="inl ckrow"><input type="checkbox" data-e="ckt" data-i="${i}"${c.done ? ' checked' : ''}><input value="${esc(c.text)}" data-e="cktx" data-i="${i}" maxlength="300"><button type="button" class="icon sm" data-e="ckx" data-i="${i}">${ic('x')}</button></div>`).join('')}<input id="ckin" placeholder="+ subitem (Enter)" maxlength="300">`;
      g('ckin').onkeydown = e => { if (e.key !== 'Enter' || !g('ckin').value.trim()) return; e.preventDefault(); w.check.push({ id: uid(), text: g('ckin').value.trim(), done: false }); drawCheck(); g('ckin').focus(); };
    }
    function drawLinks() {
      const real = byId(S.items, w.id), links = real ? Ops.linksOf(real) : [];
      g('elinks').innerHTML = `<label>Vínculos</label>${links.map((l, i) => `<div class="inl lrow"><small>${l.label}</small><button type="button" class="link grow" data-e="lopen" data-i="${i}">${esc(cut(l.other.title || '(sem título)', 40))}</button><button type="button" class="icon sm" data-e="lx" data-i="${i}">${ic('x')}</button></div>`).join('')}<button type="button" class="link" data-e="ladd">${ic('plus')} vincular a outro item</button>`;
      drawLinks.list = links;
    }
    function drawFiles() { g('efiles').innerHTML = `<label>Anexos</label><div class="flist">${Files.rows(w.files, 'e')}</div><button type="button" class="link" data-e="fadd">${ic('plus')} anexar arquivos</button>`; Files.thumbs(g('efiles')); }
    richEditor(g('edesc'), w.desc, html => { w.desc = html; }, { mini: true, placeholder: 'Descrição, pauta, anotações…' });
    bindDots(el, c => { w.color = c; });
    drawType(); drawWhen(); drawRec(); drawRem(); drawTags(); drawGuests(); drawCheck(); drawLinks(); drawFiles();
    // o item precisa existir para receber vínculos
    const ensureSaved = () => { if (!byId(S.items, w.id)) { Data.put('items', normItem(JSON.parse(JSON.stringify(w)))); App.render(); } return byId(S.items, w.id); };
    const syncLinks = () => { const r = byId(S.items, w.id); if (r) { w.links = JSON.parse(JSON.stringify(r.links)); w.parent = r.parent; } drawLinks(); };
    el.addEventListener('input', e => {
      const t = e.target, f = t.dataset.f;
      if (f) { w[f] = t.type === 'checkbox' ? t.checked : t.type === 'number' || t.type === 'range' || f === 'prio' ? +t.value || 0 : t.value; if (f === 'progress') g('epv').textContent = t.value; if (f === 'tz') drawWhen(); }
      else if (t.dataset.e === 'cktx') w.check[+t.dataset.i].text = t.value;
    });
    el.addEventListener('change', e => {
      const t = e.target;
      if (t.closest('#ewhen')) readWhen(t.id);
      else if (t.dataset.e === 'ckt') { w.check[+t.dataset.i].done = t.checked; w.progress = Math.round(w.check.filter(c => c.done).length / w.check.length * 100); drawCheck(); }
      else if (t.dataset.e === 'grsvp') { w.guests[+t.dataset.i].rsvp = t.value; drawGuests(); }
    });
    el.addEventListener('click', async e => {
      const tb = e.target.closest('#etype button');
      if (tb) { w.type = tb.dataset.t; if (w.type === 'event') { if (w.scope !== 'time' && w.scope !== 'day') { w.scope = 'day'; w.start = ymd(tdate(w) || today()); } if (w.scope === 'time' && !w.end) w.end = iso(addMin(pd(w.start), S.set.defDur)); } drawType(); drawWhen(); return; }
      const b = e.target.closest('[data-e]'); if (!b) return;
      const a = b.dataset.e, i = +b.dataset.i;
      if (a === 'save') return save();
      if (a === 'del') { saved = true; m.close(); return Ops.trash(orig, key); }
      if (a === 'dup') { saved = true; m.close(); return Editor.open(Ops.duplicate(orig)); }
      if (a === 'map') return w.loc ? window.open(mapUrl(w.loc), '_blank', 'noopener') : toast('Digite um local primeiro');
      if (a === 'meet') { w.url = 'https://meet.jit.si/alvorada-' + uid(); $('[data-f=url]', el).value = w.url; return toast('Sala criada. Qualquer pessoa com o link pode entrar.'); }
      if (a === 'noend') { w.end = ''; return drawWhen(); }
      if (a === 'addend') { w.end = iso(addMin(pd(w.start), w.est || 30)); return drawWhen(); }
      if (a === 'remx') { w.rem.splice(i, 1); return drawRem(); }
      if (a === 'remadd') return menu(b, [...REM_OPTS.filter(r => !w.rem.includes(r)).map(r => ({ label: fmtRem(r), fn: () => { w.rem.push(r); drawRem(); } })), '-', { label: 'Outro tempo…', fn: async () => { const v = await ask('Lembrar quantos minutos antes?', '45'); if (v && +v >= 0) { w.rem.push(Math.round(+v)); drawRem(); } } }]);
      if (a === 'tagx') { w.tags.splice(i, 1); return drawTags(); }
      if (a === 'gx') { w.guests.splice(i, 1); return drawGuests(); }
      if (a === 'ckx') { w.check.splice(i, 1); return drawCheck(); }
      if (a === 'invite') { const body = itemText(w) + '\n\nEnviado pelo Alvorada'; download('convite.ics', ICS.export([w]), 'text/calendar'); location.href = `mailto:${w.guests.map(x => x.email).join(',')}?subject=${encodeURIComponent('Convite: ' + w.title)}&body=${encodeURIComponent(body)}`; return toast('O arquivo convite.ics foi baixado: anexe-o ao e-mail.'); }
      if (a === 'ladd') { const r = ensureSaved(); return linkPicker(r, syncLinks); }
      if (a === 'lx') { Ops.unlink(byId(S.items, w.id), drawLinks.list[i]); return syncLinks(); }
      if (a === 'lopen') { const o = drawLinks.list[i].other; saved = true; await save(true); return Editor.open(o); }
      if (a === 'fadd') return Files.pick(async files => { w.files.push(...await Files.add(files, 'item:' + w.id)); drawFiles(); });
      if (a === 'fx') { w.files = w.files.filter(x => x !== b.dataset.id); Files.remove(b.dataset.id); return drawFiles(); }
    });
    el.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === 's')) { e.preventDefault(); save(); } });
    async function save(silent) {
      w.title = w.title.trim();
      if (!w.title && !silent && isNew && !w.desc) { g('et').focus(); return toast('Dê um título ao item'); }
      w.tags = w.tags.map(ensureTag).filter(Boolean);
      w.check = w.check.filter(c => c.text.trim());
      if (w.status === 'done' && !w.doneAt) w.doneAt = Date.now(); if (w.status !== 'done') w.doneAt = 0;
      const cur = byId(S.items, w.id);
      if (!cur) Data.put('items', normItem(w));
      else {
        let sc = 'all', t = cur;
        if (key) { sc = await Ops.editScope('Alterar'); if (!sc) return; if (sc === 'one') t = Ops.detach(cur, key); else if (sc === 'next' && ymd(pd(cur.start)) !== key) t = Ops.split(cur, key); }
        const f = JSON.parse(JSON.stringify(w));
        ['id', 'created', 'exdates', 'doneOn', 'gid', 'gmod', 'gcal', 'from', 'mod', 'seed'].forEach(k => delete f[k]);
        if (sc === 'one') f.rrule = '';
        if (t === cur && key && occ && occ.s && w.scope === cur.scope) { // série inteira: aplica a diferença em relação à ocorrência aberta
          const sp = span(cur), wsp = span(w), day = w.scope === 'day', ns = day ? addD(sp.s, daysBetween(occ.s, wsp.s)) : new Date(sp.s.getTime() + (wsp.s - occ.s)), tmp = { type: w.type, end: w.end };
          Ops.setSpan(tmp, ns, day ? addD(ns, wsp.days) : new Date(ns.getTime() + (wsp.e - wsp.s)), day); f.start = tmp.start; f.end = w.end || day ? tmp.end : '';
        }
        Object.assign(t, f); Data.put('items', t);
      }
      saved = true; m.close(); App.render();
    }
  },
};
