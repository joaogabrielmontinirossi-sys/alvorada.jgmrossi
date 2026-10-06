'use strict';
/* Alvorada — visões de calendário: dia, semana, dias úteis, N dias, mês, ano, agenda e o minicalendário */

const hourH = () => ({ compact: 38, normal: 50, comfy: 66 }[S.set.density] || 50);
const snap = min => Math.round(min / S.set.slot) * S.set.slot;
const isWorkDay = d => S.set.workDays.includes(d.getDay());
const weekDays = start => { const out = []; for (let i = 0; i < 7; i++) { const d = addD(start, i); if (S.set.weekends || (d.getDay() !== 0 && d.getDay() !== 6)) out.push(d); } return out; };

// reconstrói a ocorrência a partir do que está gravado no elemento (data-id, data-key)
function getOcc(id, key) {
  const it = Ops.get(id); if (!it) return null;
  const sp = span(it);
  if (!sp) return { it, s: null, e: null, key: '', allDay: false, done: isDone(it) };
  if (it.rrule && key) {
    const d = RR.expand(sp.s, RR.parse(it.rrule), pd(key), addD(pd(key), 1))[0];
    if (d) return { it, s: d, e: it.scope === 'day' ? addD(d, sp.days) : new Date(d.getTime() + (sp.e - sp.s)), key, allDay: it.scope === 'day', done: isDone(it, key) };
  }
  return { it, s: sp.s, e: sp.e, key: ymd(sp.s), allDay: it.scope === 'day', done: isDone(it) };
}
const lastDay = o => o.allDay ? addD(o.e, -1) : (o.e > o.s && +o.e === +sod(o.e) ? addD(o.e, -1) : sod(o.e));
// distribui as ocorrências pelos dias em que aparecem
function bucket(all, from, n, pred) {
  const map = {}, end = addD(from, n - 1);
  for (const o of all) {
    if (pred && !pred(o)) continue;
    const last = lastDay(o), multi = !sameD(o.s, last);
    for (let d = sod(o.s) < from ? from : sod(o.s); d <= last && d <= end; d = addD(d, 1)) (map[ymd(d)] || (map[ymd(d)] = [])).push({ o, cl: !sameD(d, o.s), cr: !sameD(d, last), multi });
  }
  return map;
}
const marks = it => `${it.rrule ? ic('repeat') : ''}${it.links.length || it.parent ? ic('link') : ''}${it.files.length ? ic('clip') : ''}${it.url ? ic('video') : ''}`;
const ckBtn = (o, id) => `<button class="ck${o.done ? ' on' : ''}" data-act="done" data-id="${id || o.it.id}" data-key="${o.key || ''}" title="Concluir">${o.done ? ic('check') : o.it && o.it.type === 'reminder' ? ic('bell') : ''}</button>`;
function chip(o, x = {}) {
  const it = o.it, fill = o.allDay || x.multi;
  const cls = `chip ${it.type}${fill ? ' fill' : ''}${o.done ? ' done' : ''}${S.set.dimPast && o.e && o.e <= new Date() ? ' past' : ''}${x.cl ? ' cl' : ''}${x.cr ? ' cr' : ''}${it.kind ? ' k-' + it.kind : ''}${it.rsvp === 'no' || it.status === 'cancel' ? ' declined' : ''}${it.rsvp === 'maybe' ? ' maybe' : ''}`;
  return `<div class="${cls}" style="--c:${colorOf(it)}" draggable="true" data-act="pop" data-id="${it.id}" data-key="${o.key || ''}" title="${esc(it.title)}">${it.type !== 'event' ? ckBtn(o) : ''}${!o.allDay && !x.cl && o.s ? `<time>${fmtT(o.s)}</time>` : ''}<span>${it.prio >= 3 ? `<i class="pr" style="color:${PRIO_COLOR[it.prio]}">!</i>` : ''}${esc(it.title || '(sem título)')}</span>${marks(it)}</div>`;
}
const pchip = it => chip({ it, s: null, e: null, key: '', allDay: true, done: isDone(it) });
function periodStrip(scope, key, label) {
  const its = periodItems(scope, key), has = hasNote(key);
  return `<div class="pstrip" data-drop="period:${scope}:${key}"><b>${label}</b>${its.map(pchip).join('')}<button class="link sm" data-act="addPeriod" data-scope="${scope}" data-key="${key}">${ic('plus')} tarefa</button><button class="link sm${has ? ' has' : ''}" data-act="openNote" data-key="${key}">${ic('note')} ${has ? 'ver notas' : 'anotar'}</button></div>`;
}
const dayBadges = d => { const k = ymd(d), h = holiday(d), mo = S.set.moon ? moon(d) : null; return `${h ? `<span class="hol" title="Feriado">${esc(h)}</span>` : ''}${mo && mo.main ? `<span class="moon" title="${mo.name}">${mo.icon}</span>` : ''}${hasNote(k) ? `<button class="nb" data-act="openNote" data-key="${k}" title="Este dia tem anotações">${ic('note')}</button>` : ''}`; };

/* ---------- Grade de horas (dia, semana, dias úteis, N dias) ---------- */
function layoutCols(list) {
  list.sort((x, y) => x.a - y.a || y.b - x.b);
  let group = [], gEnd = -1;
  const flush = () => { const cols = []; group.forEach(x => { let c = cols.findIndex(end => end <= x.a); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = x.vb; x.col = c; }); group.forEach(x => x.cols = cols.length); group = []; };
  for (const x of list) { if (group.length && x.a >= gEnd) { flush(); gEnd = -1; } group.push(x); gEnd = Math.max(gEnd, x.vb); }
  flush();
  return list;
}
const Cal = { scroll: null, mini: null, agendaN: 45 };
function timeGrid(el, days, strip) {
  const H = hourH(), from = days[0], to = addD(days[days.length - 1], 1), all = occs(from, to), now = new Date();
  const long = o => o.allDay || o.e - o.s >= 864e5, lane = bucket(all, from, daysBetween(from, to), long);
  const tz2 = S.set.tz2, hours = [...Array(24).keys()];
  const col = d => {
    const k = ymd(d), d1 = addD(d, 1), list = [];
    for (const o of all) { if (long(o) || o.s >= d1 || o.e <= d && +o.s !== +d) continue; const a = Math.max(0, (o.s - d) / 60000), b = Math.min(1440, (o.e - d) / 60000); list.push({ o, a, b, vb: Math.max(b, a + 1200 / H) }); }
    layoutCols(list);
    const work = isWorkDay(d);
    return `<div class="tg-col${sameD(d, now) ? ' today' : ''}" data-col="${k}" data-act="slot">
      ${work ? `<div class="off" style="top:0;height:${S.set.workStart * H}px"></div><div class="off" style="top:${S.set.workEnd * H}px;bottom:0"></div>` : '<div class="off" style="top:0;bottom:0"></div>'}
      ${list.map(x => {
        const it = x.o.it, h = Math.max(18, (x.b - x.a) / 60 * H - 2), small = h < 34;
        return `<div class="ev ${it.type}${x.o.done ? ' done' : ''}${S.set.dimPast && x.o.e <= now ? ' past' : ''}${it.kind ? ' k-' + it.kind : ''}${it.rsvp === 'no' || it.status === 'cancel' ? ' declined' : ''}${it.rsvp === 'maybe' ? ' maybe' : ''}${small ? ' small' : ''}" style="--c:${colorOf(it)};top:${x.a / 60 * H}px;height:${h}px;left:${x.col / x.cols * 100}%;width:calc(${100 / x.cols}% - 3px)" data-act="pop" data-id="${it.id}" data-key="${x.o.key}" title="${esc(it.title)}">
          ${it.type !== 'event' ? ckBtn(x.o) : ''}<b>${it.prio >= 3 ? '<i class="pr">!</i>' : ''}${esc(it.title || '(sem título)')}</b><span class="et">${fmtT(x.o.s)}${it.type === 'event' || it.end ? ' – ' + fmtT(x.o.e) : ''}${it.loc ? ' · ' + esc(it.loc) : ''}</span>${marks(it)}${it.type === 'event' || it.end ? '<i class="rs"></i>' : ''}</div>`;
      }).join('')}
      ${sameD(d, now) ? `<div class="now" style="top:${(now.getHours() * 60 + now.getMinutes()) / 60 * H}px"></div>` : ''}</div>`;
  };
  el.innerHTML = `<div class="tg${tz2 ? ' tz2' : ''}" style="--n:${days.length};--h:${H}px">
    ${strip || ''}
    <div class="tg-head"><div class="tg-gut">${tz2 ? `<span title="${esc(tz2)}">${esc(tz2.split('/').pop().replace(/_/g, ' ').slice(0, 9))}</span>` : ''}<span>${S.set.weekNums ? 'S' + isoWeek(addD(from, 3)).w : ''}</span></div>
      ${days.map(d => `<div class="tg-day${sameD(d, now) ? ' today' : ''}${isWorkDay(d) ? '' : ' wkend'}"><button data-act="goDay" data-date="${ymd(d)}" title="Abrir o dia"><span>${DOW3[d.getDay()]}</span><b>${d.getDate()}</b></button>${dayBadges(d)}</div>`).join('')}</div>
    <div class="tg-all"><div class="tg-gut"><span>dia todo</span></div>
      ${days.map(d => `<div class="tg-allc" data-date="${ymd(d)}" data-act="cell">${(lane[ymd(d)] || []).map(x => chip(x.o, x)).join('')}</div>`).join('')}</div>
    <div class="tg-scroll"><div class="tg-body" style="height:${24 * H}px">
      <div class="tg-gut">${hours.map(h => `<div style="height:${H}px">${tz2 ? `<span>${h ? timeIn(tz2, new Date(from.getFullYear(), from.getMonth(), from.getDate(), h)) : ''}</span>` : ''}<span>${h ? fmtT(new Date(2000, 0, 1, h)) : ''}</span></div>`).join('')}</div>
      ${days.map(col).join('')}
    </div></div></div>`;
  const sc = $('.tg-scroll', el);
  sc.scrollTop = Cal.scroll !== null ? Cal.scroll : Math.max(0, (Math.min(S.set.workStart, now.getHours()) - 1) * H);
  sc.onscroll = () => { Cal.scroll = sc.scrollTop; };
  bindGrid(el, H);
}
/* Arrastar na grade: criar (área vazia), mover e redimensionar (evento). No toque, vale o toque simples. */
function bindGrid(el, H) {
  const body = $('.tg-body', el);
  const minAt = (y, c) => clamp(snap((y - c.getBoundingClientRect().top) / H * 60), 0, 1440);
  const label = (a, b) => `${fmtT(addMin(today(), a))} – ${fmtT(addMin(today(), b))}`;
  body.onpointerdown = e => {
    if (e.button || e.pointerType !== 'mouse') return;
    const col = e.target.closest('.tg-col'); if (!col || e.target.closest('.ck')) return;
    const ev = e.target.closest('.ev'), x0 = e.clientX, y0 = e.clientY;
    let moved = false, cur = col, a, b, ghost = null;
    if (ev) {
      const o = getOcc(ev.dataset.id, ev.dataset.key); if (!o) return;
      const resize = e.target.classList.contains('rs'), day = pd(col.dataset.col);
      const a0 = Math.max(0, (o.s - day) / 60000), len = (o.e - o.s) / 60000, grab = (y0 - col.getBoundingClientRect().top) / H * 60 - a0;
      a = a0; b = a0 + len;
      const mv = m => {
        if (!moved && Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return;
        if (!moved) { moved = true; ev.classList.add('drag'); document.body.classList.add('dragging'); }
        if (resize) { b = Math.max(a + S.set.slot, minAt(m.clientY, cur)); ev.style.height = (b - a) / 60 * H - 2 + 'px'; }
        else {
          const c2 = [...body.querySelectorAll('.tg-col')].find(c => { const r = c.getBoundingClientRect(); return m.clientX >= r.left && m.clientX < r.right; });
          if (c2 && c2 !== cur) { cur = c2; cur.appendChild(ev); }
          a = clamp(snap((m.clientY - cur.getBoundingClientRect().top) / H * 60 - grab), 0, 1440 - S.set.slot); b = a + len;
          ev.style.top = a / 60 * H + 'px'; ev.style.left = '0'; ev.style.width = 'calc(100% - 3px)';
        }
        const t = $('.et', ev); if (t) t.textContent = label(a, b);
      };
      const up = () => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up); document.body.classList.remove('dragging');
        if (!moved) return;
        App.noClick = true; setTimeout(() => { App.noClick = false; }, 60);
        const d = pd(cur.dataset.col);
        Ops.move(o, addMin(d, a), addMin(d, b), false);
      };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    } else if (e.target === col || e.target.classList.contains('off')) {
      a = minAt(y0, col); if (a >= 1440) a = 1440 - S.set.slot;
      const start = a;
      const mv = m => {
        if (!moved && Math.abs(m.clientY - y0) < 5) return;
        if (!moved) { moved = true; ghost = document.createElement('div'); ghost.className = 'ev ghost'; col.appendChild(ghost); document.body.classList.add('dragging'); }
        const y = minAt(m.clientY, col); a = Math.min(start, y); b = Math.max(start, y); if (b - a < S.set.slot) b = a + S.set.slot;
        ghost.style.cssText = `top:${a / 60 * H}px;height:${(b - a) / 60 * H - 2}px;left:0;width:calc(100% - 3px)`; ghost.textContent = label(a, b);
      };
      const up = () => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up); document.body.classList.remove('dragging');
        if (!moved) return; // clique simples: tratado pela ação "slot"
        App.noClick = true; setTimeout(() => { App.noClick = false; }, 60);
        const d = pd(col.dataset.col);
        Quick.open(ghost, { scope: 'time', start: iso(addMin(d, a)), end: iso(addMin(d, b)) }, () => ghost && ghost.remove());
      };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    }
  };
}
Actions.slot = (el, e) => {
  if (e.target !== el && !e.target.classList.contains('off')) return;
  const H = hourH(), d = pd(el.dataset.col), a = clamp(Math.floor((e.clientY - el.getBoundingClientRect().top) / H * 60 / S.set.slot) * S.set.slot, 0, 1440 - S.set.slot);
  const ghost = document.createElement('div'); ghost.className = 'ev ghost';
  ghost.style.cssText = `top:${a / 60 * H}px;height:${S.set.defDur / 60 * H - 2}px;left:0;width:calc(100% - 3px)`; el.appendChild(ghost);
  Quick.open(ghost, { scope: 'time', start: iso(addMin(d, a)), end: iso(addMin(d, a + S.set.defDur)) }, () => ghost.remove());
};
Actions.cell = (el, e) => { if (e.target.closest('.chip,button')) return; Quick.open(e.target.closest('.mnumrow') || el, { scope: 'day', start: el.dataset.date }); };
Actions.goDay = el => App.go('day', pd(el.dataset.date));
Actions.done = el => { const it = Ops.get(el.dataset.id); if (it) Ops.toggleDone(it, el.dataset.key); };
Actions.addPeriod = el => Quick.open(el, { type: 'task', scope: el.dataset.scope, start: el.dataset.key });
Actions.openNote = el => App.go('journal', null, el.dataset.key);
Actions.moreDay = el => {
  const d = pd(el.dataset.date), list = occsOn(d);
  const m = modal({ title: fmtLong(d), body: `<div class="daylist">${list.map(o => chip(o, { multi: o.allDay })).join('') || '<p class="muted">Nada neste dia.</p>'}</div><div class="mfoot"><button class="btn ghost" id="mdj">${ic('note')} Diário do dia</button><button class="btn" id="mdd">Abrir o dia</button></div>` });
  $('#mdd', m.el).onclick = () => { m.close(); App.go('day', d); };
  $('#mdj', m.el).onclick = () => { m.close(); App.go('journal', null, ymd(d)); };
  m.el.addEventListener('click', ev => { if (ev.target.closest('.chip')) setTimeout(() => m.close(), 0); });
};

const viewTitle = (a, b) => a.getMonth() === b.getMonth() ? `${cap(MONTHS[a.getMonth()])} de ${a.getFullYear()}` : a.getFullYear() === b.getFullYear() ? `${cap(MONTHS[a.getMonth()].slice(0, 3))} – ${MONTHS[b.getMonth()].slice(0, 3)} de ${b.getFullYear()}` : `${cap(MONTHS[a.getMonth()].slice(0, 3))} ${a.getFullYear()} – ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
Views.day = {
  label: 'Dia', icon: 'today', key: 'D', group: 'cal',
  title: () => fmtLong(App.cur), step: n => { App.cur = addD(App.cur, n); },
  render: el => timeGrid(el, [sod(App.cur)]),
};
Views.week = {
  label: 'Semana', icon: 'cal', key: 'S', group: 'cal',
  days: () => weekDays(sow(App.cur)),
  title: () => { const d = Views.week.days(); return viewTitle(d[0], d[d.length - 1]) + (S.set.weekNums ? ` · semana ${isoWeek(addD(sow(App.cur), 3)).w}` : ''); },
  step: n => { App.cur = addD(App.cur, 7 * n); },
  render: el => timeGrid(el, Views.week.days(), periodStrip('week', weekKey(addD(sow(App.cur), 3)), 'Semana')),
};
Views.work = {
  label: 'Dias úteis', icon: 'cal', key: 'U', group: 'cal',
  days: () => { const s = sow(App.cur), out = []; for (let i = 0; i < 7; i++) if (isWorkDay(addD(s, i))) out.push(addD(s, i)); return out.length ? out : [sod(App.cur)]; },
  title: () => { const d = Views.work.days(); return viewTitle(d[0], d[d.length - 1]); },
  step: n => { App.cur = addD(App.cur, 7 * n); },
  render: el => timeGrid(el, Views.work.days(), periodStrip('week', weekKey(addD(sow(App.cur), 3)), 'Semana')),
};
Views.ndays = {
  get label() { return `${S.set.nDays} dias`; }, icon: 'cal', key: 'X', group: 'cal',
  days: () => [...Array(clamp(S.set.nDays, 2, 14)).keys()].map(i => addD(sod(App.cur), i)),
  title: () => { const d = Views.ndays.days(); return viewTitle(d[0], d[d.length - 1]); },
  step: n => { App.cur = addD(App.cur, S.set.nDays * n); },
  render: el => timeGrid(el, Views.ndays.days()),
};

/* ---------- Mês ---------- */
Views.month = {
  label: 'Mês', icon: 'grid', key: 'M', group: 'cal',
  title: () => `${cap(MONTHS[App.cur.getMonth()])} de ${App.cur.getFullYear()}`,
  step: n => { App.cur = addM(som(App.cur), n); },
  render(el) {
    const first = som(App.cur), g0 = sow(first), weeks = Math.ceil((daysBetween(g0, addM(first, 1))) / 7), now = new Date();
    const map = bucket(occs(g0, addD(g0, weeks * 7)), g0, weeks * 7), cols = weekDays(g0);
    const small = innerWidth < 640, rowH = (el.clientHeight - 74) / weeks, max = small ? 0 : Math.max(1, Math.floor((rowH - 30) / 22));
    let html = `<div class="mv${small ? ' small' : ''}" style="--n:${cols.length};--w:${weeks}">${periodStrip('month', monthKey(first), 'Mês')}<div class="mhd">${cols.map(d => `<div>${small ? DOW3[d.getDay()][0].toUpperCase() : DOW3[d.getDay()]}</div>`).join('')}</div><div class="mgrid">`;
    for (let w = 0; w < weeks; w++) for (const c of cols) {
      const d = addD(c, w * 7), k = ymd(d), list = map[k] || [], out = d.getMonth() !== first.getMonth();
      const show = list.length > max ? list.slice(0, Math.max(0, max - 1)) : list;
      const tint = (noteOf(k) || {}).color;
      html += `<div class="mcell${out ? ' out' : ''}${sameD(d, now) ? ' today' : ''}${isWorkDay(d) ? '' : ' wkend'}${tint ? ' tint' : ''}" ${tint ? `style="--tint:${tint}" ` : ''}data-date="${k}" data-act="${small ? 'moreDay' : 'cell'}">
        <div class="mnumrow">${S.set.weekNums && c === cols[0] ? `<span class="wk">S${isoWeek(addD(d, 3)).w}</span>` : ''}<button class="mnum" data-act="goDay" data-date="${k}">${d.getDate() === 1 && !small ? `1 ${MONTHS[d.getMonth()].slice(0, 3)}` : d.getDate()}</button>${small ? '' : dayBadges(d)}</div>
        ${small ? `<div class="mdots">${list.slice(0, 4).map(x => `<i style="background:${colorOf(x.o.it)}"></i>`).join('')}${hasNote(k) ? '<i class="nd"></i>' : ''}</div>` : show.map(x => chip(x.o, x)).join('') + (list.length > show.length ? `<button class="more" data-act="moreDay" data-date="${k}">+${list.length - show.length} mais</button>` : '')}</div>`;
    }
    el.innerHTML = html + '</div></div>';
  },
};

/* ---------- Ano ---------- */
function miniMonth(first, opt = {}) {
  const g0 = sow(first), now = new Date(), cnt = opt.cnt || {};
  let h = `<div class="mm"><div class="mmd">${[...Array(7).keys()].map(i => `<span>${DOW3[addD(g0, i).getDay()][0].toUpperCase()}</span>`).join('')}</div><div class="mmg">`;
  for (let i = 0; i < 42; i++) {
    const d = addD(g0, i), k = ymd(d), out = d.getMonth() !== first.getMonth(), n = cnt[k] || 0;
    if (i === 35 && out) break;
    h += `<button class="${out ? 'out' : ''}${sameD(d, now) ? ' today' : ''}${opt.sel && opt.sel(d) ? ' sel' : ''}${n ? ' h' + Math.min(4, n) : ''}${holiday(d) ? ' hol' : ''}${hasNote(k) ? ' nt' : ''}" data-act="${opt.act || 'goDay'}" data-date="${k}" title="${fmtLong(d)}${holiday(d) ? ' · ' + holiday(d) : ''}${n ? ' · ' + count(n, 'item', 'itens') : ''}">${d.getDate()}</button>`;
  }
  return h + '</div></div>';
}
const countByDay = (from, to) => { const c = {}; Object.entries(bucket(occs(from, to), from, daysBetween(from, to))).forEach(([k, v]) => c[k] = v.length); return c; };
Views.year = {
  label: 'Ano', icon: 'grid', key: 'A', group: 'cal',
  title: () => String(App.cur.getFullYear()), step: n => { App.cur = new Date(App.cur.getFullYear() + n, App.cur.getMonth(), 1); },
  render(el) {
    const y = App.cur.getFullYear(), cnt = countByDay(new Date(y, 0, 1), new Date(y + 1, 0, 1));
    el.innerHTML = `<div class="yv">${periodStrip('year', String(y), 'Ano')}<div class="ygrid">${[...Array(12).keys()].map(m => `<div class="ym"><button class="ymt" data-act="goMonth" data-date="${y}-${pad(m + 1)}-01">${cap(MONTHS[m])}</button>${miniMonth(new Date(y, m, 1), { cnt })}</div>`).join('')}</div></div>`;
  },
};
Actions.goMonth = el => App.go('month', pd(el.dataset.date));

/* ---------- Agenda (lista) ---------- */
Views.agenda = {
  label: 'Agenda', icon: 'list', key: 'G', group: 'cal',
  title: () => 'Agenda a partir de ' + fmtD(App.cur), step: n => { App.cur = addD(App.cur, 7 * n); },
  render(el) {
    const from = sod(App.cur), map = bucket(occs(from, addD(from, Cal.agendaN)), from, Cal.agendaN), now = new Date();
    let html = '';
    for (let i = 0; i < Cal.agendaN; i++) {
      const d = addD(from, i), list = map[ymd(d)] || [];
      if (!list.length && !sameD(d, now) && !holiday(d)) continue;
      html += `<section class="ag${sameD(d, now) ? ' today' : ''}" data-date="${ymd(d)}"><button class="agd" data-act="goDay" data-date="${ymd(d)}"><b>${d.getDate()}</b><span>${MONTHS[d.getMonth()].slice(0, 3)}, ${DOW3[d.getDay()]}</span></button><div class="agl">${holiday(d) ? `<div class="hol">${esc(holiday(d))}</div>` : ''}
        ${list.map(x => { const o = x.o, it = o.it; return `<div class="agr${o.done ? ' done' : ''}" data-act="pop" data-id="${it.id}" data-key="${o.key}" draggable="true">${it.type !== 'event' ? ckBtn(o) : `<i class="dot" style="background:${colorOf(it)}"></i>`}<time>${o.allDay ? 'Dia todo' : x.cl ? 'até ' + fmtT(o.e) : fmtT(o.s) + (it.type === 'event' ? ' – ' + fmtT(o.e) : '')}</time><b>${esc(it.title || '(sem título)')}</b><span class="meta">${it.loc ? ic('loc') + esc(cut(it.loc, 30)) : ''}${it.tags.map(tagChip).join('')}${marks(it)}</span></div>`; }).join('') || '<p class="muted">Nada marcado para hoje.</p>'}</div></section>`;
    }
    el.innerHTML = `<div class="agv">${html || '<p class="empty">Nenhum compromisso neste período.</p>'}<button class="btn ghost" data-act="agendaMore">Mostrar mais dias</button></div>`;
  },
};
Actions.agendaMore = () => { Cal.agendaN += 60; App.renderMain(); };

/* ---------- Minicalendário da barra lateral ---------- */
function miniCal() {
  const m = Cal.mini || som(App.cur), v = Views[App.view], range = v.days ? v.days() : null;
  const sel = d => range ? range.some(x => sameD(x, d)) : sameD(d, App.cur);
  return `<div class="mini"><div class="minih"><button class="link" data-act="goMonth" data-date="${ymd(m)}">${cap(MONTHS[m.getMonth()])} ${m.getFullYear()}</button><span class="grow"></span><button class="icon sm" data-act="miniStep" data-n="-1" title="Mês anterior">${ic('back')}</button><button class="icon sm" data-act="miniStep" data-n="1" title="Próximo mês">${ic('fwd')}</button></div>${miniMonth(m, { sel, act: 'miniDay', cnt: countByDay(sow(m), addD(sow(m), 42)) })}</div>`;
}
Actions.miniStep = el => { Cal.mini = addM(Cal.mini || som(App.cur), +el.dataset.n); App.renderSide(); };
Actions.miniDay = el => { Cal.mini = null; App.go(Views[App.view].group === 'cal' || App.view === 'journal' ? App.view : 'day', pd(el.dataset.date)); };

/* ---------- Arrastar e soltar (HTML5): itens sobre dias, colunas, horários e períodos ---------- */
addEventListener('dragstart', e => {
  const el = e.target.closest && e.target.closest('[draggable][data-id]'); if (!el) return;
  e.dataTransfer.setData('text/plain', el.dataset.id + '|' + (el.dataset.key || ''));
  e.dataTransfer.effectAllowed = 'move';
  document.body.classList.add('dnd');
});
addEventListener('dragend', () => { document.body.classList.remove('dnd'); $$('.dropon').forEach(x => x.classList.remove('dropon')); });
const dropTarget = e => e.target.closest && e.target.closest('[data-date],[data-col],[data-drop]');
addEventListener('dragover', e => {
  const t = dropTarget(e); if (!t || !document.body.classList.contains('dnd')) return;
  e.preventDefault();
  if (!t.classList.contains('dropon')) { $$('.dropon').forEach(x => x.classList.remove('dropon')); t.classList.add('dropon'); }
});
addEventListener('drop', async e => {
  const t = dropTarget(e), raw = e.dataTransfer && e.dataTransfer.getData('text/plain');
  if (!t || !raw || !document.body.classList.contains('dnd')) return;
  e.preventDefault();
  const [id, key] = raw.split('|'), o = getOcc(id, key); if (!o) return;
  const it = o.it;
  if (t.dataset.col) { // horário na grade: vira bloco de tempo
    const H = hourH(), d = pd(t.dataset.col), a = clamp(snap((e.clientY - t.getBoundingClientRect().top) / H * 60), 0, 1440 - S.set.slot);
    const len = o.s && !o.allDay ? (o.e - o.s) / 60000 : (it.est || (it.type === 'event' ? S.set.defDur : 30));
    if (o.s) await Ops.move(o, addMin(d, a), addMin(d, a + len), false);
    else { it.scope = 'time'; it.start = iso(addMin(d, a)); it.end = it.type === 'event' || it.est ? iso(addMin(d, a + len)) : ''; Ops.save(it); }
  } else if (t.dataset.date) {
    const d = pd(t.dataset.date);
    if (!o.s) { Ops.setDate(it, d); App.render(); }
    else if (o.allDay) await Ops.move(o, d, addD(d, daysBetween(o.s, o.e)), true);
    else { const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), o.s.getHours(), o.s.getMinutes()); await Ops.move(o, s, new Date(s.getTime() + (o.e - o.s)), false); }
  } else if (t.dataset.drop) {
    const [kind, a, b] = t.dataset.drop.split(':');
    if (kind === 'period') { it.scope = a; it.start = b; it.end = ''; it.rrule = ''; }
    else if (kind === 'status') { if (it.type === 'event') return toast('Eventos não têm situação'); it.status = a; it.doneAt = a === 'done' ? Date.now() : 0; if (a === 'done') beep(); }
    else if (kind === 'prio') it.prio = +a;
    else if (kind === 'list') it.list = a;
    else if (kind === 'cal') it.cal = a;
    else if (kind === 'tag') { if (!it.tags.includes(a)) it.tags.push(a); }
    else if (kind === 'none') { it.scope = 'none'; it.start = ''; it.end = ''; it.rrule = ''; }
    else if (kind === 'parent') { const p = Ops.get(a); if (p) Ops.link(it, 'parent', p); }
    else if (kind === 'quad') { it.prio = a === '1' || a === '2' ? Math.max(3, it.prio) : Math.min(2, it.prio); if (a === '1' || a === '3') { if (!it.due && it.scope === 'none') Ops.setDate(it, today()); } }
    Ops.save(it);
  }
});
