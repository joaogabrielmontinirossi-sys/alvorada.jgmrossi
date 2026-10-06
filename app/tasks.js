'use strict';
/* Alvorada — tarefas: lista, quadro (kanban), matriz, linha do tempo, conexões, hábitos e estatísticas */

const Tasks = { sel: null, zoom: 28, statRange: 'week', graphType: '' };
const allTasks = () => S.items.filter(it => it.type !== 'event' && shown(it));
// data de referência de uma tarefa (próxima ocorrência, início do período) ou null
function tdate(it) {
  if (it.scope === 'none') return pd(it.due);
  if (it.scope === 'week') return weekStartOf(it.start);
  if (it.scope === 'month' || it.scope === 'year') return pd(it.start);
  return it.rrule ? nextOcc(it, today()) : pd(it.start);
}
const tkey = it => { if (!it.rrule) return ''; const d = nextOcc(it, today()); return d ? ymd(d) : ''; };
const tdone = it => it.rrule ? (it.status === 'done') : isDone(it);
function trow(it, depth = 0) {
  const key = tkey(it), done = isDone(it, key), d = tdate(it), od = overdue(it), bl = done ? [] : Ops.blockers(it), kids = Ops.children(it), ck = it.check.length;
  const when = it.scope === 'none' ? '' : it.scope === 'time' || it.scope === 'day' ? (d ? relDay(d) + (it.scope === 'time' ? ' ' + fmtT(d) : '') : '') : whenText(it);
  const l = it.list && byId(S.lists, it.list);
  return `<div class="trow${done ? ' done' : ''}${od ? ' od' : ''}${Tasks.sel && Tasks.sel.has(it.id) ? ' selected' : ''}" style="--c:${colorOf(it)};--ind:${depth}" draggable="true" data-act="${Tasks.sel ? 'tsel' : 'pop'}" data-id="${it.id}" data-key="${key}">
    ${Tasks.sel ? `<span class="selbox">${Tasks.sel.has(it.id) ? ic('check') : ''}</span>` : ckBtn({ it, key, done })}
    <div class="tt"><b>${it.prio ? `<i class="pflag" style="color:${PRIO_COLOR[it.prio]}" title="Prioridade ${PRIO[it.prio].toLowerCase()}">${ic('flag')}</i>` : ''}${esc(it.title || '(sem título)')}${it.pin ? ic('pin') : ''}</b>
      <div class="tm">${when ? `<span class="${od ? 'err' : ''}">${ic(it.type === 'reminder' ? 'bell' : 'cal')}${esc(when)}</span>` : ''}${it.due ? `<span class="${od ? 'err' : ''}" title="Prazo">${ic('flag')}prazo ${fmtDs(pd(it.due))}</span>` : ''}${it.rrule ? `<span>${ic('repeat')}</span>` : ''}${l ? `<span>${l.icon || ''} ${esc(l.name)}</span>` : ''}${ck ? `<span>${ic('check')}${it.check.filter(c => c.done).length}/${ck}</span>` : ''}${kids.length ? `<span>${ic('list')}${kids.filter(k => k.status === 'done').length}/${kids.length}</span>` : ''}${bl.length ? `<span class="err" title="Depende de: ${esc(bl.map(b => b.title).join(', '))}">${ic('lock')}bloqueada</span>` : ''}${it.links.length ? `<span>${ic('link')}${it.links.length}</span>` : ''}${it.files.length ? `<span>${ic('clip')}${it.files.length}</span>` : ''}${it.status === 'doing' || it.status === 'wait' ? `<span class="st ${it.status}">${STATUS[it.status]}</span>` : ''}${it.progress && it.progress < 100 ? `<span>${it.progress}%</span>` : ''}${it.tags.map(tagChip).join('')}</div></div>
    <button class="icon sm" data-act="itemMenu" data-id="${it.id}" data-key="${key}" title="Mais ações">${ic('more')}</button></div>`;
}
// pais antes dos filhos, com recuo
function nested(list) {
  const ids = new Set(list.map(i => i.id)), out = [];
  const add = (it, depth) => { out.push(trow(it, depth)); list.filter(c => c.parent === it.id).forEach(c => add(c, Math.min(depth + 1, 4))); };
  list.filter(it => !it.parent || !ids.has(it.parent)).forEach(it => add(it, 0));
  return out.join('');
}
const TSORT = {
  smart: (a, b) => (b.pin - a.pin) || (b.prio - a.prio) || ((tdate(a) || 9e15) - (tdate(b) || 9e15)) || a.created - b.created,
  date: (a, b) => ((tdate(a) || 9e15) - (tdate(b) || 9e15)) || b.prio - a.prio,
  prio: (a, b) => b.prio - a.prio || a.title.localeCompare(b.title),
  title: (a, b) => a.title.localeCompare(b.title),
  created: (a, b) => b.created - a.created,
  updated: (a, b) => b.updated - a.updated,
};
const TTABS = { inbox: ['Entrada', 'inbox'], today: ['Hoje', 'today'], week: ['7 dias', 'cal'], late: ['Atrasadas', 'clock'], period: ['Semana/mês/ano', 'grid'], all: ['Todas', 'list'], done: ['Concluídas', 'check'] };
function taskFilter(tab) {
  const t0 = today(), t1 = addD(t0, 1), t7 = addD(t0, 7), open = it => !tdone(it) && it.status !== 'cancel';
  return allTasks().filter(it => {
    const d = tdate(it);
    if (tab === 'done') return tdone(it) || it.status === 'cancel';
    if (!open(it)) return false;
    if (tab === 'inbox') return it.scope === 'none' && !it.due;
    if (tab === 'today') return overdue(it) || ((it.scope === 'time' || it.scope === 'day') && d && d < t1) || (it.rrule && d && d < t1);
    if (tab === 'week') return (it.scope === 'time' || it.scope === 'day' || it.due) && d && d < t7;
    if (tab === 'late') return overdue(it);
    if (tab === 'period') return ['week', 'month', 'year'].includes(it.scope);
    return true;
  });
}
function groupTasks(list, by) {
  const g = new Map(), put = (k, label, it, order) => { if (!g.has(k)) g.set(k, { label, items: [], order }); g.get(k).items.push(it); };
  const t0 = today();
  for (const it of list) {
    if (by === 'date') {
      const d = tdate(it), n = d ? daysBetween(t0, d) : null;
      if (n === null) put('z', 'Sem data', it, 9); else if (overdue(it) || n < 0) put('a', 'Atrasadas', it, 0); else if (n === 0) put('b', 'Hoje', it, 1); else if (n === 1) put('c', 'Amanhã', it, 2); else if (n < 7) put('d', 'Próximos 7 dias', it, 3); else if (n < 31) put('e', 'Próximos 30 dias', it, 4); else put('f', 'Mais tarde', it, 5);
    } else if (by === 'list') { const l = byId(S.lists, it.list); put(it.list || '', l ? (l.icon ? l.icon + ' ' : '') + l.name : 'Sem lista', it, l ? 0 : 1); }
    else if (by === 'prio') put(it.prio, PRIO[it.prio], it, 4 - it.prio);
    else if (by === 'status') put(it.status, STATUS[it.status], it, Object.keys(STATUS).indexOf(it.status));
    else if (by === 'cal') put(it.cal, calOf(it).name || 'Sem calendário', it, 0);
    else if (by === 'tag') { if (!it.tags.length) put('', 'Sem etiqueta', it, 1); it.tags.forEach(t => put(t, '#' + tagRec(t).name, it, 0)); }
    else put('', '', it, 0);
  }
  return [...g.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}
Views.tasks = {
  label: 'Tarefas', icon: 'check', key: 'T', group: 'org', title: () => 'Tarefas e lembretes', step() {},
  render(el) {
    const tab = S.set.taskTab, list = taskFilter(tab).sort(TSORT[S.set.taskSort] || TSORT.smart), groups = groupTasks(list, tab === 'done' ? 'none' : S.set.taskGroup);
    const cnt = k => taskFilter(k).length, GB = { date: 'Data', list: 'Lista', prio: 'Prioridade', status: 'Situação', tag: 'Etiqueta', cal: 'Calendário', none: 'Sem grupos' }, SB = { smart: 'Inteligente', date: 'Data', prio: 'Prioridade', title: 'Título', created: 'Criação', updated: 'Alteração' };
    el.innerHTML = `<div class="tv"><div class="ttabs">${Object.entries(TTABS).map(([k, v]) => `<button class="${k === tab ? 'on' : ''}" data-act="taskTab" data-tab="${k}">${ic(v[1])}<span>${v[0]}</span>${k !== 'done' && k !== 'all' && cnt(k) ? `<i>${cnt(k)}</i>` : ''}</button>`).join('')}</div>
      <div class="tbar"><div class="qadd">${ic('plus')}<input id="tadd" placeholder="Nova tarefa… ex.: Pagar boleto sexta 10h !alta #casa" autocomplete="off"></div>
        <button class="btn ghost sm" data-act="taskGroup" title="Agrupar">${ic('folder')}<span>${GB[S.set.taskGroup]}</span></button><button class="btn ghost sm" data-act="taskSort" title="Ordenar">${ic('filter')}<span>${SB[S.set.taskSort]}</span></button>
        <button class="btn ghost sm${Tasks.sel ? ' on' : ''}" data-act="taskSelect">${ic('check')}<span>${Tasks.sel ? 'Cancelar' : 'Selecionar'}</span></button></div>
      ${Tasks.sel ? `<div class="bulk"><b>${count(Tasks.sel.size, 'selecionada', 'selecionadas')}</b><button class="btn sm" data-act="bulk" data-op="done">Concluir</button><button class="btn ghost sm" data-act="bulk" data-op="date">Data</button><button class="btn ghost sm" data-act="bulk" data-op="list">Lista</button><button class="btn ghost sm" data-act="bulk" data-op="tag">Etiqueta</button><button class="btn ghost sm" data-act="bulk" data-op="prio">Prioridade</button><button class="btn ghost sm danger" data-act="bulk" data-op="del">Excluir</button><button class="link" data-act="bulk" data-op="all">Selecionar todas</button></div>` : ''}
      <div class="tlist">${groups.map(g => `${g.label ? `<h4>${esc(g.label)} <span>${g.items.length}</span></h4>` : ''}${nested(g.items)}`).join('') || `<p class="empty">${{ inbox: 'A entrada está vazia. Tarefas sem data caem aqui.', today: 'Nada para hoje. Aproveite!', late: 'Nenhuma tarefa atrasada.', done: 'Nenhuma tarefa concluída ainda.' }[tab] || 'Nenhuma tarefa aqui.'}</p>`}</div></div>`;
    const inp = $('#tadd', el);
    inp.onkeydown = e => {
      if (e.key !== 'Enter' || !inp.value.trim()) return;
      const o = parseQuick(inp.value, null);
      if (!o.found) Object.assign(o, tab === 'today' ? { scope: 'day', start: ymd(today()) } : { scope: 'none', start: '' });
      if (Filter.lists.length === 1 && !o.list) o.list = Filter.lists[0];
      Ops.create(Object.assign({ type: 'task' }, o)); App.render();
      setTimeout(() => { const x = $('#tadd'); if (x) x.focus(); }, 0);
    };
  },
};
Actions.taskTab = el => { S.set.taskTab = el.dataset.tab; Store.saveSet(); App.renderMain(); };
const setOpt = (key, labels, anchor) => menu(anchor, Object.entries(labels).map(([k, v]) => ({ label: v, checked: S.set[key] === k, fn: () => { S.set[key] = k; Store.saveSet(); App.renderMain(); } })));
Actions.taskGroup = el => setOpt('taskGroup', { date: 'Data', list: 'Lista', prio: 'Prioridade', status: 'Situação', tag: 'Etiqueta', cal: 'Calendário', none: 'Sem grupos' }, el);
Actions.taskSort = el => setOpt('taskSort', { smart: 'Inteligente (fixadas, prioridade, data)', date: 'Data', prio: 'Prioridade', title: 'Título', created: 'Mais novas primeiro', updated: 'Alteradas por último' }, el);
Actions.taskSelect = () => { Tasks.sel = Tasks.sel ? null : new Set(); App.renderMain(); };
Actions.tsel = el => { const id = el.dataset.id; Tasks.sel.has(id) ? Tasks.sel.delete(id) : Tasks.sel.add(id); App.renderMain(); };
Actions.bulk = async el => {
  const op = el.dataset.op;
  if (op === 'all') { taskFilter(S.set.taskTab).forEach(it => Tasks.sel.add(it.id)); return App.renderMain(); }
  const its = [...Tasks.sel].map(Ops.get).filter(Boolean); if (!its.length) return toast('Selecione ao menos uma tarefa');
  const each = fn => { its.forEach(it => { fn(it); Data.put('items', it); }); Tasks.sel = null; App.render(); toast(`${count(its.length, 'tarefa alterada', 'tarefas alteradas')}`, { label: 'Desfazer', fn: () => Hist.undo() }); };
  if (op === 'done') each(it => { it.status = 'done'; it.doneAt = Date.now(); });
  else if (op === 'del') each(it => { it.deleted = Date.now(); });
  else if (op === 'date') menu(el, [{ label: 'Hoje', fn: () => each(it => Ops.setDate(it, today())) }, { label: 'Amanhã', fn: () => each(it => Ops.setDate(it, addD(today(), 1))) }, { label: 'Próxima segunda', fn: () => each(it => Ops.setDate(it, addD(today(), ((8 - today().getDay()) % 7) || 7))) }, { label: 'Sem data', fn: () => each(it => Ops.setDate(it, null)) }]);
  else if (op === 'list') menu(el, [{ label: 'Sem lista', fn: () => each(it => { it.list = ''; }) }, ...S.lists.map(l => ({ label: l.name, emoji: l.icon, color: l.icon ? '' : l.color, fn: () => each(it => { it.list = l.id; }) }))]);
  else if (op === 'prio') menu(el, PRIO.map((p, i) => ({ label: p, fn: () => each(it => { it.prio = i; }) })));
  else if (op === 'tag') { const t = await ask('Etiqueta para as tarefas selecionadas', '', 'ex.: casa'); if (t) { const id = ensureTag(t); each(it => { if (!it.tags.includes(id)) it.tags.push(id); }); } }
};

/* ---------- Quadro (kanban) ---------- */
function tcard(it) {
  const key = tkey(it), d = tdate(it), done = isDone(it, key);
  return `<div class="tcard${done ? ' done' : ''}" style="--c:${colorOf(it)}" draggable="true" data-act="pop" data-id="${it.id}" data-key="${key}">${ckBtn({ it, key, done })}<div><b>${esc(it.title || '(sem título)')}</b><div class="tm">${it.prio ? `<span style="color:${PRIO_COLOR[it.prio]}">${ic('flag')}${PRIO[it.prio]}</span>` : ''}${d ? `<span class="${overdue(it) ? 'err' : ''}">${ic('cal')}${relDay(d)}</span>` : ''}${it.check.length ? `<span>${ic('check')}${it.check.filter(c => c.done).length}/${it.check.length}</span>` : ''}${Ops.blockers(it).length && !done ? `<span class="err">${ic('lock')}</span>` : ''}${it.tags.map(tagChip).join('')}</div></div></div>`;
}
Views.board = {
  label: 'Quadro', icon: 'board', key: 'Q', group: 'org', title: () => 'Quadro de tarefas', step() {},
  render(el) {
    const by = S.set.kanbanBy, tasks = allTasks().filter(it => it.status !== 'cancel');
    let cols;
    if (by === 'prio') cols = [4, 3, 2, 1, 0].map(p => ({ k: 'prio:' + p, label: PRIO[p], color: PRIO_COLOR[p], items: tasks.filter(it => it.prio === p && !tdone(it)), add: { prio: p } }));
    else if (by === 'list') cols = [{ id: '', name: 'Sem lista', color: '#888' }, ...S.lists.filter(l => !l.archived)].map(l => ({ k: 'list:' + l.id, label: (l.icon ? l.icon + ' ' : '') + l.name, color: l.color, items: tasks.filter(it => it.list === l.id && !tdone(it)), add: { list: l.id } }));
    else if (by === 'cal') cols = S.calendars.map(c => ({ k: 'cal:' + c.id, label: c.name, color: c.color, items: tasks.filter(it => it.cal === c.id && !tdone(it)), add: { cal: c.id } }));
    else cols = ['todo', 'doing', 'wait', 'done'].map(s => ({ k: 'status:' + s, label: STATUS[s], color: { todo: '#888', doing: '#039be5', wait: '#e4b400', done: '#33b679' }[s], items: tasks.filter(it => it.status === s).sort(s === 'done' ? (a, b) => b.doneAt - a.doneAt : TSORT.smart).slice(0, s === 'done' ? 40 : 500), add: { status: s } }));
    el.innerHTML = `<div class="bv"><div class="tbar"><span class="muted">Arraste os cartões entre as colunas.</span><span class="grow"></span><button class="btn ghost sm" data-act="boardBy">${ic('folder')}<span>Colunas: ${{ status: 'Situação', prio: 'Prioridade', list: 'Lista', cal: 'Calendário' }[by]}</span></button></div>
      <div class="bcols">${cols.map((c, i) => `<div class="bcol" data-drop="${c.k}"><h4><i class="dot" style="background:${c.color}"></i>${esc(c.label)} <span>${c.items.length}</span><button class="icon sm" data-act="boardAdd" data-i="${i}" title="Nova tarefa aqui">${ic('plus')}</button></h4><div class="bl">${(by === 'status' ? c.items : c.items.sort(TSORT.smart)).map(tcard).join('')}</div></div>`).join('')}</div></div>`;
    Views.board.cols = cols;
  },
};
Actions.boardBy = el => setOpt('kanbanBy', { status: 'Situação', prio: 'Prioridade', list: 'Lista', cal: 'Calendário' }, el);
Actions.boardAdd = async el => { const t = await ask('Nova tarefa', '', 'Título (aceita data, #etiqueta, !prioridade)', 'Criar'); if (!t) return; const o = parseQuick(t, null); if (!o.found) { o.scope = 'none'; o.start = ''; } const add = Views.board.cols[+el.dataset.i].add; Ops.create(Object.assign({ type: 'task' }, o, add.prio !== undefined && o.prio ? {} : add)); App.render(); };

/* ---------- Matriz de Eisenhower ---------- */
Views.matrix = {
  label: 'Matriz', icon: 'grid', key: 'Z', group: 'org', title: () => 'Matriz de prioridades (Eisenhower)', step() {},
  render(el) {
    const lim = addD(today(), 2), tasks = allTasks().filter(it => !tdone(it) && it.status !== 'cancel');
    const urg = it => overdue(it) || (tdate(it) && tdate(it) <= lim && it.scope !== 'month' && it.scope !== 'year'), imp = it => it.prio >= 3;
    const Q = [['1', 'Fazer agora', 'Urgente e importante', it => urg(it) && imp(it)], ['2', 'Agendar', 'Importante, não urgente', it => !urg(it) && imp(it)], ['3', 'Delegar ou resolver rápido', 'Urgente, não importante', it => urg(it) && !imp(it)], ['4', 'Eliminar ou deixar para depois', 'Nem urgente nem importante', it => !urg(it) && !imp(it)]];
    el.innerHTML = `<div class="qv">${Q.map(([n, t, s, f]) => { const l = tasks.filter(f).sort(TSORT.smart); return `<div class="quad q${n}" data-drop="quad:${n}"><h4>${t} <span>${l.length}</span><small>${s}</small></h4><div class="bl">${l.slice(0, 60).map(tcard).join('') || '<p class="muted">Vazio</p>'}</div></div>`; }).join('')}</div>`;
  },
};

/* ---------- Linha do tempo (Gantt) ---------- */
Views.timeline = {
  label: 'Linha do tempo', icon: 'gantt', key: 'L', group: 'org',
  title: () => { const a = sow(App.cur); return 'Linha do tempo · ' + viewTitle(a, addD(a, Tasks.zoom - 1)); },
  step: n => { App.cur = addD(App.cur, 7 * n); },
  render(el) {
    const from = sow(App.cur), N = Tasks.zoom, to = addD(from, N), now = new Date(), rows = [];
    for (const it of S.items) {
      if (!shown(it) || it.scope === 'none' && !it.due) continue;
      let s, e;
      if (it.scope === 'time' || it.scope === 'day') { const sp = span(it); s = it.rrule ? nextOcc(it, from) : sp.s; if (!s) continue; e = it.rrule ? new Date(s.getTime() + (sp.e - sp.s)) : sp.e; }
      else if (it.scope === 'week') { s = weekStartOf(it.start); e = addD(s, 7); }
      else if (it.scope === 'month') { s = pd(it.start); e = addM(s, 1); }
      else if (it.scope === 'year') { s = pd(it.start); e = new Date(s.getFullYear() + 1, 0, 1); }
      else { s = pd(it.due); e = addD(s, 1); }
      if (it.due && it.type !== 'event') { const d = addD(pd(it.due), 1); if (d > e) e = d; }
      if (e <= from || s >= to) continue;
      if (it.type === 'event' && it.rrule && Filter.types.length === 0 && e - s < 864e5) continue; // recorrências curtas poluem a visão
      rows.push({ it, s, e, a: clamp((s - from) / 864e5, 0, N), b: clamp((e - from) / 864e5, 0, N) });
    }
    const grp = it => it.list ? 'l' + it.list : 'c' + it.cal, gname = it => it.list && byId(S.lists, it.list) ? byId(S.lists, it.list).name : calOf(it).name;
    rows.sort((x, y) => gname(x.it).localeCompare(gname(y.it)) || x.s - y.s);
    const RH = 30, pos = {}; let html = '', y = 0, last = null;
    rows.forEach(r => {
      if (grp(r.it) !== last) { last = grp(r.it); html += `<div class="gg">${esc(gname(r.it))}</div>`; y += 26; }
      const done = isDone(r.it, r.it.rrule ? ymd(r.s) : '');
      pos[r.it.id] = { x1: r.a, x2: r.b, y: y + RH / 2 };
      html += `<div class="gr"><div class="gl" data-act="pop" data-id="${r.it.id}" data-key="${r.it.rrule ? ymd(r.s) : ''}">${ic(typeIcon(r.it))}<span>${esc(r.it.title || '(sem título)')}</span></div><div class="gt"><div class="gb${done ? ' done' : ''}${overdue(r.it) ? ' od' : ''}" style="--c:${colorOf(r.it)};left:${r.a / N * 100}%;width:${Math.max(.6, (r.b - r.a) / N * 100)}%" data-act="pop" data-id="${r.it.id}" data-key="${r.it.rrule ? ymd(r.s) : ''}" title="${esc(r.it.title)} · ${fmtDs(r.s)} – ${fmtDs(addD(r.e, -1))}">${r.it.progress && !done ? `<i style="width:${r.it.progress}%"></i>` : ''}</div></div></div>`;
      y += RH;
    });
    // setas das dependências entre barras visíveis
    let arrows = '';
    rows.forEach(r => r.it.links.forEach(l => { const p = pos[r.it.id], q = pos[l.to]; if (!p || !q || (l.type !== 'blocks' && l.type !== 'next')) return; const x1 = p.x2 / N * 100, x2 = q.x1 / N * 100; arrows += `<path d="M${x1} ${p.y} C${x1 + 2} ${p.y} ${x2 - 2} ${q.y} ${x2} ${q.y}" class="${l.type}"/><circle cx="${x2}" cy="${q.y}" r="1.2" class="${l.type}"/>`; }));
    const nowX = (now - from) / 864e5 / N * 100;
    el.innerHTML = `<div class="gv"><div class="tbar"><span class="muted">Barras vão do início ao prazo. Setas mostram dependências (bloqueia / vem antes).</span><span class="grow"></span>${[14, 28, 56, 84].map(z => `<button class="btn ghost sm${Tasks.zoom === z ? ' on' : ''}" data-act="ganttZoom" data-z="${z}">${z / 7} sem.</button>`).join('')}</div>
      <div class="gscroll"><div class="gin"><div class="gr gh"><div class="gl"></div><div class="gt">${[...Array(N).keys()].map(i => { const d = addD(from, i); return `<span class="${isWorkDay(d) ? '' : 'wkend'}${sameD(d, now) ? ' today' : ''}" style="left:${i / N * 100}%;width:${100 / N}%">${N <= 28 || d.getDay() === 1 ? `${d.getDate()}${N <= 28 ? '<small>' + DOW3[d.getDay()][0] + '</small>' : ''}` : ''}</span>`; }).join('')}</div></div>
      <div class="gbody">${html || '<p class="empty">Nada com data neste período. Dê uma data ou um prazo às tarefas para vê-las aqui.</p>'}<div class="goverlay"><div class="gl"></div><div class="gt">${nowX >= 0 && nowX <= 100 ? `<i class="gnow" style="left:${nowX}%"></i>` : ''}<svg viewBox="0 0 100 ${Math.max(1, y)}" preserveAspectRatio="none" style="height:${y}px">${arrows}</svg></div></div></div></div></div></div>`;
  },
};
Actions.ganttZoom = el => { Tasks.zoom = +el.dataset.z; App.render(); };

/* ---------- Conexões (grafo dos vínculos) ---------- */
Views.graph = {
  label: 'Conexões', icon: 'graph', key: 'N', group: 'org', title: () => 'Conexões entre tarefas e eventos', step() {},
  render(el) {
    const edges = [], ids = new Set(), tf = Tasks.graphType;
    S.items.forEach(it => { if (it.deleted) return; it.links.forEach(l => { const o = Ops.get(l.to); if (o && !o.deleted && (!tf || tf === l.type)) { edges.push({ a: it.id, b: o.id, type: l.type }); ids.add(it.id); ids.add(o.id); } }); const p = it.parent && Ops.get(it.parent); if (p && !p.deleted && (!tf || tf === 'parent')) { edges.push({ a: it.id, b: p.id, type: 'parent' }); ids.add(it.id); ids.add(p.id); } });
    const nodes = [...ids].map((id, i, all) => ({ id, it: Ops.get(id), x: 500 + 320 * Math.cos(i / all.length * 6.283), y: 340 + 240 * Math.sin(i / all.length * 6.283), vx: 0, vy: 0 })), ix = {};
    nodes.forEach(n => ix[n.id] = n);
    for (let k = 0; k < 260 && nodes.length > 1; k++) { // simulação simples: repulsão entre todos, mola nas ligações
      for (const a of nodes) for (const b of nodes) { if (a === b) continue; const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 40, f = 5200 / d2; a.vx += dx * f / Math.sqrt(d2); a.vy += dy * f / Math.sqrt(d2); }
      for (const e of edges) { const a = ix[e.a], b = ix[e.b], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - 150) * .02; a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f; }
      for (const n of nodes) { n.vx += (500 - n.x) * .004; n.vy += (340 - n.y) * .004; n.x += clamp(n.vx, -14, 14); n.y += clamp(n.vy, -14, 14); n.vx *= .55; n.vy *= .55; }
    }
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y), minX = Math.min(...xs) - 110, maxX = Math.max(...xs) + 110, minY = Math.min(...ys) - 50, maxY = Math.max(...ys) + 60;
    const w = Math.max(1000, maxX - minX), h = Math.max(680, maxY - minY), x0 = (minX + maxX - w) / 2, y0 = (minY + maxY - h) / 2; // tamanho mínimo: poucos itens não ficam gigantes
    const TL = { '': 'Todos', blocks: 'Bloqueia', next: 'Sequência', related: 'Relacionada', parent: 'Subtarefa', dup: 'Duplicada', ref: 'Menção' };
    el.innerHTML = `<div class="grv"><div class="tbar"><span class="muted">${nodes.length ? `${count(nodes.length, 'item ligado', 'itens ligados')}, ${count(edges.length, 'vínculo', 'vínculos')}. Clique num item para abrir.` : ''}</span><span class="grow"></span>${Object.entries(TL).map(([k, v]) => `<button class="btn ghost sm${tf === k ? ' on' : ''}" data-act="graphType" data-t="${k}">${k ? `<i class="ln ${k}"></i>` : ''}${v}</button>`).join('')}</div>
      ${nodes.length ? `<div class="grwrap"><svg viewBox="${x0} ${y0} ${w} ${h}"><defs>${Object.keys(LINKS).map(t => `<marker id="ar-${t}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="mk ${t}"/></marker>`).join('')}</defs>
        ${edges.map(e => { const a = ix[e.a], b = ix[e.b], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, r = 16; return `<line class="ed ${e.type}" x1="${a.x + dx / d * r}" y1="${a.y + dy / d * r}" x2="${b.x - dx / d * r}" y2="${b.y - dy / d * r}" ${e.type === 'related' || e.type === 'dup' || e.type === 'ref' ? '' : `marker-end="url(#ar-${e.type})"`}><title>${LINKS[e.type][0]}</title></line>`; }).join('')}
        ${nodes.map(n => `<g class="nd${isDone(n.it) ? ' done' : ''}" data-act="pop" data-id="${n.id}" data-key="" transform="translate(${n.x},${n.y})"><circle r="13" fill="${colorOf(n.it)}"/><text class="ni" y="4" text-anchor="middle">${n.it.type === 'event' ? '◷' : isDone(n.it) ? '✓' : '○'}</text><text y="29" text-anchor="middle">${esc(cut(n.it.title || '(sem título)', 26))}</text></g>`).join('')}</svg></div>`
        : `<p class="empty">Ainda não há vínculos${tf ? ' deste tipo' : ''}.<br>Abra uma tarefa ou evento e use <b>Vínculos</b> para ligar itens: bloqueia, vem antes de, relacionada, subtarefa, duplicada ou menção.</p>`}</div>`;
  },
};
Actions.graphType = el => { Tasks.graphType = el.dataset.t; App.renderMain(); };

/* ---------- Hábitos ---------- */
function streak(h) { let n = 0, d = today(); if (!h.days[ymd(d)]) d = addD(d, -1); while (h.days[ymd(d)]) { n++; d = addD(d, -1); } return n; }
Views.habits = {
  label: 'Hábitos', icon: 'heart', key: 'B', group: 'org', title: () => 'Hábitos', step: n => { App.cur = addD(App.cur, 7 * n); },
  render(el) {
    const N = innerWidth < 700 ? 7 : 21, end = sod(App.cur) > today() ? sod(App.cur) : (daysBetween(sod(App.cur), today()) < N ? today() : sod(App.cur)), days = [...Array(N).keys()].map(i => addD(end, i - N + 1)), hs = S.habits.filter(h => !h.archived);
    el.innerHTML = `<div class="hv"><div class="tbar"><span class="muted">Marque cada dia em que cumpriu o hábito.</span><span class="grow"></span><button class="btn sm" data-act="habitNew">${ic('plus')} Novo hábito</button></div>
      ${hs.length ? `<div class="hgrid" style="--n:${N}"><div class="hrow hh"><div></div>${days.map(d => `<span class="${sameD(d, today()) ? 'today' : ''}">${DOW3[d.getDay()][0].toUpperCase()}<b>${d.getDate()}</b></span>`).join('')}<div>Sequência</div></div>
        ${hs.map(h => { const wk = days.slice(-7).filter(d => h.days[ymd(d)]).length; return `<div class="hrow" style="--c:${h.color}"><button class="hn" data-act="habitMenu" data-id="${h.id}">${h.icon || '•'} ${esc(h.name)}</button>${days.map(d => `<button class="hc${h.days[ymd(d)] ? ' on' : ''}${d > today() ? ' fut' : ''}" data-act="habitTog" data-id="${h.id}" data-date="${ymd(d)}" title="${fmtLong(d)}">${h.days[ymd(d)] ? ic('check') : ''}</button>`).join('')}<div class="hs"><b>${streak(h)}</b> dias · ${wk}/${h.goal} na semana</div></div>`; }).join('')}</div>`
        : '<p class="empty">Nenhum hábito ainda. Crie um para acompanhar sua rotina: beber água, ler, exercitar-se…</p>'}</div>`;
  },
};
async function habitEdit(h) {
  const isNew = !h; h = h || NORM.habits({ id: uid(), name: '', color: PALETTE[S.habits.length % 16][1] });
  const m = modal({ title: isNew ? 'Novo hábito' : 'Editar hábito', body: `<label>Nome</label><input id="hn" value="${esc(h.name)}" maxlength="60" placeholder="Ex.: Ler 20 minutos"><div class="row2"><div><label>Ícone (emoji)</label><input id="hi" value="${esc(h.icon)}" maxlength="4" placeholder="📚"></div><div><label>Meta semanal (dias)</label><input id="hg" type="number" min="1" max="7" value="${h.goal}"></div></div><label>Cor</label>${colorDots(h.color)}<div class="mfoot"><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="hok">Salvar</button></div>` });
  bindDots(m.el, c => { h.color = c; });
  $('#hok', m.el).onclick = () => { h.name = $('#hn', m.el).value.trim() || 'Hábito'; h.icon = $('#hi', m.el).value.trim(); h.goal = clamp(+$('#hg', m.el).value || 7, 1, 7); Data.put('habits', h); m.close(); App.render(); };
}
Actions.habitNew = () => habitEdit();
Actions.habitTog = el => { const h = byId(S.habits, el.dataset.id), k = el.dataset.date; if (h.days[k]) delete h.days[k]; else { h.days[k] = 1; beep(); } Data.put('habits', h); App.renderMain(); };
Actions.habitMenu = el => { const h = byId(S.habits, el.dataset.id); menu(el, [{ label: 'Editar', icon: 'edit', fn: () => habitEdit(h) }, { label: 'Arquivar', icon: 'inbox', fn: () => { h.archived = true; Data.put('habits', h); App.render(); } }, { label: 'Excluir', icon: 'trash', danger: true, fn: async () => { if (await confirmBox(`Excluir o hábito "${h.name}" e todo o histórico?`, 'Excluir', true)) { Data.del('habits', h.id); App.render(); } } }]); };

/* ---------- Estatísticas ---------- */
Views.stats = {
  label: 'Estatísticas', icon: 'chart', key: 'E', group: 'org',
  range: () => Tasks.statRange === 'week' ? [sow(App.cur), addD(sow(App.cur), 7)] : Tasks.statRange === 'month' ? [som(App.cur), addM(som(App.cur), 1)] : [new Date(App.cur.getFullYear(), 0, 1), new Date(App.cur.getFullYear() + 1, 0, 1)],
  title: () => { const [a, b] = Views.stats.range(); return 'Estatísticas · ' + (Tasks.statRange === 'year' ? a.getFullYear() : Tasks.statRange === 'month' ? `${MONTHS[a.getMonth()]} de ${a.getFullYear()}` : `${fmtDs(a)} a ${fmtDs(addD(b, -1))}`); },
  step: n => { App.cur = Tasks.statRange === 'week' ? addD(App.cur, 7 * n) : Tasks.statRange === 'month' ? addM(som(App.cur), n) : new Date(App.cur.getFullYear() + n, 0, 1); },
  render(el) {
    const [a, b] = Views.stats.range(), all = occs(a, b, { keepDone: true }), evs = all.filter(o => o.it.type === 'event' && !o.allDay);
    const mins = o => (Math.min(o.e, b) - Math.max(o.s, a)) / 60000, sum = (list, keyFn) => { const m = new Map(); list.forEach(o => [].concat(keyFn(o)).forEach(k => m.set(k, (m.get(k) || 0) + mins(o)))); return [...m.entries()].sort((x, y) => y[1] - x[1]); };
    const total = evs.reduce((n, o) => n + mins(o), 0), byCal = sum(evs, o => o.it.cal), byTag = sum(evs.filter(o => o.it.tags.length), o => o.it.tags), byDow = [...Array(7).keys()].map(d => evs.filter(o => o.s.getDay() === d).reduce((n, o) => n + mins(o), 0)), byHour = [...Array(24).keys()].map(h => evs.filter(o => o.s.getHours() <= h && (o.e.getHours() > h || !sameD(o.s, o.e))).length);
    const tasks = S.items.filter(it => it.type !== 'event' && !it.deleted), doneIn = tasks.filter(it => it.doneAt >= +a && it.doneAt < +b).length + tasks.reduce((n, it) => n + Object.values(it.doneOn).filter(t => t >= +a && t < +b).length, 0);
    const sched = all.filter(o => o.it.type !== 'event'), schedDone = sched.filter(o => o.done).length, late = tasks.filter(overdue).length, focus = evs.filter(o => o.it.kind === 'focus').reduce((n, o) => n + mins(o), 0), meet = evs.filter(o => o.it.guests.length || o.it.url).reduce((n, o) => n + mins(o), 0);
    const hrs = m => (m / 60).toFixed(1).replace('.', ',') + ' h', bars = (rows, max) => rows.length ? rows.map(([label, v, color]) => `<div class="sbar"><span>${label}</span><div><i style="width:${max ? v / max * 100 : 0}%;background:${color || 'var(--accent)'}"></i></div><b>${hrs(v)}</b></div>`).join('') : '<p class="muted">Sem dados no período.</p>';
    const mx = Math.max(1, ...byDow), mh = Math.max(1, ...byHour);
    el.innerHTML = `<div class="sv"><div class="tbar"><span class="grow"></span>${[['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano']].map(([k, v]) => `<button class="btn ghost sm${Tasks.statRange === k ? ' on' : ''}" data-act="statRange" data-r="${k}">${v}</button>`).join('')}</div>
      <div class="scards"><div><b>${hrs(total)}</b><span>em eventos</span></div><div><b>${evs.length}</b><span>eventos</span></div><div><b>${hrs(meet)}</b><span>em reuniões</span></div><div><b>${hrs(focus)}</b><span>de foco</span></div><div><b>${doneIn}</b><span>tarefas concluídas</span></div><div><b>${sched.length ? Math.round(schedDone / sched.length * 100) : 0}%</b><span>do planejado feito</span></div><div><b class="${late ? 'err' : ''}">${late}</b><span>atrasadas agora</span></div><div><b>${S.habits.filter(h => !h.archived).reduce((n, h) => n + Object.keys(h.days).filter(k => k >= ymd(a) && k < ymd(b)).length, 0)}</b><span>marcações de hábitos</span></div></div>
      <div class="sgrid"><section><h4>Tempo por calendário</h4>${bars(byCal.map(([k, v]) => [esc((byId(S.calendars, k) || {}).name || '—'), v, (byId(S.calendars, k) || {}).color]), byCal[0] && byCal[0][1])}</section>
        <section><h4>Tempo por etiqueta</h4>${bars(byTag.map(([k, v]) => ['#' + esc(tagRec(k).name), v, tagRec(k).color]), byTag[0] && byTag[0][1])}</section>
        <section><h4>Por dia da semana</h4><div class="scol">${byDow.map((v, d) => `<div title="${hrs(v)}"><i style="height:${v / mx * 100}%"></i><span>${DOW3[d]}</span></div>`).join('')}</div></section>
        <section><h4>Horários mais ocupados</h4><div class="scol hr">${byHour.map((v, h) => `<div title="${h}h: ${count(v, 'evento', 'eventos')}"><i style="height:${v / mh * 100}%"></i><span>${h % 3 ? '' : h}</span></div>`).join('')}</div></section></div></div>`;
  },
};
Actions.statRange = el => { Tasks.statRange = el.dataset.r; App.render(); };

/* ---------- Painel lateral de tarefas (para arrastar ao calendário) ---------- */
function taskPanel() {
  const open = allTasks().filter(it => !tdone(it) && it.status !== 'cancel'), late = open.filter(overdue).sort(TSORT.date), inbox = open.filter(it => it.scope === 'none' && !overdue(it)).sort(TSORT.smart), td = open.filter(it => !overdue(it) && (it.scope === 'day' || it.scope === 'time') && tdate(it) && sameD(tdate(it), today())).sort(TSORT.date);
  const sec = (t, l) => l.length ? `<h4>${t} <span>${l.length}</span></h4>${l.slice(0, 40).map(it => trow(it)).join('')}` : '';
  return `<div class="phead"><b>Tarefas</b><span class="grow"></span><button class="icon sm" data-act="togglePanel" title="Fechar painel">${ic('x')}</button></div><div class="qadd">${ic('plus')}<input id="padd" placeholder="Nova tarefa sem data" autocomplete="off"></div><p class="muted">Arraste uma tarefa para o calendário para reservar um horário.</p><div class="plist" data-drop="none">${sec('Atrasadas', late)}${sec('Hoje', td)}${sec('Sem data', inbox) || (late.length || td.length ? '' : '<p class="empty">Tudo em dia.</p>')}</div>`;
}
