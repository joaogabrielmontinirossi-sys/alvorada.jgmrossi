'use strict';
/* Alvorada — sincronização.
   1) Pasta (só no programa de Windows): grava alvorada-sync.json numa pasta do Google Drive para computador.
   2) Conta Google (Windows, site e celular): guarda o mesmo arquivo na área do app no Google Drive.
   3) Google Agenda: eventos nos dois sentidos pela API do Calendar.
   Em todos os casos a mescla é por registro: vale a versão mais recente, e as exclusões são propagadas. */

const GAPI = 'https://www.googleapis.com/';
const Sync = {
  avail: false, on: false, folder: null, detected: null, drives: [], busy: false, again: false, last: 0, error: '',
  g: { token: '', exp: 0, busy: false, last: 0, error: '', lastCal: 0, files: null },

  api: (path, opt = {}) => fetch('/api/' + path, Object.assign({}, opt, { headers: Object.assign({ 'X-Alvorada': '1' }, opt.headers) })),
  async init() {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) try { const r = await Sync.api('sync/info'); if (r.ok && (r.headers.get('content-type') || '').includes('json')) { Sync.avail = true; Sync.info(await r.json()); } } catch (e) {}
    try { const t = JSON.parse(localStorage.getItem('alvorada-g') || 'null'); if (t && t.exp > Date.now() + 60000) { Sync.g.token = t.token; Sync.g.exp = t.exp; } } catch (e) {}
    DB.onChange = () => Sync.soon();
    await Sync.run(true);
    setInterval(() => { if (!document.hidden) Sync.run(); }, 20000);
    addEventListener('focus', () => Sync.run());
    addEventListener('online', () => Sync.run());
    Sync.subs();
    setInterval(Sync.subs, 6 * 3600000);
  },
  info(i) { Sync.on = !!i.enabled; Sync.folder = i.folder; Sync.detected = i.detected; Sync.drives = i.drives || []; },
  soon: debounce(() => Sync.run(true), 1500),
  filesSoon: debounce(() => Sync.run(true), 800),
  gOn: () => !!(S.set.gClient && Sync.g.token && Sync.g.exp > Date.now()),
  any: () => Sync.on || Sync.gOn(),
  status() {
    if (!Sync.any()) return S.set.gClient && !Sync.gOn() && S.set.gWas ? 'Reconectar Google' : 'Ajustes';
    const err = Sync.error || Sync.g.error, last = Math.max(Sync.last, Sync.g.last);
    return err ? 'Falha na sincronização' : last ? 'Sincronizado ' + fmtRel(last) : 'Sincronizando…';
  },

  payload() {
    const stores = {};
    DB.SYNCED.forEach(s => stores[s] = S[s].map(r => { if (!r.seed) return r; const c = Object.assign({}, r); delete c.seed; return c; }));
    return { app: 'alvorada', v: 1, at: Date.now(), stores, tomb: DB.tomb() };
  },
  // impressão digital do conteúdo, para só regravar quando há diferença
  print(p) { return DB.SYNCED.map(s => { const l = p.stores[s] || []; return l.length + ':' + l.reduce((n, r) => n + (r.mod || 0) % 1e9, 0); }).join('|') + '|' + Object.keys(p.tomb || {}).length; },
  async merge(r) {
    if (!r || r.app !== 'alvorada' || !r.stores) return false;
    let changed = false, tch = false;
    const tomb = DB.tomb(), rt = r.tomb || {};
    Hist.mute = true;
    if (DB.SYNCED.some(s => (r.stores[s] || []).length)) for (const s of DB.SYNCED) for (const rec of S[s].slice()) if (rec.seed) { await Data.rawDel(s, rec.id); changed = true; }
    for (const s of DB.SYNCED) for (const rec of r.stores[s] || []) {
      if (!rec || typeof rec !== 'object' || !rec.id) continue;
      if ((tomb[s + ':' + rec.id] || 0) >= (rec.mod || 0) && tomb[s + ':' + rec.id]) continue;
      const loc = byId(S[s], rec.id);
      if (loc && (rec.mod || 0) <= (loc.mod || 0)) continue;
      const n = NORM[s](rec);
      if (s === 'items') n.desc = clean(n.desc); else if (s === 'notes') n.html = clean(n.html);
      await Data.raw(s, n); changed = true;
    }
    for (const [k, ts] of Object.entries(rt)) {
      if ((tomb[k] || 0) < ts) { tomb[k] = ts; tch = true; }
      const i = k.indexOf(':'), s = k.slice(0, i), id = k.slice(i + 1), loc = DB.SYNCED.includes(s) && byId(S[s], id);
      if (loc && (loc.mod || 0) <= ts) { await Data.rawDel(s, id); if (s === 'filemeta') DB.del('files', id); changed = true; }
    }
    Hist.mute = false;
    if (tch) DB.saveTomb();
    return changed;
  },

  async run(force) {
    if (Sync.busy) { Sync.again = true; return; }
    if (!Sync.any()) return;
    Sync.busy = true;
    let changed = false;
    if (Sync.on) { try { changed = await Sync.folderSync() || changed; Sync.error = ''; Sync.last = Date.now(); } catch (e) { console.warn(e); Sync.error = 'A pasta de sincronização não está acessível.'; } }
    if (Sync.gOn() && navigator.onLine !== false) {
      try {
        if (S.set.gDrive) changed = await Sync.driveSync() || changed;
        if (S.set.gCal && (force || Date.now() - Sync.g.lastCal > 55000)) { changed = await Sync.calSync() || changed; Sync.g.lastCal = Date.now(); }
        Sync.g.error = ''; Sync.g.last = Date.now();
      } catch (e) { console.warn(e); Sync.g.error = e.message || 'Falha ao falar com o Google.'; }
    }
    Sync.busy = false;
    if (changed) App.render(true); else App.renderFoot();
    if (Sync.again) { Sync.again = false; Sync.soon(); }
  },

  /* ---------- 1) Pasta ---------- */
  async folderSync() {
    const r = await Sync.api('sync');
    if (r.status === 409) { Sync.on = false; return false; }
    const remote = r.status === 200 ? await r.json().catch(() => null) : null;
    const changed = remote ? await Sync.merge(remote) : false, local = Sync.payload();
    if (!remote || Sync.print(remote) !== Sync.print(local)) { const w = await Sync.api('sync', { method: 'POST', body: JSON.stringify(local) }); if (!w.ok) throw new Error('gravação'); }
    const up = Store.kv('upl', { f: {}, g: {} });
    let dirty = false;
    for (const f of S.filemeta) {
      if (up.f[f.id]) continue;
      const rec = await DB.get('files', f.id); if (!rec || !rec.blob) continue;
      const w = await Sync.api('file/' + f.id, { method: 'POST', body: rec.blob }); if (w.ok) { up.f[f.id] = 1; dirty = true; }
    }
    if (dirty) Store.saveKv('upl');
    return changed;
  },
  async fetchFile(id) {
    if (Sync.on) { try { const r = await Sync.api('file/' + id); if (r.status === 200) return await r.blob(); } catch (e) {} }
    if (Sync.gOn() && S.set.gDrive) { try { const fs = await Sync.driveFiles(), fid = fs['f-' + id]; if (fid) { const r = await Sync.gfetch(`drive/v3/files/${fid}?alt=media`); return await r.blob(); } } catch (e) { console.warn(e); } }
    return null;
  },
  async config(v) { const r = await Sync.api(v === 'choose' ? 'sync/choose' : 'sync/config', { method: 'POST', body: v === 'choose' ? '' : v }); Sync.info(await r.json()); Sync.error = ''; Sync.last = 0; await Sync.run(true); },

  /* ---------- Conta Google ---------- */
  scopes: () => [S.set.gDrive && 'https://www.googleapis.com/auth/drive.appdata', S.set.gCal && 'https://www.googleapis.com/auth/calendar'].filter(Boolean).join(' '),
  gis: () => Sync._gis || (Sync._gis = new Promise((res, rej) => { if (window.google && google.accounts) return res(); const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = res; s.onerror = () => { Sync._gis = null; rej(new Error('Sem acesso ao Google. Verifique a internet.')); }; document.head.appendChild(s); })),
  // Abre a janela do Google. Precisa partir de um clique do usuário (os navegadores bloqueiam janelas espontâneas).
  async connect() {
    if (!S.set.gClient) throw new Error('Informe o ID do cliente OAuth.');
    await Sync.gis();
    const tok = await new Promise((res, rej) => {
      const c = google.accounts.oauth2.initTokenClient({ client_id: S.set.gClient.trim(), scope: Sync.scopes(), callback: r => r.error ? rej(new Error(r.error_description || r.error)) : res(r), error_callback: e => rej(new Error(e.type === 'popup_closed' ? 'A janela do Google foi fechada.' : e.type === 'popup_failed_to_open' ? 'O navegador bloqueou a janela do Google.' : (e.message || 'Falha na autorização.'))) });
      c.requestAccessToken({ prompt: S.set.gWas ? '' : 'consent' });
    });
    Sync.g.token = tok.access_token; Sync.g.exp = Date.now() + (tok.expires_in - 90) * 1000; Sync.g.error = ''; Sync.g.files = null;
    localStorage.setItem('alvorada-g', JSON.stringify({ token: Sync.g.token, exp: Sync.g.exp }));
    S.set.gWas = true; Store.saveSet();
    await Sync.run(true);
  },
  disconnect() {
    try { if (window.google && Sync.g.token) google.accounts.oauth2.revoke(Sync.g.token, () => {}); } catch (e) {}
    Sync.g.token = ''; Sync.g.exp = 0; localStorage.removeItem('alvorada-g'); S.set.gWas = false; Store.saveSet();
  },
  async gfetch(path, opt = {}) {
    const r = await fetch(path.startsWith('http') ? path : GAPI + path, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + Sync.g.token }, opt.headers) }));
    if (r.status === 401) { Sync.g.token = ''; localStorage.removeItem('alvorada-g'); throw new Error('A sessão do Google expirou. Clique em “Reconectar”.'); }
    if (!r.ok && r.status !== 404 && r.status !== 410) { let msg = 'Google respondeu ' + r.status; try { msg = (await r.json()).error.message || msg; } catch (e) {} const err = new Error(msg); err.status = r.status; throw err; }
    return r;
  },

  /* ---------- 2) Google Drive (área de dados do app) ---------- */
  async driveFiles() {
    if (Sync.g.files) return Sync.g.files;
    const out = {}; let page = '';
    do { const j = await (await Sync.gfetch(`drive/v3/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name)${page ? '&pageToken=' + page : ''}`)).json(); (j.files || []).forEach(f => out[f.name] = f.id); page = j.nextPageToken || ''; } while (page);
    return Sync.g.files = out;
  },
  async driveUpload(name, blob, type) {
    const fs = await Sync.driveFiles();
    if (fs[name]) { await Sync.gfetch(`upload/drive/v3/files/${fs[name]}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': type }, body: blob }); return; }
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name, parents: ['appDataFolder'] })], { type: 'application/json' }));
    form.append('file', new Blob([blob], { type }));
    const j = await (await Sync.gfetch('upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: form })).json();
    fs[name] = j.id;
  },
  async driveSync() {
    Sync.g.files = null;
    const fs = await Sync.driveFiles();
    let remote = null;
    if (fs['alvorada-sync.json']) { const r = await Sync.gfetch(`drive/v3/files/${fs['alvorada-sync.json']}?alt=media`); if (r.ok) remote = await r.json().catch(() => null); }
    const changed = remote ? await Sync.merge(remote) : false, local = Sync.payload();
    if (!remote || Sync.print(remote) !== Sync.print(local)) await Sync.driveUpload('alvorada-sync.json', JSON.stringify(local), 'application/json');
    for (const f of S.filemeta) {
      if (fs['f-' + f.id]) continue;
      const rec = await DB.get('files', f.id); if (!rec || !rec.blob) continue;
      await Sync.driveUpload('f-' + f.id, rec.blob, f.type || 'application/octet-stream');
    }
    return changed;
  },

  /* ---------- 3) Google Agenda ---------- */
  GCOLOR: { 1: '#7986cb', 2: '#33b679', 3: '#8e24aa', 4: '#e67c73', 5: '#e4b400', 6: '#f4511e', 7: '#039be5', 8: '#616161', 9: '#3f51b5', 10: '#0b8043', 11: '#d50000' },
  GRSVP: { accepted: 'yes', declined: 'no', tentative: 'maybe', needsAction: '' },
  GKIND: { focusTime: 'focus', outOfOffice: 'ooo', workingLocation: 'work', birthday: 'birthday' },
  toG(it) {
    const day = it.scope === 'day', sp = span(it), tz = localTz() || 'UTC', dt = d => ({ dateTime: iso(d) + ':00', timeZone: tz });
    const g = {
      summary: it.title, description: it.desc, location: it.loc,
      start: day ? { date: ymd(sp.s) } : dt(sp.s), end: day ? { date: ymd(sp.e) } : dt(sp.e),
      transparency: it.busy ? 'opaque' : 'transparent', visibility: it.vis || 'default',
      reminders: { useDefault: false, overrides: [...new Set(it.rem)].slice(0, 5).map(m => ({ method: 'popup', minutes: Math.min(m, 40320) })) },
      attendees: it.guests.filter(x => x.email).map(x => ({ email: x.email, displayName: x.name || undefined, responseStatus: Object.keys(Sync.GRSVP).find(k => Sync.GRSVP[k] === (x.self ? it.rsvp : x.rsvp)) || 'needsAction' })),
      extendedProperties: { private: { alvorada: it.id, url: it.url.slice(0, 900), tags: it.tags.join(',').slice(0, 900), prio: String(it.prio) } },
      recurrence: [],
    };
    const cid = Object.keys(Sync.GCOLOR).find(k => Sync.GCOLOR[k] === it.color); if (cid) g.colorId = cid;
    if (it.rrule) {
      g.recurrence.push('RRULE:' + (day ? it.rrule.replace(/T235959Z/, '') : it.rrule));
      if (it.exdates.length) g.recurrence.push(day ? 'EXDATE;VALUE=DATE:' + it.exdates.map(k => k.replace(/-/g, '')).join(',') : `EXDATE;TZID=${tz}:` + it.exdates.map(k => k.replace(/-/g, '') + 'T' + it.start.slice(11, 16).replace(':', '') + '00').join(','));
    }
    return g;
  },
  fromG(e, it) {
    const day = !!(e.start && e.start.date), ext = (e.extendedProperties && e.extendedProperties.private) || {};
    it.type = 'event'; it.title = str(e.summary); it.desc = clean(str(e.description)); it.loc = str(e.location);
    if (day) { it.scope = 'day'; it.start = e.start.date; const last = addD(pd(e.end.date), -1); it.end = last > pd(it.start) ? ymd(last) : ''; }
    else { it.scope = 'time'; it.start = iso(new Date(e.start.dateTime)); it.end = iso(new Date(e.end.dateTime)); it.tz = str(e.start.timeZone) === localTz() ? '' : str(e.start.timeZone); }
    it.rrule = ''; const ex = [];
    (e.recurrence || []).forEach(l => { if (/^RRULE:/i.test(l)) it.rrule = RR.str(RR.parse(l)); else if (/^EXDATE/i.test(l)) l.slice(l.indexOf(':') + 1).split(',').forEach(v => { const d = ICS.date(v); if (d) ex.push(d.v.slice(0, 10)); }); });
    it.exdates = [...new Set([...(it.rrule ? it.exdates || [] : []), ...ex])];
    it.busy = e.transparency !== 'transparent'; it.vis = e.visibility === 'private' || e.visibility === 'public' ? e.visibility : '';
    it.rem = e.reminders && e.reminders.overrides ? e.reminders.overrides.map(o => o.minutes) : e.reminders && e.reminders.useDefault ? S.set.defRem.slice() : [];
    // a própria pessoa fica na lista (marcada como self) para a lista de convidados voltar intacta ao Google
    it.guests = (e.attendees || []).filter(a => a.email).map(a => ({ email: a.email, name: str(a.displayName) || (a.self ? 'Você' : ''), rsvp: Sync.GRSVP[a.responseStatus] || '', self: !!a.self }));
    const me = (e.attendees || []).find(a => a.self); it.rsvp = me ? Sync.GRSVP[me.responseStatus] || '' : '';
    it.url = str(e.hangoutLink) || str(ext.url) || it.url || '';
    it.color = e.colorId ? Sync.GCOLOR[e.colorId] || '' : (it.color && !Object.values(Sync.GCOLOR).includes(it.color) ? it.color : '');
    it.kind = Sync.GKIND[e.eventType] || (it.kind && !Object.values(Sync.GKIND).includes(it.kind) ? it.kind : '');
    if (ext.tags !== undefined) it.tags = ext.tags.split(',').filter(Boolean); if (ext.prio) it.prio = +ext.prio || 0;
    return it;
  },
  async calSync() {
    const st = Store.kv('gsync', { tokens: {}, list: [] });
    let changed = false;
    const put = it => { it.gmod = it.updated = Date.now(); Data.put('items', it, true); changed = true; };
    Hist.mute = true;
    try {
      const list = (await (await Sync.gfetch('calendar/v3/users/me/calendarList?maxResults=250')).json()).items || [];
      st.list = list.map(c => ({ id: c.id, name: c.summaryOverride || c.summary, color: c.backgroundColor, ro: !/^(owner|writer)$/.test(c.accessRole), primary: !!c.primary, selected: !!c.selected }));
      for (const c of st.list) {
        const on = S.set.gCals[c.id] !== undefined ? S.set.gCals[c.id] : (c.primary || (c.selected && !c.ro));
        let cal = S.calendars.find(x => x.gid === c.id);
        if (!on) continue;
        if (!cal) { cal = NORM.calendars({ id: 'g' + uid(), name: c.name, color: c.color, gid: c.id, ro: c.ro }); Data.put('calendars', cal); changed = true; }
        else if (cal.ro !== c.ro) { cal.ro = c.ro; Data.put('calendars', cal); }
        const base = `calendar/v3/calendars/${encodeURIComponent(c.id)}/events`;
        // --- receber ---
        let page = '', next = '', full = !st.tokens[c.id], retry = 0;
        for (;;) {
          const q = `?maxResults=250&showDeleted=true${page ? '&pageToken=' + encodeURIComponent(page) : ''}${st.tokens[c.id] ? '&syncToken=' + encodeURIComponent(st.tokens[c.id]) : '&timeMin=' + encodeURIComponent(addM(today(), -12).toISOString())}`;
          const r = await Sync.gfetch(base + q);
          if (r.status === 410 && !retry++) { delete st.tokens[c.id]; page = ''; full = true; continue; } // o Google pediu uma leitura completa
          if (!r.ok) break;
          const j = await r.json();
          for (const e of j.items || []) {
            let it = S.items.find(x => x.gid === e.id && x.gcal === c.id) || (e.extendedProperties && e.extendedProperties.private && byId(S.items, e.extendedProperties.private.alvorada)) || null;
            if (it && it.gid && it.gid !== e.id) it = null;
            const parent = e.recurringEventId && S.items.find(x => x.gid === e.recurringEventId && x.gcal === c.id);
            if (parent && e.originalStartTime) { const k = e.originalStartTime.date || ymd(new Date(e.originalStartTime.dateTime)); if (!parent.exdates.includes(k)) { parent.exdates.push(k); put(parent); } }
            if (e.status === 'cancelled') { if (it && !it.deleted) { it.deleted = Date.now(); put(it); } continue; }
            if (!e.start) continue;
            const gup = Date.parse(e.updated) || 0;
            if (it && it.updated > it.gmod && it.updated > gup) continue; // a alteração local é mais nova: será enviada
            if (it && it.gmod >= gup && !full) continue;
            const before = it ? JSON.stringify(it) : '';
            it = Sync.fromG(e, it || normItem({ id: uid(), cal: cal.id, rem: [] }));
            it.gid = e.id; it.gcal = c.id; it.cal = cal.id; it.deleted = 0;
            if (e.recurringEventId) { it.rrule = ''; it.from = parent ? parent.id : ''; }
            const up = it.updated; normItem(it); it.gmod = it.updated = 0;
            const same = before && JSON.stringify(Object.assign(JSON.parse(before), { gmod: 0, updated: 0 })) === JSON.stringify(it);
            if (same) { it.gmod = Math.max(gup, up); it.updated = up; } else put(it); // igual ao que já temos: nada a gravar
          }
          page = j.nextPageToken || ''; next = j.nextSyncToken || next;
          if (!page) break;
        }
        if (next) st.tokens[c.id] = next;
        // --- enviar ---
        if (c.ro) continue;
        for (const it of S.items.filter(x => x.cal === cal.id && x.type === 'event' && (x.scope === 'time' || x.scope === 'day'))) {
          if (it.deleted) { if (it.gid) { await Sync.gfetch(`${base}/${it.gid}`, { method: 'DELETE' }); it.gid = ''; it.gmod = it.updated; Data.put('items', it, true); } continue; }
          if (it.gid && it.gcal && it.gcal !== c.id) { const r = await Sync.gfetch(`calendar/v3/calendars/${encodeURIComponent(it.gcal)}/events/${it.gid}/move?destination=${encodeURIComponent(c.id)}`, { method: 'POST' }); if (!r.ok) it.gid = ''; it.gcal = c.id; }
          if (it.gid && it.updated <= it.gmod) continue;
          const r = await Sync.gfetch(it.gid ? `${base}/${it.gid}` : base, { method: it.gid ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Sync.toG(it)) });
          if (r.status === 404 || r.status === 410) { it.gid = ''; continue; }
          const j = await r.json(); it.gid = j.id; it.gcal = c.id; it.gmod = it.updated; Data.put('items', it, true);
        }
      }
      // itens que saíram de um calendário do Google para um calendário só local
      for (const it of S.items.filter(x => x.gid && x.gcal)) {
        const cal = byId(S.calendars, it.cal);
        if (cal && cal.gid) continue;
        await Sync.gfetch(`calendar/v3/calendars/${encodeURIComponent(it.gcal)}/events/${it.gid}`, { method: 'DELETE' }); it.gid = ''; it.gcal = ''; Data.put('items', it, true);
      }
      // itens apagados de vez (esvaziar a lixeira)
      const gd = Store.kv('gdel', { list: [] });
      while (gd.list.length) { const d = gd.list[0]; await Sync.gfetch(`calendar/v3/calendars/${encodeURIComponent(d.cal)}/events/${d.gid}`, { method: 'DELETE' }); gd.list.shift(); }
      Store.saveKv('gdel');
    } finally { Hist.mute = false; Store.saveKv('gsync'); }
    return changed;
  },

  /* ---------- Calendários assinados por endereço (.ics) ---------- */
  async fetchText(url) {
    if (Sync.avail) { const r = await Sync.api('fetch', { method: 'POST', body: url }); if (!r.ok) throw new Error('Não foi possível baixar o endereço.'); return r.text(); }
    const r = await fetch(url.replace(/^webcal:/i, 'https:')); if (!r.ok) throw new Error('O endereço respondeu ' + r.status); return r.text();
  },
  importIcs(text, calId, prefix) {
    const { items } = ICS.import(text), ids = new Set();
    let n = 0;
    for (const o of items) {
      const id = prefix ? prefix + '-' + norm(o.uid || o.title + o.start).replace(/[^\w]/g, '').slice(-40) : uid();
      delete o.uid; o.tags = (o.tags || []).map(ensureTag).filter(Boolean);
      const it = normItem(Object.assign({ rem: [] }, o, { id, cal: calId })), old = byId(S.items, id);
      ids.add(id);
      if (old) { const a = Object.assign({}, old, { mod: 0, updated: 0, created: 0 }), b = Object.assign({}, it, { mod: 0, updated: 0, created: 0 }); if (JSON.stringify(a) === JSON.stringify(b)) continue; it.created = old.created; }
      Data.put('items', it); n++;
    }
    return { n, ids, total: items.length };
  },
  async subs(only) {
    for (const cal of S.calendars.filter(c => c.url && (!only || c.id === only))) {
      try {
        const text = await Sync.fetchText(cal.url);
        if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('O endereço não devolveu um calendário .ics.');
        Hist.mute = true;
        const r = Sync.importIcs(text, cal.id, 's' + cal.id);
        S.items.filter(it => it.cal === cal.id && !r.ids.has(it.id)).forEach(it => Data.del('items', it.id));
        Hist.mute = false;
        cal.err = ''; if (r.n) App.render();
        if (only) toast(`${cal.name}: ${count(r.total, 'evento', 'eventos')}`);
      } catch (e) { Hist.mute = false; cal.err = e.message; if (only) toast(`${cal.name}: ${e.message}${Sync.avail ? '' : ' No site, o servidor do calendário precisa permitir o acesso; no programa de Windows isso não é necessário.'}`); }
    }
  },
};
