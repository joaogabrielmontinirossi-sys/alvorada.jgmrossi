'use strict';
/* Alvorada — peças de interface (aviso, janela, menu) e operações sobre itens */

let toastT;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="link">${esc(action.label)}</button>` : ''}`;
  if (action) $('button', t).onclick = () => { t.classList.remove('on'); action.fn(); };
  t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), action ? 7000 : 2800);
}

const modals = [];
function modal({ title, body, wide, cls, onClose }) {
  const back = document.createElement('div');
  back.className = 'mback';
  back.innerHTML = `<div class="modal${wide ? ' wide' : ''}${cls ? ' ' + cls : ''}" role="dialog"><div class="mhead"><h3>${title || ''}</h3><button class="icon" data-close title="Fechar (Esc)">${ic('x')}</button></div><div class="mbody">${body}</div></div>`;
  document.body.appendChild(back);
  const m = { el: back, close(v) { if (!back.isConnected) return; back.remove(); modals.splice(modals.indexOf(m), 1); onClose && onClose(v); } };
  let downOnBack = false;
  back.addEventListener('pointerdown', e => { downOnBack = e.target === back; });
  back.addEventListener('click', e => { if ((e.target === back && downOnBack) || e.target.closest('[data-close]')) m.close(); });
  modals.push(m);
  setTimeout(() => { const f = $('[autofocus]', back) || $('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea', back); if (f && !('ontouchstart' in window && !$('[autofocus]', back))) f.focus(); }, 30);
  return m;
}

let menuEl = null;
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
/* items: '-' | { head } | { label, icon, fn, danger, checked, hint, color, keep } */
function menu(anchor, items, opt = {}) {
  closeMenu();
  const el = menuEl = document.createElement('div');
  el.className = 'menu' + (opt.cls ? ' ' + opt.cls : '');
  el.innerHTML = (opt.html || '') + items.filter(Boolean).map((it, i) => it === '-' ? '<hr>' : it.head ? `<div class="mh">${esc(it.head)}</div>` :
    `<button data-i="${i}" class="${it.danger ? 'danger' : ''}${it.checked ? ' on' : ''}">${it.color ? `<i class="dot" style="background:${it.color}"></i>` : it.icon ? ic(it.icon) : it.emoji ? `<span class="emo">${it.emoji}</span>` : opt.checks ? `<span class="chk">${it.checked ? ic('check') : ''}</span>` : ''}<span>${esc(it.label)}</span>${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : it.checked && !opt.checks ? ic('check') : ''}</button>`).join('');
  document.body.appendChild(el);
  const list = items.filter(Boolean);
  el.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; const it = list[+b.dataset.i]; if (!it.keep) closeMenu(); it.fn && it.fn(e); });
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = clamp(opt.right ? r.right - w : r.left, 8, innerWidth - w - 8) + 'px';
  el.style.top = (r.bottom + h + 8 > innerHeight && r.top - h - 4 > 0 ? r.top - h - 4 : clamp(r.bottom + 4, 8, Math.max(8, innerHeight - h - 8))) + 'px';
  return el;
}
addEventListener('pointerdown', e => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }, true);

const confirmBox = (msg, ok = 'Confirmar', danger) => new Promise(res => {
  let v = false;
  const m = modal({ title: 'Confirmar', body: `<p>${esc(msg)}</p><div class="mfoot"><button class="btn ghost" data-close>Cancelar</button><button class="btn${danger ? ' danger' : ''}" id="cok" autofocus>${esc(ok)}</button></div>`, onClose: () => res(v) });
  $('#cok', m.el).onclick = () => { v = true; m.close(); };
});
const ask = (title, value = '', ph = '', label = 'Salvar') => new Promise(res => {
  let v = null;
  const m = modal({ title, body: `<input id="askv" value="${esc(value)}" placeholder="${esc(ph)}" maxlength="300" autofocus><div class="mfoot"><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="askok">${esc(label)}</button></div>`, onClose: () => res(v) });
  const go = () => { v = $('#askv', m.el).value.trim(); m.close(); };
  $('#askok', m.el).onclick = go;
  $('#askv', m.el).onkeydown = e => { if (e.key === 'Enter') go(); };
  setTimeout(() => $('#askv', m.el).select(), 40);
});
const pick = (title, options, text) => new Promise(res => {
  let v = null;
  const m = modal({ title, body: `${text ? `<p class="muted">${esc(text)}</p>` : ''}<div class="picks">${options.map((o, i) => `<button class="pickb" data-i="${i}"><b>${esc(o.label)}</b>${o.desc ? `<span>${esc(o.desc)}</span>` : ''}</button>`).join('')}</div>`, onClose: () => res(v) });
  $$('.pickb', m.el).forEach(b => b.onclick = () => { v = options[+b.dataset.i].v; m.close(); });
});
const colorDots = (sel, withNone) => `<div class="cdots">${withNone ? `<button type="button" class="cdot none${sel ? '' : ' on'}" data-color="" title="Cor do calendário"></button>` : ''}${PALETTE.map(([n, c]) => `<button type="button" class="cdot${c === sel ? ' on' : ''}" data-color="${c}" title="${n}" style="background:${c}"></button>`).join('')}<label class="cdot custom${sel && !PALETTE.some(p => p[1] === sel) ? ' on' : ''}" title="Outra cor" style="${sel && !PALETTE.some(p => p[1] === sel) ? 'background:' + sel : ''}"><input type="color" value="${sel || '#4f46e5'}"></label></div>`;
// liga uma grade de cores: chama fn(cor) a cada escolha
function bindDots(root, fn) {
  const box = $('.cdots', root); if (!box) return;
  const mark = (el, c) => { $$('.cdot', box).forEach(x => x.classList.toggle('on', x === el)); fn(c); };
  box.addEventListener('click', e => { const b = e.target.closest('button.cdot'); if (b) mark(b, b.dataset.color); });
  $('input[type=color]', box).addEventListener('input', e => { e.target.parentNode.style.background = e.target.value; mark(e.target.parentNode, e.target.value); });
}

function beep(kind) {
  if (!S.set.sound) return;
  try {
    const A = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)()), t = A.currentTime;
    (kind === 'alarm' ? [[880, 0], [1100, .18], [880, .36]] : [[660, 0], [990, .09]]).forEach(([f, d]) => {
      const o = A.createOscillator(), g = A.createGain();
      o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.12, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .16);
      o.connect(g).connect(A.destination); o.start(t + d); o.stop(t + d + .18);
    });
  } catch (e) {}
}
function download(name, data, type) {
  const a = document.createElement('a'), url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain;charset=utf-8' }));
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const copyText = t => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copiado'), () => { const x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); document.execCommand('copy'); x.remove(); toast('Copiado'); });
// Remove scripts e atributos perigosos de HTML vindo de fora (sincronização, backup, colar).
function clean(html) {
  if (!html || !/[<&]/.test(html)) return html || '';
  const doc = new DOMParser().parseFromString('<body>' + html, 'text/html');
  $$('script,style,iframe,object,embed,link,meta,form,base', doc.body).forEach(n => n.remove());
  $$('*', doc.body).forEach(n => [...n.attributes].forEach(a => { if (/^on/i.test(a.name) || (/^(href|src|xlink:href)$/i.test(a.name) && /^\s*(javascript|vbscript):/i.test(a.value)) || a.name === 'srcdoc') n.removeAttribute(a.name); }));
  return doc.body.innerHTML;
}

/* ---------- Etiquetas ---------- */
const tagId = n => norm(n).trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 40);
const tagRec = n => byId(S.tags, tagId(n)) || { id: tagId(n), name: n, color: '#616161' };
function ensureTag(n) { const id = tagId(n); if (id && !byId(S.tags, id)) Data.put('tags', NORM.tags({ id, name: id, color: PALETTE[S.tags.length % PALETTE.length][1] })); return id; }
const tagChip = n => { const t = tagRec(n); return `<span class="tagc" style="--c:${t.color}">${esc(t.name)}</span>`; };

/* ---------- Operações sobre itens ---------- */
const Ops = {
  get: id => byId(S.items, id),
  save(it) { Data.put('items', it); App.render(); },
  setSpan(it, s, e, allDay) {
    if (allDay) { it.scope = 'day'; it.start = ymd(s); const last = e ? addD(e, -1) : s; it.end = last > sod(s) ? ymd(last) : ''; }
    else { it.scope = 'time'; it.start = iso(s); it.end = e && (it.type === 'event' || it.end) ? iso(e) : it.type === 'event' ? iso(addMin(s, S.set.defDur)) : ''; }
  },
  /* Vínculos: guardados no item de origem ({ type, to }); a leitura junta as duas direções. */
  linksOf(it) {
    const out = [];
    it.links.forEach(l => { const o = Ops.get(l.to); if (o && !o.deleted) out.push({ type: l.type, dir: 0, other: o, label: LINKS[l.type][0] }); });
    S.items.forEach(o => { if (o.deleted || o.id === it.id) return; o.links.forEach(l => { if (l.to === it.id) out.push({ type: l.type, dir: 1, other: o, label: LINKS[l.type][1] }); }); });
    const p = it.parent && Ops.get(it.parent);
    if (p && !p.deleted) out.push({ type: 'parent', dir: 0, other: p, label: LINKS.parent[0] });
    S.items.forEach(o => { if (!o.deleted && o.parent === it.id) out.push({ type: 'parent', dir: 1, other: o, label: LINKS.parent[1] }); });
    return out;
  },
  children: it => S.items.filter(o => !o.deleted && o.parent === it.id),
  blockers: it => S.items.filter(o => !o.deleted && o.type !== 'event' && o.status !== 'done' && o.status !== 'cancel' && o.links.some(l => (l.type === 'blocks' || l.type === 'next') && l.to === it.id)),
  successors: it => it.links.filter(l => l.type === 'blocks' || l.type === 'next').map(l => Ops.get(l.to)).filter(o => o && !o.deleted),
  link(a, type, b) {
    if (a.id === b.id) return;
    if (type === 'parent') { let p = b; while (p) { if (p.id === a.id) return toast('Uma tarefa não pode ser subtarefa de si mesma'); p = p.parent && Ops.get(p.parent); } a.parent = b.id; }
    else if (!a.links.some(l => l.type === type && l.to === b.id)) a.links.push({ type, to: b.id });
    Data.put('items', a);
  },
  unlink(it, l) {
    if (l.type === 'parent') { const child = l.dir ? l.other : it; child.parent = ''; Data.put('items', child); }
    else { const src = l.dir ? l.other : it, to = l.dir ? it.id : l.other.id; src.links = src.links.filter(x => !(x.type === l.type && x.to === to)); Data.put('items', src); }
  },
  toggleDone(it, key) {
    if (it.type === 'event') return;
    let done;
    if (it.rrule && key) { done = !it.doneOn[key]; if (done) it.doneOn[key] = Date.now(); else delete it.doneOn[key]; }
    else {
      done = it.status !== 'done';
      it.status = done ? 'done' : 'todo'; it.doneAt = done ? Date.now() : 0;
      if (done) { it.progress = 100; it.check.forEach(c => c.done = true); }
    }
    Data.put('items', it);
    if (done) {
      beep();
      const bl = Ops.blockers(it);
      if (bl.length) toast(`Concluída, mas ainda depende de: ${cut(bl[0].title, 40)}${bl.length > 1 ? ' e mais ' + (bl.length - 1) : ''}`);
      else {
        const nx = Ops.successors(it).filter(o => o.status !== 'done' && !Ops.blockers(o).length);
        if (nx.length) toast(`Liberada: ${cut(nx[0].title, 44)}`, { label: 'Abrir', fn: () => Editor.open(nx[0]) });
      }
      // conclui a tarefa-mãe quando todas as subtarefas terminam
      const p = it.parent && Ops.get(it.parent);
      if (p && S.set.autoDone && p.status !== 'done' && Ops.children(p).every(c => c.status === 'done')) { p.status = 'done'; p.doneAt = Date.now(); p.progress = 100; Data.put('items', p); }
    }
    App.render();
  },
  editScope: (verb = 'Alterar') => pick(`${verb} item recorrente`, [{ v: 'one', label: 'Somente esta ocorrência' }, { v: 'next', label: 'Esta e as seguintes' }, { v: 'all', label: 'Todas as ocorrências' }]),
  // separa uma ocorrência da série: vira um item próprio e a série ganha uma exceção
  detach(it, key) {
    const occ = RR.expand(pd(it.start), RR.parse(it.rrule), pd(key), addD(pd(key), 1))[0] || pd(key), sp = span(it);
    const c = normItem(Object.assign(JSON.parse(JSON.stringify(it)), { id: uid(), rrule: '', exdates: [], doneOn: {}, gid: '', gmod: 0, from: it.id, created: Date.now() }));
    Ops.setSpan(c, occ, it.scope === 'day' ? addD(occ, sp.days) : new Date(occ.getTime() + (sp.e - sp.s)), it.scope === 'day');
    if (it.doneOn[key]) { c.status = 'done'; c.doneAt = it.doneOn[key]; }
    it.exdates.push(key); Data.put('items', it);
    return c;
  },
  // corta a série: a original termina na véspera e uma nova começa na ocorrência
  split(it, key) {
    const r = RR.parse(it.rrule), occ = RR.expand(pd(it.start), r, pd(key), addD(pd(key), 1))[0] || pd(key), sp = span(it);
    const c = normItem(Object.assign(JSON.parse(JSON.stringify(it)), { id: uid(), exdates: it.exdates.filter(k => k >= key), gid: '', gmod: 0, created: Date.now() }));
    if (r.count) { const used = RR.expand(pd(it.start), Object.assign({}, r, { count: 0 }), pd(it.start), occ).length; c.rrule = RR.str(Object.assign({}, r, { count: Math.max(1, r.count - used) })); }
    Ops.setSpan(c, occ, it.scope === 'day' ? addD(occ, sp.days) : new Date(occ.getTime() + (sp.e - sp.s)), it.scope === 'day');
    Object.keys(c.doneOn).forEach(k => { if (k < key) delete c.doneOn[k]; });
    r.count = 0; r.until = ymd(addD(pd(key), -1)); it.rrule = RR.str(r); Data.put('items', it);
    return c;
  },
  // devolve o item que deve receber a alteração (o próprio, uma cópia destacada ou a série nova)
  async target(it, key, verb) {
    if (!it.rrule || !key) return it;
    const first = ymd(pd(it.start)) === key, sc = await Ops.editScope(verb);
    if (!sc) return null;
    return sc === 'one' ? Ops.detach(it, key) : sc === 'next' && !first ? Ops.split(it, key) : it;
  },
  async move(o, s, e, allDay) {
    const it = o.it, wasRec = !!it.rrule, t = await Ops.target(it, o.key, 'Mover');
    if (!t) return App.render();
    const before = pd(t.start);
    if (t === it && wasRec) { // série inteira: desloca o início pela mesma diferença
      const sp = span(it), ds = s - o.s, len = e - s;
      const ns = allDay ? addD(sp.s, daysBetween(o.s, s)) : new Date(sp.s.getTime() + ds);
      Ops.setSpan(it, ns, allDay ? addD(ns, Math.max(1, daysBetween(s, e))) : new Date(ns.getTime() + len), allDay);
    } else Ops.setSpan(t, s, e, allDay);
    Data.put('items', t);
    const dd = daysBetween(before, pd(t.start)), deps = Ops.successors(t).filter(x => (x.scope === 'time' || x.scope === 'day') && !x.rrule);
    if (dd && deps.length && S.set.shiftDeps) toast(`Movido. ${count(deps.length, 'item depende', 'itens dependem')} deste.`, { label: `Mover também (${dd > 0 ? '+' : ''}${dd} d)`, fn: () => { deps.forEach(x => Ops.shift(x, dd)); App.render(); } });
    App.render();
  },
  shift(it, days) {
    const mv = v => v ? (v.includes('T') ? iso(addD(pd(v), days)) : ymd(addD(pd(v), days))) : '';
    it.start = mv(it.start); it.end = mv(it.end); if (it.due) it.due = mv(it.due);
    Data.put('items', it);
  },
  async trash(it, key) {
    if (it.rrule && key) {
      const sc = await Ops.editScope('Excluir'); if (!sc) return;
      if (sc === 'one') { it.exdates.push(key); Data.put('items', it); }
      else if (sc === 'next' && ymd(pd(it.start)) !== key) { const r = RR.parse(it.rrule); r.count = 0; r.until = ymd(addD(pd(key), -1)); it.rrule = RR.str(r); Data.put('items', it); }
      else { it.deleted = Date.now(); Data.put('items', it); }
    } else { it.deleted = Date.now(); Data.put('items', it); }
    closePop(); App.render();
    toast('Movido para a lixeira', { label: 'Desfazer', fn: () => Hist.undo() });
  },
  duplicate(it, patch) {
    const c = normItem(Object.assign(JSON.parse(JSON.stringify(it)), { id: uid(), gid: '', gmod: 0, created: Date.now(), doneOn: {}, title: it.title + (patch ? '' : ' (cópia)') }, patch));
    c.check.forEach(x => x.id = uid());
    Data.put('items', c); App.render();
    return c;
  },
  setDate(it, d) { // muda só o dia, mantendo a hora
    if (!d) { it.scope = 'none'; it.start = ''; it.end = ''; }
    else if (it.scope === 'time') { const sp = span(it), s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sp.s.getHours(), sp.s.getMinutes()); it.start = iso(s); if (it.end) it.end = iso(new Date(s.getTime() + (sp.e - sp.s))); }
    else { const n = it.scope === 'day' && it.end ? daysBetween(pd(it.start), pd(it.end)) : 0; it.scope = 'day'; it.start = ymd(d); it.end = n > 0 ? ymd(addD(d, n)) : ''; }
    Data.put('items', it);
  },
  create(o) { const it = newItem(o.type || 'event', o); it.tags = it.tags.map(ensureTag).filter(Boolean); Data.put('items', it); return it; },
};

/* Texto de quando o item acontece */
function whenText(it, o) {
  if (it.scope === 'none') return 'Sem data';
  if (it.scope === 'year') return 'Em ' + it.start;
  if (it.scope === 'month') { const d = pd(it.start); return `${cap(MONTHS[d.getMonth()])} de ${d.getFullYear()}`; }
  if (it.scope === 'week') { const d = weekStartOf(it.start); return d ? `Semana de ${fmtDs(d)} a ${fmtDs(addD(d, 6))}` : it.start; }
  const sp = o ? { s: o.s, e: o.e } : span(it); if (!sp) return '';
  if (it.scope === 'day') { const last = addD(sp.e, -1); return sameD(sp.s, last) ? fmtLong(sp.s) : `${fmtD(sp.s)} – ${fmtD(last)}`; }
  if (it.type !== 'event' && !it.end) return `${fmtLong(sp.s)} · ${fmtT(sp.s)}`;
  return sameD(sp.s, sp.e) || (+sp.e === +addD(sod(sp.s), 1)) ? `${fmtLong(sp.s)} · ${fmtT(sp.s)} – ${fmtT(sp.e)}` : `${fmtD(sp.s)} ${fmtT(sp.s)} – ${fmtD(sp.e)} ${fmtT(sp.e)}`;
}
const typeIcon = it => it.type === 'task' ? 'check' : it.type === 'reminder' ? 'bell' : it.kind === 'focus' ? 'bolt' : it.kind === 'birthday' ? 'heart' : 'cal';
