'use strict';
/* Alvorada — utilitários, ícones, armazenamento local (IndexedDB) e histórico de desfazer */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const cut = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, Math.max(1, n - 1)).trimEnd() + '…' : s; };
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const byId = (arr, id) => arr.find(x => x.id === id);
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const plain = html => { const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent || ''; };

const LOGO = '<svg viewBox="0 0 512 512"><rect width="512" height="512" rx="116" fill="#4f46e5"/><rect x="96" y="132" width="320" height="284" rx="44" fill="#fff"/><path d="M96 176a44 44 0 0 1 44-44h232a44 44 0 0 1 44 44v36H96z" fill="#c7d2fe"/><path d="M176 100v64M336 100v64" stroke="#fff" stroke-width="30" stroke-linecap="round"/><path d="M184 352a72 72 0 0 1 144 0z" fill="#f59e0b"/><path d="M256 244v-4M176 276l-3-3M336 276l3-3" stroke="#f59e0b" stroke-width="20" stroke-linecap="round"/><path d="M150 356h212" stroke="#4f46e5" stroke-width="18" stroke-linecap="round"/></svg>';

const IC = {
  plus: 'M12 5v14M5 12h14', more: 'M5 12h.01M12 12h.01M19 12h.01', trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4', menu: 'M4 6h16M4 12h16M4 18h16',
  gear: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4', x: 'M6 6l12 12M18 6L6 18',
  undo: 'M8 5L4 9l4 4M4 9h10a6 6 0 0 1 0 12h-3', redo: 'M16 5l4 4-4 4M20 9H10a6 6 0 0 0 0 12h3',
  dl: 'M12 4v11M7 11l5 5 5-5M5 20h14', up: 'M12 16V5M7 9l5-5 5 5M5 20h14', copy: 'M8 8h11v12H8zM5 16V4h10',
  sync: 'M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5',
  back: 'M15 5l-7 7 7 7', fwd: 'M9 5l7 7-7 7', down: 'M5 9l7 7 7-7', check: 'M4 12l5 5L20 6',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  bell: 'M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4', tag: 'M4 4h8l8 8-8 8-8-8zM8.5 8.5h.01',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01', flag: 'M5 21V4M5 4h13l-3 5 3 5H5',
  link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
  file: 'M6 3h9l4 4v14H6zM14 3v5h5', clip: 'M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7',
  pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v8', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4', sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  board: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v12h-4z', graph: 'M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7.5 6.5l8.5.5M7 7l4 10M17 9l-4 8',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3', repeat: 'M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4',
  loc: 'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.800 7 11 7 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', video: 'M4 7h11v10H4zM15 10l5-3v10l-5-3',
  users: 'M9 11a3.5 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM2.500 20a6.500 6.500 0 0 1 13 0M16 4.500a3.500 3.500 0 0 1 0 6.500M18 14a6 6 0 0 1 3.500 6',
  note: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z', today: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M12 14h.01', bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  inbox: 'M4 13l3-8h10l3 8v6H4zM4 13h5l1 2h4l1-2h5', play: 'M7 5l12 7-12 7z', mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
  img: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01', print: 'M7 8V4h10v4M7 17H4V9h16v8h-3M7 14h10v6H7z', cmd: 'M4 7l5 5-5 5M11 18h9',
  panel: 'M4 5h16v14H4zM15 5v14', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', gantt: 'M4 6h8M8 12h10M6 18h7M3 3v18',
  heart: 'M12 20s-7-4.400-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.600-7 10-7 10z', book: 'M12 6c-2-1.600-5-2-8-1v13c3-1 6-.6 8 1 2-1.600 5-2 8-1V5c-3-1-6-.6-8 1zM12 6v13',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
  share: 'M12 15V4M8 8l4-4 4 4M5 13v7h14v-7', circle: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', folder: 'M3 6h7l2 2h9v11H3z',
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24"><path d="${IC[n] || ''}"/></svg>`;

const PALETTE = [['Tomate', '#d50000'], ['Flamingo', '#e67c73'], ['Tangerina', '#f4511e'], ['Âmbar', '#ef6c00'], ['Banana', '#e4b400'], ['Sálvia', '#33b679'], ['Manjericão', '#0b8043'], ['Turquesa', '#009688'],
  ['Pavão', '#039be5'], ['Céu', '#4285f4'], ['Mirtilo', '#3f51b5'], ['Lavanda', '#7986cb'], ['Uva', '#8e24aa'], ['Rosa', '#d81b60'], ['Cacau', '#795548'], ['Grafite', '#616161']];
const PRIO = ['Sem prioridade', 'Baixa', 'Média', 'Alta', 'Urgente'];
const PRIO_COLOR = ['', '#4285f4', '#e4b400', '#f4511e', '#d50000'];
const STATUS = { todo: 'A fazer', doing: 'Em andamento', wait: 'Aguardando', done: 'Concluída', cancel: 'Cancelada' };
const TYPES = { event: 'Evento', task: 'Tarefa', reminder: 'Lembrete' };
const KINDS = { '': 'Padrão', focus: 'Tempo de foco', ooo: 'Fora do escritório', work: 'Local de trabalho', birthday: 'Aniversário', travel: 'Viagem' };
const LINKS = { blocks: ['bloqueia', 'bloqueada por'], related: ['relacionada a', 'relacionada a'], parent: ['é subtarefa de', 'tem a subtarefa'], next: ['vem antes de', 'vem depois de'], dup: ['duplica', 'duplicada por'], ref: ['menciona', 'mencionada em'] };
const MOODS = ['😀', '🙂', '😐', '😕', '😢', '😡', '😴', '🤒', '🤩', '🧘'];

/* Ações (data-act) e visões registradas pelos outros arquivos */
const Actions = {};
const Views = {};

const DB = (() => {
  const STORES = ['calendars', 'items', 'notes', 'tags', 'lists', 'views', 'templates', 'habits', 'filemeta', 'files', 'kv'];
  const SYNCED = ['calendars', 'items', 'notes', 'tags', 'lists', 'views', 'templates', 'habits', 'filemeta'];
  let db = null, mem = null, tomb = { id: 'tombstones', items: {} };
  const useMem = () => { mem = {}; STORES.forEach(s => mem[s] = new Map()); };
  const run = (store, mode, fn) => new Promise((res, rej) => {
    const t = db.transaction(store, mode), rq = fn(t.objectStore(store));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = t.onabort = () => rej(t.error);
  });
  return {
    STORES, SYNCED,
    onChange: () => {},
    tomb: () => tomb.items,
    setTomb: t => { tomb = t; },
    saveTomb: () => DB.put('kv', tomb),
    persistent: () => !mem,
    open: () => new Promise(res => {
      try {
        const rq = indexedDB.open('alvorada', 1);
        rq.onupgradeneeded = () => STORES.forEach(s => rq.result.objectStoreNames.contains(s) || rq.result.createObjectStore(s, { keyPath: 'id' }));
        rq.onsuccess = () => { db = rq.result; res(); };
        rq.onerror = rq.onblocked = () => { useMem(); res(); };
      } catch (e) { useMem(); res(); }
    }),
    all: s => mem ? Promise.resolve([...mem[s].values()]) : run(s, 'readonly', o => o.getAll()),
    get: (s, id) => mem ? Promise.resolve(mem[s].get(id)) : run(s, 'readonly', o => o.get(id)),
    keys: s => mem ? Promise.resolve([...mem[s].keys()]) : run(s, 'readonly', o => o.getAllKeys()),
    // raw = gravação vinda da sincronização: não carimba a data de modificação nem dispara novo envio
    put(s, v, raw) {
      if (!raw && SYNCED.includes(s)) { v.mod = Date.now(); DB.onChange(); }
      return mem ? Promise.resolve(mem[s].set(v.id, v)) : run(s, 'readwrite', o => o.put(v)).catch(e => { console.error(e); toast('Não foi possível salvar: armazenamento cheio?'); });
    },
    del(s, id, raw) {
      if (!raw && SYNCED.includes(s)) { tomb.items[s + ':' + id] = Date.now(); DB.saveTomb(); DB.onChange(); }
      return mem ? Promise.resolve(mem[s].delete(id)) : run(s, 'readwrite', o => o.delete(id));
    },
    clear: s => mem ? Promise.resolve(mem[s].clear()) : run(s, 'readwrite', o => o.clear()),
  };
})();

/* Estado em memória */
const S = {
  calendars: [], items: [], notes: [], tags: [], lists: [], views: [], templates: [], habits: [], filemeta: [],
  set: {
    id: 'settings', theme: 'auto', accent: '#4f46e5', view: 'week', weekStart: 0, weekends: true, weekNums: false, h24: true,
    workStart: 8, workEnd: 18, workDays: [1, 2, 3, 4, 5], defDur: 60, defRem: [10], defCal: '', nDays: 4, density: 'normal', slot: 30,
    dimPast: true, showDone: true, showDeclined: true, holidays: true, moon: false, tz2: '', clocks: [], sound: true, notif: false,
    side: true, panel: false, taskTab: 'today', taskGroup: 'date', taskSort: 'smart', kanbanBy: 'status', font: 'sans', dailyTpl: '',
    gClient: '', gCals: {}, gDrive: true, gCal: true, hideCals: {}, hideHol: false, startView: 'last', autoDone: false, shiftDeps: true, me: '',
  },
};

/* Fábricas e normalização (dados vindos de fora: sincronização, backup, Google) */
const str = v => typeof v === 'string' ? v : '';
const arr = v => Array.isArray(v) ? v : [];
function normItem(it) {
  it.id = str(it.id) || uid();
  it.type = TYPES[it.type] ? it.type : 'event';
  it.title = str(it.title); it.cal = str(it.cal); it.list = str(it.list);
  it.scope = ['time', 'day', 'week', 'month', 'year', 'none'].includes(it.scope) ? it.scope : (str(it.start).includes('T') ? 'time' : it.start ? 'day' : 'none');
  it.start = str(it.start); it.end = str(it.end); it.due = str(it.due); it.tz = str(it.tz);
  it.rrule = str(it.rrule); it.exdates = arr(it.exdates).filter(x => typeof x === 'string');
  it.doneOn = it.doneOn && typeof it.doneOn === 'object' ? it.doneOn : {};
  it.loc = str(it.loc); it.url = str(it.url); it.desc = str(it.desc); it.color = /^#[0-9a-f]{6}$/i.test(it.color) ? it.color : '';
  it.tags = arr(it.tags).filter(x => typeof x === 'string'); it.prio = clamp(parseInt(it.prio) || 0, 0, 4);
  it.status = STATUS[it.status] ? it.status : 'todo'; it.doneAt = +it.doneAt || 0; it.progress = clamp(parseInt(it.progress) || 0, 0, 100);
  it.est = Math.max(0, parseInt(it.est) || 0); it.spent = Math.max(0, parseInt(it.spent) || 0);
  it.check = arr(it.check).filter(c => c && typeof c === 'object').map(c => ({ id: str(c.id) || uid(), text: str(c.text), done: !!c.done }));
  it.rem = arr(it.rem).map(Number).filter(n => isFinite(n) && n >= 0);
  it.guests = arr(it.guests).filter(g => g && typeof g === 'object').map(g => ({ email: str(g.email), name: str(g.name), rsvp: ['yes', 'no', 'maybe', ''].includes(g.rsvp) ? g.rsvp : '', self: !!g.self }));
  it.links = arr(it.links).filter(l => l && LINKS[l.type] && typeof l.to === 'string').map(l => ({ type: l.type, to: l.to }));
  it.parent = str(it.parent); it.files = arr(it.files).filter(x => typeof x === 'string');
  it.vis = ['', 'public', 'private'].includes(it.vis) ? it.vis : ''; it.busy = it.busy !== false; it.kind = KINDS[it.kind] !== undefined ? it.kind : '';
  it.pin = !!it.pin; it.rsvp = ['yes', 'no', 'maybe', ''].includes(it.rsvp) ? it.rsvp : '';
  it.gid = str(it.gid); it.gcal = str(it.gcal); it.gmod = +it.gmod || 0;
  it.created = +it.created || Date.now(); it.updated = +it.updated || it.created; it.deleted = +it.deleted || 0;
  return it;
}
const newItem = (type, o) => normItem(Object.assign({ type, cal: defCal(), rem: type === 'task' ? [] : S.set.defRem.slice() }, o));
const defCal = () => (byId(S.calendars, S.set.defCal) || S.calendars.find(c => !c.ro) || {}).id || '';
const NORM = {
  items: normItem,
  calendars: c => Object.assign(c, { id: str(c.id) || uid(), name: str(c.name) || 'Calendário', color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#039be5', gid: str(c.gid), ro: !!c.ro, url: str(c.url), order: +c.order || 0 }),
  notes: n => Object.assign(n, { id: str(n.id), html: str(n.html), mood: str(n.mood), sticker: str(n.sticker), color: str(n.color), files: arr(n.files), title: str(n.title), page: !!n.page, created: +n.created || Date.now() }),
  tags: t => Object.assign(t, { id: str(t.id) || uid(), name: str(t.name), color: str(t.color) || '#616161' }),
  lists: l => Object.assign(l, { id: str(l.id) || uid(), name: str(l.name), color: str(l.color) || '#3f51b5', icon: str(l.icon), archived: !!l.archived }),
  views: v => Object.assign(v, { id: str(v.id) || uid(), name: str(v.name), f: v.f && typeof v.f === 'object' ? v.f : {}, view: str(v.view) }),
  templates: t => Object.assign(t, { id: str(t.id) || uid(), name: str(t.name), item: t.item && typeof t.item === 'object' ? t.item : {} }),
  habits: h => Object.assign(h, { id: str(h.id) || uid(), name: str(h.name), color: str(h.color) || '#33b679', icon: str(h.icon), days: h.days && typeof h.days === 'object' ? h.days : {}, goal: clamp(parseInt(h.goal) || 7, 1, 7), archived: !!h.archived }),
  filemeta: f => Object.assign(f, { id: str(f.id), name: str(f.name) || 'arquivo', type: str(f.type), size: +f.size || 0, owner: str(f.owner), created: +f.created || Date.now() }),
};

/* Histórico: cada gravação guarda o estado anterior do registro, então Ctrl+Z desfaz qualquer alteração de dados. */
const Hist = {
  shadow: new Map(), stack: [], redo: [], batch: null, mute: false,
  note(store, id, json) {
    const k = store + ':' + id, before = Hist.shadow.has(k) ? Hist.shadow.get(k) : null;
    json === null ? Hist.shadow.delete(k) : Hist.shadow.set(k, json);
    if (Hist.mute || before === json) return;
    if (!Hist.batch) {
      const last = Hist.stack[Hist.stack.length - 1];
      // digitação contínua no mesmo registro vira uma entrada só
      if (last && last.ops.length === 1 && last.ops[0].k === k && Date.now() - last.at < 2500) { last.ops[0].after = json; last.at = Date.now(); return; }
      Hist.batch = { at: Date.now(), ops: [] };
      Hist.stack.push(Hist.batch); if (Hist.stack.length > 80) Hist.stack.shift();
      Hist.redo = [];
      setTimeout(() => { Hist.batch = null; }, 0);
    }
    const op = Hist.batch.ops.find(o => o.k === k);
    if (op) op.after = json; else Hist.batch.ops.push({ k, store, id, before, after: json });
  },
  apply(ops, key) {
    Hist.mute = true;
    for (const o of ops) {
      const json = o[key];
      if (json === null) Data.del(o.store, o.id); else Data.put(o.store, NORM[o.store](JSON.parse(json)), true);
    }
    Hist.mute = false;
  },
  undo() { const h = Hist.stack.pop(); if (!h) return toast('Nada para desfazer'); Hist.apply(h.ops.slice().reverse(), 'before'); Hist.redo.push(h); App.render(); toast('Desfeito'); },
  again() { const h = Hist.redo.pop(); if (!h) return toast('Nada para refazer'); Hist.apply(h.ops, 'after'); Hist.stack.push(h); App.render(); toast('Refeito'); },
};

/* Toda alteração de dados passa por aqui. */
const Data = {
  put(store, rec, keepUpdated) {
    const list = S[store], i = list.findIndex(x => x.id === rec.id);
    if (i < 0) list.push(rec); else list[i] = rec;
    if (!keepUpdated && 'updated' in rec) rec.updated = Date.now();
    delete rec.seed;
    DB.put(store, rec);
    Hist.note(store, rec.id, JSON.stringify(rec));
    return rec;
  },
  del(store, id) {
    const list = S[store], i = list.findIndex(x => x.id === id);
    if (i >= 0) list.splice(i, 1);
    DB.del(store, id);
    Hist.note(store, id, null);
  },
  // gravação vinda de outro aparelho
  raw(store, rec) {
    const list = S[store], i = list.findIndex(x => x.id === rec.id);
    if (i < 0) list.push(rec); else list[i] = rec;
    Hist.shadow.set(store + ':' + rec.id, JSON.stringify(rec));
    return DB.put(store, rec, true);
  },
  rawDel(store, id) {
    const list = S[store], i = list.findIndex(x => x.id === id);
    if (i >= 0) list.splice(i, 1);
    Hist.shadow.delete(store + ':' + id);
    return DB.del(store, id, true);
  },
};

const Store = {
  async load() {
    await DB.open();
    for (const s of DB.SYNCED) {
      S[s] = (await DB.all(s)).map(NORM[s]);
      S[s].forEach(r => Hist.shadow.set(s + ':' + r.id, JSON.stringify(r)));
    }
    const kv = await DB.all('kv');
    const st = kv.find(k => k.id === 'settings');
    if (st) Object.assign(S.set, st);
    const tb = kv.find(k => k.id === 'tombstones');
    if (tb) DB.setTomb(tb);
    S.kv = {}; kv.forEach(k => S.kv[k.id] = k);
    if (!st && !S.calendars.length) Store.seed();
    if (!S.calendars.length) Data.put('calendars', NORM.calendars({ id: 'pessoal', name: 'Pessoal', color: '#039be5' }));
    Hist.stack = [];
  },
  // seed: true marca os exemplos, descartados se a primeira sincronização já encontrar dados
  seed() {
    const mk = (s, o) => { o.seed = true; DB.put(s, o, true); S[s].push(o); Hist.shadow.set(s + ':' + o.id, JSON.stringify(o)); return o; };
    mk('calendars', NORM.calendars({ id: 'pessoal', name: 'Pessoal', color: '#039be5', order: 0 }));
    mk('calendars', NORM.calendars({ id: 'trabalho', name: 'Trabalho', color: '#33b679', order: 1 }));
    mk('lists', NORM.lists({ id: 'entrada', name: 'Entrada', color: '#616161', icon: '📥' }));
    mk('tags', NORM.tags({ id: 'importante', name: 'importante', color: '#d50000' }));
    const t = new Date(), d = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    mk('items', normItem({ id: 'ex1', type: 'task', title: 'Conhecer o Alvorada: clique para abrir', cal: 'pessoal', scope: 'day', start: d, prio: 2, desc: 'Experimente: arraste na grade para criar um evento, pressione <b>C</b> para criar, <b>Ctrl+K</b> para a paleta de comandos e <b>?</b> para ver os atalhos.', check: [{ text: 'Criar um evento arrastando na grade' }, { text: 'Abrir o Diário e anotar o dia' }, { text: 'Ligar a sincronização em Ajustes' }], links: [{ type: 'next', to: 'ex2' }] }));
    mk('items', normItem({ id: 'ex2', type: 'task', title: 'Depois: organizar etiquetas e listas', cal: 'pessoal', scope: 'day', start: d }));
    mk('items', normItem({ id: 'ex3', type: 'event', title: 'Planejamento da semana', cal: 'trabalho', scope: 'time', start: d + 'T09:00', end: d + 'T10:00', rrule: 'FREQ=WEEKLY', tags: ['importante'] }));
  },
  saveSet: () => DB.put('kv', S.set),
  kv: (id, def) => (S.kv[id] || (S.kv[id] = Object.assign({ id }, def))),
  saveKv: id => DB.put('kv', S.kv[id]),
};
