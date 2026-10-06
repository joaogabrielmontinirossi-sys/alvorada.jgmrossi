'use strict';
/* Alvorada — casca do aplicativo: navegação, barra lateral, atalhos, avisos e inicialização */

const SEG = ['day', 'week', 'month', 'year', 'agenda'];
const App = {
  view: 'week', cur: new Date(), noteKey: '', noClick: false, pending: false,
  go(view, date, noteKey) {
    if (view && Views[view]) App.view = view;
    if (date) App.cur = sod(date);
    if (App.view === 'journal') {
      if (noteKey) { App.noteKey = String(noteKey); const d = keyDate(App.noteKey); if (d && keyKind(App.noteKey) !== 'page') App.cur = sod(d); }
      else if (date || !App.noteKey) App.noteKey = ymd(App.cur);
    }
    Cal.mini = null; Cal.agendaN = 45; Tasks.sel = null;
    if (S.set.view !== App.view) { S.set.view = App.view; Store.saveSet(); }
    document.body.classList.remove('side-open');
    closePop(); App.render();
    $('#view').scrollTop = 0;
  },
  // bg = pedido vindo da sincronização: não atropela quem está digitando
  render(bg) {
    const a = document.activeElement;
    if (bg && a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && !a.closest('#sidebar')) { App.pending = true; return; }
    App.pending = false;
    App.renderSide(); App.renderTop(); App.renderMain(); App.renderPanel();
    try { history.replaceState(null, '', '#/' + App.view + '/' + (App.view === 'journal' ? App.noteKey : ymd(App.cur))); } catch (e) {}
  },
  renderMain() {
    const el = $('#view');
    document.body.dataset.view = App.view;
    try { Views[App.view].render(el); } catch (e) { console.error(e); el.innerHTML = `<p class="empty">Não foi possível mostrar esta visão.<br><small>${esc(e.message)}</small></p>`; }
    App.renderFilter();
  },
  renderTop() {
    const v = Views[App.view], inSeg = SEG.includes(App.view);
    $('#topbar').innerHTML = `<button class="icon mobile" data-act="openSide" title="Menu">${ic('menu')}</button>
      <button class="btn ghost sm" data-act="today" title="Ir para hoje (H)">Hoje</button>
      <button class="icon" data-act="step" data-n="-1" title="Anterior (←)">${ic('back')}</button><button class="icon" data-act="step" data-n="1" title="Próximo (→)">${ic('fwd')}</button>
      <button class="ttl" data-act="goto" title="Ir para uma data (I)">${esc(v.title())}</button><span class="grow"></span>
      <div class="seg views">${SEG.map(k => `<button class="${App.view === k ? 'on' : ''}" data-act="view" data-v="${k}" title="${Views[k].label} (${Views[k].key})">${Views[k].label}</button>`).join('')}</div>
      <button class="btn ghost sm vmore${inSeg ? '' : ' on'}" data-act="viewMenu" title="Todas as visões">${ic(v.icon)}<span>${inSeg ? 'Mais' : v.label}</span>${ic('down')}</button>
      <button class="icon" data-act="palette" title="Pesquisar e comandos (Ctrl+K ou /)">${ic('search')}</button>
      <button class="icon${filterOn() ? ' on' : ''}" data-act="filterMenu" title="Filtrar (F)">${ic('filter')}</button>
      <button class="icon${S.set.panel ? ' on' : ''} desk" data-act="togglePanel" title="Painel de tarefas (P)">${ic('panel')}</button>
      <button class="icon" data-act="topMenu" title="Mais">${ic('more')}</button>`;
    $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.v === App.view));
  },
  renderFilter() {
    const bar = $('#filterbar');
    if (!filterOn()) { bar.hidden = true; return; }
    bar.hidden = false;
    const x = (label, k, v) => `<span class="chipx">${label}<button data-act="filterDrop" data-k="${k}" data-v="${esc(v)}">×</button></span>`;
    bar.innerHTML = `${ic('filter')}${Filter.q ? x('“' + esc(Filter.q) + '”', 'q', '') : ''}${Filter.types.map(t => x(TYPES[t], 'types', t)).join('')}${Filter.tags.map(t => x('#' + esc(tagRec(t).name), 'tags', t)).join('')}${Filter.lists.map(l => x(esc((byId(S.lists, l) || {}).name || 'Sem lista'), 'lists', l)).join('')}${Filter.prio ? x('Prioridade ≥ ' + PRIO[Filter.prio].toLowerCase(), 'prio', '') : ''}${Filter.status ? x(STATUS[Filter.status], 'status', '') : ''}<span class="grow"></span><button class="link" data-act="saveView">${ic('star')} Salvar visão</button><button class="link" data-act="clearFilter">Limpar</button>`;
  },
  renderSide() {
    const el = $('#sidebar'), sc = $('.sscroll', el), top = sc ? sc.scrollTop : 0, q = $('#sideq', el), qv = q ? q.value : '', qf = q && document.activeElement === q;
    const nav = k => `<button class="${App.view === k ? 'on' : ''}" data-act="view" data-v="${k}" title="${Views[k].label} (${Views[k].key})">${ic(Views[k].icon)}<span>${Views[k].label}</span></button>`;
    const trash = S.items.filter(i => i.deleted).length, late = S.items.filter(i => !i.deleted && overdue(i)).length;
    el.innerHTML = `<div class="brand">${LOGO}<b>Alvorada</b><span class="grow"></span><button class="icon mobile" data-act="closeSide" title="Fechar">${ic('x')}</button></div>
      <div class="sscroll">
      <div class="inl"><button class="btn grow" data-act="create">${ic('plus')} Criar</button><button class="btn ghost" data-act="createMenu" title="Outros tipos e modelos">${ic('down')}</button></div>
      <div class="qadd">${ic('bolt')}<input id="sideq" placeholder="Adição rápida: “dentista sexta 15h”" autocomplete="off" title="Escreva e pressione Enter"></div>
      ${miniCal()}
      <div id="upnext"></div>
      <div class="snav">${['tasks', 'board', 'journal', 'timeline', 'matrix', 'habits', 'files', 'graph', 'stats'].map(nav).join('')}</div>
      <div class="shead"><span>Calendários</span><button class="icon sm" data-act="calAdd" title="Novo calendário, assinar ou importar">${ic('plus')}</button></div>
      ${S.calendars.slice().sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map(c => `<div class="srow" data-drop="cal:${c.id}"><button class="cbox${S.set.hideCals[c.id] ? '' : ' on'}" style="--c:${c.color}" data-act="calToggle" data-id="${c.id}" title="Mostrar ou ocultar">${ic('check')}</button><button class="sname" data-act="calToggle" data-id="${c.id}">${esc(c.name)}${c.gid ? '<small>Google</small>' : c.url ? '<small>assinado</small>' : ''}${c.id === defCal() ? '<small>padrão</small>' : ''}</button><button class="icon sm" data-act="calMenu" data-id="${c.id}">${ic('more')}</button></div>`).join('')}
      <div class="srow"><button class="cbox${S.set.holidays ? ' on' : ''}" style="--c:#0b8043" data-act="holToggle">${ic('check')}</button><button class="sname" data-act="holToggle">Feriados no Brasil</button></div>
      <div class="shead"><span>Listas e projetos</span><button class="icon sm" data-act="listAdd" title="Nova lista">${ic('plus')}</button></div>
      ${S.lists.filter(l => !l.archived).map(l => { const n = S.items.filter(i => i.list === l.id && !i.deleted && i.type !== 'event' && i.status !== 'done' && i.status !== 'cancel').length; return `<div class="srow${Filter.lists.includes(l.id) ? ' on' : ''}" data-drop="list:${l.id}"><button class="sname" data-act="listOpen" data-id="${l.id}"><i class="dot" style="background:${l.color}"></i>${l.icon ? l.icon + ' ' : ''}${esc(l.name)}${n ? `<small>${n}</small>` : ''}</button><button class="icon sm" data-act="listMenu" data-id="${l.id}">${ic('more')}</button></div>`; }).join('') || '<p class="muted pad">Agrupe tarefas em listas ou projetos.</p>'}
      <div class="shead"><span>Etiquetas</span><button class="icon sm" data-act="tagAdd" title="Nova etiqueta">${ic('plus')}</button></div>
      <div class="stags">${S.tags.map(t => `<button class="tagc${Filter.tags.includes(t.id) ? ' on' : ''}" style="--c:${t.color}" data-act="tagToggle" data-id="${t.id}" data-drop="tag:${t.id}" title="Clique para filtrar · botão direito para editar">${esc(t.name)}</button>`).join('') || '<p class="muted pad">Use #etiqueta ao criar um item.</p>'}</div>
      ${S.views.length ? `<div class="shead"><span>Visões salvas</span></div>${S.views.map(v => `<div class="srow"><button class="sname" data-act="viewApply" data-id="${v.id}">${ic('star')}${esc(v.name)}</button><button class="icon sm" data-act="viewDel" data-id="${v.id}" title="Remover">${ic('x')}</button></div>`).join('')}` : ''}
      ${S.set.clocks.length ? `<div class="shead"><span>Relógios</span></div><div id="clocks"></div>` : ''}
      </div>
      <div class="sfoot">
        ${canInstall() ? `<button class="link" data-act="install">${ic('dl')} Instalar o aplicativo</button>` : ''}
        ${late ? `<button class="link err" data-act="lateOpen">${ic('clock')} ${count(late, 'tarefa atrasada', 'tarefas atrasadas')}</button>` : ''}
        ${trash ? `<button class="link" data-act="view" data-v="trash">${ic('trash')} Lixeira (${trash})</button>` : ''}
        <button class="link" data-act="settings" title="Ajustes e sincronização">${ic(Sync.any() ? 'sync' : 'gear')}<span id="syncst">${Sync.status()}</span></button>
      </div>`;
    const sc2 = $('.sscroll', el); if (sc2) sc2.scrollTop = top;
    const q2 = $('#sideq', el); q2.value = qv; if (qf) q2.focus();
    q2.onkeydown = e => {
      if (e.key !== 'Enter' || !q2.value.trim()) return;
      const o = parseQuick(q2.value, null);
      if (!o.found) { o.scope = 'none'; o.start = ''; }
      const it = Ops.create(Object.assign({ type: o.timed ? 'event' : 'task' }, o)); q2.value = '';
      if (o.scope === 'time' || o.scope === 'day') App.cur = sod(pd(it.start));
      App.render(); toast(`${TYPES[it.type]} criad${it.type === 'event' || it.type === 'reminder' ? 'o' : 'a'}: ${cut(it.title, 30)} · ${whenText(it)}`, { label: 'Abrir', fn: () => Editor.open(it) });
    };
    App.renderNext();
  },
  renderFoot() { const s = $('#syncst'); if (s) s.textContent = Sync.status(); },
  renderNext() {
    const el = $('#upnext'); if (!el) return;
    const now = new Date(), list = occs(now, addD(now, 1)).filter(o => !o.allDay && o.it.type === 'event' && o.e > now && o.it.rsvp !== 'no').sort((a, b) => a.s - b.s), o = list[0];
    const mins = d => Math.max(0, Math.round((d - now) / 60000));
    el.innerHTML = o ? `<div class="upnext" style="--c:${colorOf(o.it)}" data-act="pop" data-id="${o.it.id}" data-key="${o.key}"><small>${o.s <= now ? `Agora · termina em ${fmtDur(mins(o.e))}` : `Em ${fmtDur(mins(o.s))} · ${fmtT(o.s)}`}</small><b>${esc(o.it.title || '(sem título)')}</b>${o.it.url ? `<a class="btn sm" href="${esc(o.it.url)}" target="_blank" rel="noopener">${ic('video')} Entrar</a>` : ''}</div>` : '';
    const ck = $('#clocks'); if (ck) ck.innerHTML = S.set.clocks.map(z => `<div class="clock"><span>${esc(z.split('/').pop().replace(/_/g, ' '))}</span><b>${timeIn(z, now)}</b></div>`).join('');
  },
  renderPanel() {
    const on = S.set.panel && innerWidth >= 1000;
    document.body.classList.toggle('has-panel', !!on);
    const el = $('#panel'); if (!on) { el.innerHTML = ''; return; }
    el.innerHTML = taskPanel();
    const inp = $('#padd', el);
    inp.onkeydown = e => { if (e.key !== 'Enter' || !inp.value.trim()) return; const o = parseQuick(inp.value, null); if (!o.found) { o.scope = 'none'; o.start = ''; } Ops.create(Object.assign({ type: 'task' }, o)); App.render(); setTimeout(() => { const x = $('#padd'); if (x) x.focus(); }, 0); };
  },
};
addEventListener('focusout', () => setTimeout(() => { if (App.pending) App.render(true); }, 200));

/* ---------- Ações gerais ---------- */
const applyTheme = () => {
  const dark = S.set.theme === 'dark' || (S.set.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--accent', S.set.accent);
  document.body.dataset.font = S.set.font; document.body.dataset.density = S.set.density;
  document.body.classList.toggle('no-side', !S.set.side);
  const m = $('meta[name=theme-color]'); if (m) m.content = dark ? '#0b1220' : S.set.accent;
};
Actions.view = el => App.go(el.dataset.v);
Actions.today = () => { App.cur = today(); if (App.view === 'journal') App.noteKey = keyFor(keyKind(App.noteKey) === 'page' ? 'day' : keyKind(App.noteKey), App.cur); Cal.scroll = null; Cal.mini = null; App.render(); };
Actions.step = el => { Views[App.view].step(+el.dataset.n); Cal.mini = null; closePop(); App.render(); };
Actions.openSide = () => document.body.classList.add('side-open');
Actions.closeSide = () => document.body.classList.remove('side-open');
Actions.togglePanel = () => { S.set.panel = !S.set.panel; Store.saveSet(); if (S.set.panel && innerWidth < 1000) { S.set.panel = false; return App.go('tasks'); } App.render(); };
Actions.toggleSide = () => { S.set.side = !S.set.side; Store.saveSet(); applyTheme(); App.renderMain(); };
Actions.create = el => { const d = sod(App.cur), n = new Date(), s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.min(23, n.getHours() + 1)); Quick.open(el, { scope: 'time', start: iso(s), end: iso(addMin(s, S.set.defDur)) }); };
Actions.fab = el => Actions.createMenu(el);
Actions.createMenu = el => {
  const d = ymd(App.cur), mk = (type, o) => () => Editor.open(newItem(type, o));
  menu(el, [
    { label: 'Evento', icon: 'cal', hint: 'C', fn: () => Actions.create(el) },
    { label: 'Tarefa', icon: 'check', fn: mk('task', { scope: 'day', start: d }) },
    { label: 'Lembrete', icon: 'bell', fn: mk('reminder', { scope: 'time', start: iso(addMin(new Date(), 60)).slice(0, 14) + '00', rem: [0] }) },
    { label: 'Tarefa sem data', icon: 'inbox', fn: mk('task', { scope: 'none' }) },
    { label: 'Tarefa do mês', icon: 'grid', fn: mk('task', { scope: 'month', start: monthKey(App.cur) }) },
    '-',
    { label: 'Tempo de foco', icon: 'bolt', fn: mk('event', { title: 'Foco', kind: 'focus', scope: 'time', start: d + 'T09:00', end: d + 'T11:00', color: '#3f51b5' }) },
    { label: 'Fora do escritório', icon: 'sun', fn: mk('event', { title: 'Fora do escritório', kind: 'ooo', scope: 'day', start: d, color: '#616161' }) },
    { label: 'Aniversário', icon: 'heart', fn: mk('event', { title: 'Aniversário de ', kind: 'birthday', scope: 'day', start: d, rrule: 'FREQ=YEARLY', color: '#d81b60', rem: [0] }) },
    { label: 'Anotação no diário', icon: 'book', fn: () => App.go('journal', App.cur) },
    S.templates.length && '-', S.templates.length && { head: 'Modelos' },
    ...S.templates.map(t => ({ label: t.name, icon: 'star', fn: () => { const o = Object.assign({}, t.item); if (o.scope === 'time' && o.start) { const sp = span(normItem(Object.assign({}, o))); o.start = d + o.start.slice(10); o.end = o.end ? iso(new Date(pd(o.start).getTime() + (sp.e - sp.s))) : ''; } else if (o.scope === 'day') { o.start = d; o.end = ''; } Editor.open(newItem(o.type || 'event', o)); } })),
    S.templates.length && { label: 'Gerenciar modelos…', icon: 'gear', fn: () => Settings.templates() },
  ]);
};
Actions.viewMenu = el => menu(el, [{ head: 'Calendário' }, ...['day', 'work', 'week', 'ndays', 'month', 'year', 'agenda'].map(k => ({ label: Views[k].label, icon: Views[k].icon, hint: Views[k].key, checked: App.view === k, fn: () => App.go(k) })), { head: 'Organização' }, ...['tasks', 'board', 'matrix', 'timeline', 'journal', 'habits', 'files', 'graph', 'stats'].map(k => ({ label: Views[k].label, icon: Views[k].icon, hint: Views[k].key, checked: App.view === k, fn: () => App.go(k) })), '-', { label: 'Lixeira', icon: 'trash', fn: () => App.go('trash') }], { right: true });
Actions.topMenu = el => menu(el, [
  { label: 'Desfazer', icon: 'undo', hint: 'Ctrl+Z', fn: () => Hist.undo() }, { label: 'Refazer', icon: 'redo', hint: 'Ctrl+Y', fn: () => Hist.again() }, '-',
  { label: 'Encontrar horário livre / compartilhar disponibilidade', icon: 'users', fn: () => Avail.open() },
  { label: 'Ir para uma data…', icon: 'today', hint: 'I', fn: () => Actions.goto() },
  { label: S.set.side ? 'Ocultar barra lateral' : 'Mostrar barra lateral', icon: 'panel', hint: 'Ctrl+\\', fn: Actions.toggleSide },
  { label: 'Tela cheia', icon: 'grid', fn: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}) },
  { label: 'Imprimir esta visão', icon: 'print', hint: 'Ctrl+P', fn: () => print() }, '-',
  { label: 'Sincronizar agora', icon: 'sync', fn: () => Sync.any() ? Sync.run(true).then(() => toast(Sync.error || Sync.g.error || 'Sincronizado')) : Settings.open('sync') },
  { label: 'Atalhos de teclado', icon: 'cmd', hint: '?', fn: () => Settings.shortcuts() },
  { label: 'Ajustes', icon: 'gear', hint: ',', fn: () => Settings.open() },
], { right: true });
Actions.goto = () => {
  const m = modal({ title: 'Ir para uma data', body: `<input id="gd" type="date" value="${ymd(App.cur)}"><input id="gt" placeholder="ou escreva: amanhã, sexta, 25/12, em 3 semanas" autocomplete="off" autofocus><div class="mfoot"><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="gok">Ir</button></div>` });
  const go = () => { const t = $('#gt', m.el).value.trim(), p = t ? parseQuick(t, null) : null, d = p && p.found && p.start ? (p.scope === 'week' ? weekStartOf(p.start) : pd(p.start)) : pd($('#gd', m.el).value); if (!d) return toast('Não entendi a data'); m.close(); App.go(null, d); };
  $('#gok', m.el).onclick = go; m.el.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
};
Actions.palette = () => Palette.open();
Actions.settings = () => Settings.open(Sync.any() || !S.set.gClient ? '' : 'sync');
Actions.lateOpen = () => { S.set.taskTab = 'late'; App.go('tasks'); };
Actions.holToggle = () => { S.set.holidays = !S.set.holidays; Store.saveSet(); App.render(); };
Actions.calToggle = el => { const id = el.dataset.id; if (S.set.hideCals[id]) delete S.set.hideCals[id]; else S.set.hideCals[id] = 1; Store.saveSet(); App.render(); };

/* Filtro */
Actions.filterMenu = el => {
  const tog = (arr, v) => () => { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); App.render(); Actions.filterMenu($('[data-act=filterMenu]')); };
  menu(el, [{ head: 'Mostrar apenas' }, ...Object.entries(TYPES).map(([k, v]) => ({ label: v + 's', checked: Filter.types.includes(k), fn: tog(Filter.types, k) })),
    { head: 'Prioridade mínima' }, ...[0, 2, 3, 4].map(p => ({ label: p ? PRIO[p] : 'Qualquer', checked: Filter.prio === p, fn: () => { Filter.prio = p; App.render(); } })),
    { head: 'Situação da tarefa' }, { label: 'Qualquer', checked: !Filter.status, fn: () => { Filter.status = ''; App.render(); } }, ...Object.entries(STATUS).map(([k, v]) => ({ label: v, checked: Filter.status === k, fn: () => { Filter.status = k; App.render(); } })),
    { head: 'Exibição' }, { label: 'Mostrar concluídas', checked: S.set.showDone, fn: () => { S.set.showDone = !S.set.showDone; Store.saveSet(); App.render(); } }, { label: 'Mostrar recusados', checked: S.set.showDeclined, fn: () => { S.set.showDeclined = !S.set.showDeclined; Store.saveSet(); App.render(); } },
    '-', { label: 'Limpar filtros', icon: 'x', fn: Actions.clearFilter }], { right: true, checks: true });
};
Actions.clearFilter = () => { Object.assign(Filter, { q: '', tags: [], lists: [], types: [], prio: 0, status: '' }); App.render(); };
Actions.filterDrop = el => { const k = el.dataset.k, v = el.dataset.v; if (Array.isArray(Filter[k])) Filter[k] = Filter[k].filter(x => x !== v); else Filter[k] = k === 'prio' ? 0 : ''; App.render(); };
Actions.tagToggle = el => { const id = el.dataset.id, i = Filter.tags.indexOf(id); i < 0 ? Filter.tags.push(id) : Filter.tags.splice(i, 1); App.render(); };
Actions.listOpen = el => { const id = el.dataset.id; Filter.lists = Filter.lists.includes(id) ? [] : [id]; if (Filter.lists.length && Views[App.view].group === 'cal') { S.set.taskTab = 'all'; return App.go('tasks'); } App.render(); };
Actions.saveView = async () => { const n = await ask('Salvar esta combinação de filtros', '', 'Nome da visão (ex.: Trabalho urgente)'); if (!n) return; Data.put('views', NORM.views({ id: uid(), name: n, view: App.view, f: JSON.parse(JSON.stringify(Filter)) })); App.render(); toast('Visão salva na barra lateral'); };
Actions.viewApply = el => { const v = byId(S.views, el.dataset.id); Object.assign(Filter, { q: '', tags: [], lists: [], types: [], prio: 0, status: '' }, JSON.parse(JSON.stringify(v.f))); App.go(v.view || null); };
Actions.viewDel = el => { Data.del('views', el.dataset.id); App.render(); };

/* ---------- Lixeira ---------- */
Views.trash = {
  label: 'Lixeira', icon: 'trash', key: '', group: 'sys', title: () => 'Lixeira', step() {},
  render(el) {
    const list = S.items.filter(i => i.deleted).sort((a, b) => b.deleted - a.deleted);
    el.innerHTML = `<div class="tv"><div class="tbar"><span class="muted">Itens excluídos ficam aqui por 30 dias.</span><span class="grow"></span>${list.length ? `<button class="btn ghost sm" data-act="trashAll">Restaurar tudo</button><button class="btn ghost sm danger" data-act="trashEmpty">Esvaziar lixeira</button>` : ''}</div>
      <div class="tlist">${list.map(it => `<div class="trow" style="--c:${colorOf(it)}"><span class="ck">${ic(typeIcon(it))}</span><div class="tt"><b>${esc(it.title || '(sem título)')}</b><div class="tm"><span>${esc(whenText(it))}</span><span>excluído ${fmtRel(it.deleted)}</span></div></div><button class="btn ghost sm" data-act="restore" data-id="${it.id}">Restaurar</button><button class="icon sm" data-act="purge" data-id="${it.id}" title="Excluir de vez">${ic('trash')}</button></div>`).join('') || '<p class="empty">A lixeira está vazia.</p>'}</div></div>`;
  },
};
function purge(it) { if (it.gid && it.gcal) { Store.kv('gdel', { list: [] }).list.push({ cal: it.gcal, gid: it.gid }); Store.saveKv('gdel'); } it.files.forEach(Files.remove); S.items.forEach(o => { if (o.parent === it.id || o.links.some(l => l.to === it.id)) { if (o.parent === it.id) o.parent = ''; o.links = o.links.filter(l => l.to !== it.id); Data.put('items', o, true); } }); Data.del('items', it.id); }
Actions.restore = el => { const it = Ops.get(el.dataset.id); it.deleted = 0; Ops.save(it); toast('Restaurado'); };
Actions.purge = async el => { const it = Ops.get(el.dataset.id); if (await confirmBox(`Excluir "${cut(it.title, 40)}" de vez? Não dá para desfazer depois de sincronizar.`, 'Excluir de vez', true)) { purge(it); App.render(); } };
Actions.trashAll = () => { S.items.filter(i => i.deleted).forEach(it => { it.deleted = 0; Data.put('items', it); }); App.render(); };
Actions.trashEmpty = async () => { const l = S.items.filter(i => i.deleted); if (await confirmBox(`Excluir de vez ${count(l.length, 'item', 'itens')} da lixeira?`, 'Esvaziar', true)) { l.forEach(purge); App.render(); } };

/* ---------- Avisos (lembretes) ---------- */
const Notif = {
  async ask() { if (!('Notification' in window)) return toast('Este navegador não mostra notificações'); const p = await Notification.requestPermission(); S.set.notif = p === 'granted'; Store.saveSet(); toast(S.set.notif ? 'Notificações ativadas' : 'Notificações bloqueadas pelo navegador'); },
  show(title, body, tag) {
    if (!S.set.notif || !('Notification' in window) || Notification.permission !== 'granted') return;
    const opt = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(title, opt)).catch(() => {}); else try { new Notification(title, opt); } catch (e) {}
  },
  tick() {
    const now = Date.now(), fired = Store.kv('fired', { m: {} }), sn = Store.kv('snooze', { m: {} });
    let dirty = false;
    const fire = (o, label, k) => {
      fired.m[k] = now; dirty = true; beep('alarm');
      Notif.show(o.it.title || 'Lembrete', label, k);
      toast(`🔔 ${cut(o.it.title, 40)} · ${label}`, { label: 'Adiar 10 min', fn: () => { sn.m[o.it.id + '|' + o.key] = Date.now() + 600000; Store.saveKv('snooze'); } });
    };
    for (const o of occs(new Date(now - 6 * 3600000), new Date(now + 15 * 864e5), { keepDone: true })) {
      if (o.done || o.it.rsvp === 'no') continue;
      const base = o.allDay ? new Date(o.s.getFullYear(), o.s.getMonth(), o.s.getDate(), 9).getTime() : +o.s, rems = o.it.rem.length ? o.it.rem : o.it.type === 'reminder' ? [0] : [];
      for (const r of rems) { const at = base - r * 60000, k = `${o.it.id}|${o.key}|${r}`; if (at <= now && at > now - 15 * 60000 && !fired.m[k]) fire(o, r ? `começa ${o.allDay ? 'hoje' : 'às ' + fmtT(o.s)}` : (o.allDay ? 'hoje' : 'agora, ' + fmtT(o.s)), k); }
    }
    for (const [k, at] of Object.entries(sn.m)) if (at <= now) { delete sn.m[k]; const [id, key] = k.split('|'), o = getOcc(id, key); if (o && !o.done && !o.it.deleted) fire(o, 'lembrete adiado', k + '|s' + at); Store.saveKv('snooze'); }
    for (const k of Object.keys(fired.m)) if (fired.m[k] < now - 3 * 864e5) { delete fired.m[k]; dirty = true; }
    if (dirty) Store.saveKv('fired');
    if (navigator.setAppBadge) { const n = allTasks().filter(it => !tdone(it) && it.status !== 'cancel' && (overdue(it) || (tdate(it) && (it.scope === 'day' || it.scope === 'time') && sameD(tdate(it), today())))).length; n ? navigator.setAppBadge(n).catch(() => {}) : navigator.clearAppBadge().catch(() => {}); }
  },
};

/* ---------- Instalação (PWA) ---------- */
const Inst = { prompt: null };
const canInstall = () => !!Inst.prompt || (/iphone|ipad/i.test(navigator.userAgent) && !navigator.standalone);
addEventListener('beforeinstallprompt', e => { e.preventDefault(); Inst.prompt = e; if ($('#sidebar').innerHTML) App.renderSide(); });
addEventListener('appinstalled', () => { Inst.prompt = null; App.renderSide(); });
Actions.install = async () => { if (Inst.prompt) { Inst.prompt.prompt(); await Inst.prompt.userChoice; Inst.prompt = null; App.renderSide(); } else modal({ title: 'Instalar no iPhone ou iPad', body: '<p>No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. O Alvorada ganha ícone próprio e abre em tela cheia.</p>' }); };

/* ---------- Cliques, teclado e gestos ---------- */
document.addEventListener('click', e => {
  if (App.noClick) return;
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = Actions[el.dataset.act]; if (!fn) return;
  if (el.tagName !== 'INPUT') e.preventDefault();
  fn(el, e);
});
document.addEventListener('contextmenu', e => {
  const it = e.target.closest('.chip[data-id],.ev[data-id],.trow[data-id],.tcard[data-id],.agr[data-id]'), tg = e.target.closest('.stags .tagc');
  if (it) { e.preventDefault(); Actions.itemMenu({ dataset: it.dataset, getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }) }); }
  else if (tg) { e.preventDefault(); Settings.tagMenu(tg); }
});
document.addEventListener('dblclick', e => { const it = e.target.closest('.chip[data-id],.ev[data-id],.trow[data-id],.tcard[data-id],.agr[data-id]'); if (it && !e.target.closest('button')) { const o = getOcc(it.dataset.id, it.dataset.key); if (o) Editor.open(o.it, { key: o.key }); } });
addEventListener('keydown', e => {
  const t = e.target, typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName), k = e.key, mod = e.ctrlKey || e.metaKey;
  if (k === 'Escape') { if (menuEl) return closeMenu(); if (popEl) return closePop(); if (modals.length) return modals[modals.length - 1].close(); if (typing) return t.blur(); if (document.body.classList.contains('side-open')) return Actions.closeSide(); if (filterOn()) return Actions.clearFilter(); return; }
  if (mod && k.toLowerCase() === 'k') { e.preventDefault(); return Palette.open(); }
  if (mod && k === '\\') { e.preventDefault(); return Actions.toggleSide(); }
  if (mod && !typing && k.toLowerCase() === 'z') { e.preventDefault(); return e.shiftKey ? Hist.again() : Hist.undo(); }
  if (mod && !typing && k.toLowerCase() === 'y') { e.preventDefault(); return Hist.again(); }
  if (typing || mod || e.altKey || modals.length) return;
  if (popEl && Pop.id) { if (k.toLowerCase() === 'e') return Actions.popEdit(); if (k === 'Delete' || k === 'Backspace') return Actions.popDel(); if (k === ' ' && Pop.o.it.type !== 'event') { e.preventDefault(); return Ops.toggleDone(Pop.o.it, Pop.o.key); } }
  const K = k.length === 1 ? k.toUpperCase() : k;
  if (K === 'H') return Actions.today();
  if (K === 'ArrowLeft') return Actions.step({ dataset: { n: -1 } });
  if (K === 'ArrowRight') return Actions.step({ dataset: { n: 1 } });
  if (K === 'C') { e.preventDefault(); return Actions.create($('[data-act=create]')); }
  if (K === '/') { e.preventDefault(); return Palette.open(); }
  if (K === '?') return Settings.shortcuts();
  if (K === ',') return Settings.open();
  if (K === 'I') { e.preventDefault(); return Actions.goto(); }
  if (K === 'P') return Actions.togglePanel();
  if (K === 'F') return Actions.filterMenu($('[data-act=filterMenu]'));
  if (K === 'O') { e.preventDefault(); return $('#sideq') && (document.body.classList.remove('no-side'), $('#sideq').focus()); }
  if (/^[2-9]$/.test(K)) { S.set.nDays = +K; Store.saveSet(); return App.go('ndays'); }
  const v = Object.keys(Views).find(n => Views[n].key === K); if (v) App.go(v);
});
// deslizar para os lados troca o período (celular)
let sw = null;
addEventListener('touchstart', e => { const t = e.touches[0]; sw = e.touches.length === 1 && e.target.closest('#view') && Views[App.view].group === 'cal' && !popEl && !modals.length ? { x: t.clientX, y: t.clientY, t: Date.now() } : null; }, { passive: true });
addEventListener('touchend', e => { if (!sw) return; const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y; if (Math.abs(dx) > 70 && Math.abs(dy) < 45 && Date.now() - sw.t < 600) Actions.step({ dataset: { n: dx < 0 ? 1 : -1 } }); sw = null; }, { passive: true });
addEventListener('resize', debounce(() => { if (!modals.length && !popEl && !(document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) && !(document.activeElement && document.activeElement.isContentEditable)) App.render(); }, 250));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* ---------- Início ---------- */
(async function boot() {
  await Store.load();
  applyTheme();
  // limpa a lixeira com mais de 30 dias
  Hist.mute = true; S.items.filter(i => i.deleted && i.deleted < Date.now() - 30 * 864e5).forEach(purge); Hist.mute = false;
  const h = /^#\/(\w+)\/([\w-]+)/.exec(location.hash), qs = new URLSearchParams(location.search);
  App.view = Views[S.set.startView] ? S.set.startView : Views[S.set.view] && S.set.view !== 'trash' ? S.set.view : 'week';
  App.cur = today(); App.noteKey = ymd(App.cur);
  if (h && Views[h[1]]) { App.view = h[1]; if (h[1] === 'journal') { App.noteKey = h[2]; const d = keyDate(h[2]); if (d && keyKind(h[2]) !== 'page') App.cur = sod(d); if (keyKind(h[2]) === 'page' && !noteOf(h[2])) App.noteKey = ymd(App.cur); } else if (pd(h[2])) App.cur = sod(pd(h[2])); }
  if (qs.get('view') && Views[qs.get('view')]) App.view = qs.get('view');
  if (innerWidth < 640 && !h && !localStorage.getItem('alvorada-seen')) App.view = 'agenda';
  localStorage.setItem('alvorada-seen', '1');
  App.render();
  if (qs.get('new')) setTimeout(() => Actions.createMenu($('[data-act=createMenu]')), 300);
  await Sync.init();
  App.render(true);
  Notif.tick();
  setInterval(() => { Notif.tick(); App.renderNext(); const n = $('.tg .now'); if (n) { const d = new Date(); n.style.top = (d.getHours() * 60 + d.getMinutes()) / 60 * hourH() + 'px'; } App.renderFoot(); }, 30000);
  // virada do dia: redesenha para o "hoje" acompanhar
  let day = ymd(new Date()); setInterval(() => { if (ymd(new Date()) !== day) { day = ymd(new Date()); App.render(true); } }, 60000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  // resumo do dia, uma vez por dia
  const sum = Store.kv('summary', { day: '' });
  if (sum.day !== day) { sum.day = day; Store.saveKv('summary'); const l = occsOn(today()), ev = l.filter(o => o.it.type === 'event').length, tk = l.length - ev, late = S.items.filter(i => !i.deleted && overdue(i)).length; if (l.length || late) toast(`Hoje: ${count(ev, 'evento', 'eventos')}, ${count(tk, 'tarefa', 'tarefas')}${late ? ` e ${count(late, 'atrasada', 'atrasadas')}` : ''}`, { label: 'Ver agenda', fn: () => App.go('agenda', today()) }); }
})();
