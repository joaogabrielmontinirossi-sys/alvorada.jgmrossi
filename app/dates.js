'use strict';
/* Alvorada — datas, recorrência (RRULE), ocorrências, entrada em linguagem natural, feriados e arquivos .ics */

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const iso = d => ymd(d) + 'T' + hm(d);
// aceita 'AAAA', 'AAAA-MM', 'AAAA-MM-DD' e 'AAAA-MM-DDTHH:mm' (hora local)
const pd = s => { const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?(?:T(\d{2}):(\d{2}))?/.exec(s || ''); return m ? new Date(+m[1], (m[2] || 1) - 1, +(m[3] || 1), +(m[4] || 0), +(m[5] || 0)) : null; };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMin = (d, n) => new Date(d.getTime() + n * 60000);
const dim = d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const addM = (d, n) => { const x = new Date(d), day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); x.setDate(Math.min(day, dim(x))); return x; };
const sod = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sow = d => addD(sod(d), -((d.getDay() - S.set.weekStart + 7) % 7));
const som = d => new Date(d.getFullYear(), d.getMonth(), 1);
const sameD = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const daysBetween = (a, b) => Math.round((sod(b) - sod(a)) / 864e5);
const today = () => sod(new Date());
function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), n = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - n);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return { y: x.getUTCFullYear(), w: Math.ceil(((x - y0) / 864e5 + 1) / 7) };
}
const weekKey = d => { const k = isoWeek(d); return `${k.y}-W${pad(k.w)}`; };
const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const weekStartOf = key => { const m = /^(\d{4})-W(\d{2})$/.exec(key); if (!m) return null; const j4 = new Date(+m[1], 0, 4), mon = addD(j4, -((j4.getDay() + 6) % 7)); return addD(mon, (+m[2] - 1) * 7); };

const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DOW3 = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtT = d => S.set.h24 ? hm(d) : `${d.getHours() % 12 || 12}${d.getMinutes() ? ':' + pad(d.getMinutes()) : ''}${d.getHours() < 12 ? 'am' : 'pm'}`;
const fmtD = d => `${d.getDate()} de ${MONTHS[d.getMonth()]}${d.getFullYear() === new Date().getFullYear() ? '' : ' de ' + d.getFullYear()}`;
const fmtDs = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}${d.getFullYear() === new Date().getFullYear() ? '' : '/' + d.getFullYear()}`;
const fmtLong = d => `${cap(DOW[d.getDay()])}, ${fmtD(d)}`;
function fmtRel(ts) {
  const diff = Date.now() - ts, min = 60000, d = new Date(ts);
  if (diff < min) return 'agora';
  if (diff < 60 * min) return `há ${Math.floor(diff / min)} min`;
  if (sameD(d, new Date())) return `há ${Math.floor(diff / (60 * min))} h`;
  if (sameD(d, addD(new Date(), -1))) return 'ontem';
  return fmtDs(d);
}
function relDay(d) {
  const n = daysBetween(today(), d);
  return n === 0 ? 'Hoje' : n === 1 ? 'Amanhã' : n === -1 ? 'Ontem' : n > 1 && n < 7 ? cap(DOW[d.getDay()]) : `${DOW3[d.getDay()]}, ${fmtDs(d)}`;
}
const fmtDur = min => min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}`;
const fmtRem = m => m === 0 ? 'Na hora' : m < 60 ? `${m} min antes` : m < 1440 ? `${+(m / 60).toFixed(1)} h antes` : m % 10080 === 0 ? `${m / 10080} sem. antes` : `${+(m / 1440).toFixed(1)} dia(s) antes`;
function timeIn(tz, d) { try { return new Intl.DateTimeFormat('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d); } catch (e) { return ''; } }
const localTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } };

/* ---------- Recorrência ---------- */
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const RR = {
  parse(s) {
    const o = { freq: '', interval: 1, byday: [], bymonthday: [], bymonth: [], count: 0, until: '' };
    String(s || '').replace(/^RRULE:/i, '').split(';').forEach(p => {
      const i = p.indexOf('='), k = p.slice(0, i).toUpperCase(), v = p.slice(i + 1);
      if (i < 0 || !v) return;
      if (k === 'FREQ') o.freq = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(v) ? v : '';
      else if (k === 'INTERVAL') o.interval = Math.max(1, parseInt(v) || 1);
      else if (k === 'BYDAY') o.byday = v.split(',').filter(x => /^[+-]?\d?(SU|MO|TU|WE|TH|FR|SA)$/.test(x));
      else if (k === 'BYMONTHDAY') o.bymonthday = v.split(',').map(Number).filter(n => n && Math.abs(n) <= 31);
      else if (k === 'BYMONTH') o.bymonth = v.split(',').map(Number).filter(n => n >= 1 && n <= 12);
      else if (k === 'COUNT') o.count = Math.max(0, parseInt(v) || 0);
      else if (k === 'UNTIL') o.until = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    });
    return o;
  },
  str(o) {
    if (!o.freq) return '';
    let s = 'FREQ=' + o.freq;
    if (o.interval > 1) s += ';INTERVAL=' + o.interval;
    if (o.byday.length) s += ';BYDAY=' + o.byday.join(',');
    if (o.bymonthday.length) s += ';BYMONTHDAY=' + o.bymonthday.join(',');
    if (o.bymonth.length) s += ';BYMONTH=' + o.bymonth.join(',');
    if (o.count) s += ';COUNT=' + o.count; else if (o.until) s += ';UNTIL=' + o.until.replace(/-/g, '') + 'T235959Z';
    return s;
  },
  // dias candidatos de um mês segundo a regra (ou o dia do início)
  monthDays(r, y, m, start) {
    const n = new Date(y, m + 1, 0).getDate(), out = [];
    if (r.byday.length && r.freq !== 'WEEKLY') {
      for (const code of r.byday) {
        const mt = /^([+-]?\d)?(\w\w)$/.exec(code), dow = BYDAY.indexOf(mt[2]), ord = parseInt(mt[1]) || 0, all = [];
        for (let d = 1; d <= n; d++) if (new Date(y, m, d).getDay() === dow) all.push(d);
        if (!ord) out.push(...all); else { const v = ord > 0 ? all[ord - 1] : all[all.length + ord]; if (v) out.push(v); }
      }
    } else for (const d of (r.bymonthday.length ? r.bymonthday : [start.getDate()])) { const v = d < 0 ? n + 1 + d : d; if (v >= 1 && v <= n) out.push(v); }
    return [...new Set(out)].sort((a, b) => a - b);
  },
  // datas (com a hora do início) das ocorrências em [from, to)
  expand(start, r, from, to) {
    const out = [];
    if (!r.freq) return out;
    const until = r.until ? addD(pd(r.until), 1) : null, lim = until && until < to ? until : to;
    const H = start.getHours(), Mi = start.getMinutes(), I = r.interval;
    let n = 0, guard = 0, stop = false;
    const emit = d => { if (d < start) return; if (d >= lim) { stop = true; return; } n++; if (d >= from) out.push(d); if (r.count && n >= r.count) stop = true; };
    // sem COUNT dá para pular direto para perto do intervalo pedido
    const skip = unit => !r.count && from > start ? Math.max(0, Math.floor((from - start) / (unit * 864e5 * I)) - 1) : 0;
    if (r.freq === 'DAILY') {
      for (let k = skip(1); !stop && guard++ < 20000; k++) { const b = addD(sod(start), k * I); emit(new Date(b.getFullYear(), b.getMonth(), b.getDate(), H, Mi)); }
    } else if (r.freq === 'WEEKLY') {
      const days = (r.byday.length ? r.byday.map(c => BYDAY.indexOf(c.slice(-2))) : [start.getDay()]).map(d => (d + 6) % 7).sort((a, b) => a - b);
      const wk0 = addD(sod(start), -((start.getDay() + 6) % 7));
      for (let k = skip(7); !stop && guard++ < 20000; k++) for (const off of days) { if (stop) break; const b = addD(wk0, k * I * 7 + off); emit(new Date(b.getFullYear(), b.getMonth(), b.getDate(), H, Mi)); }
    } else if (r.freq === 'MONTHLY') {
      for (let k = 0; !stop && guard++ < 6000; k++) {
        const b = new Date(start.getFullYear(), start.getMonth() + k * I, 1);
        if (b >= lim) break;
        for (const d of RR.monthDays(r, b.getFullYear(), b.getMonth(), start)) { if (stop) break; emit(new Date(b.getFullYear(), b.getMonth(), d, H, Mi)); }
      }
    } else {
      for (let k = 0; !stop && guard++ < 1000; k++) {
        const y = start.getFullYear() + k * I;
        if (new Date(y, 0, 1) >= lim) break;
        for (const mo of (r.bymonth.length ? r.bymonth.slice().sort((a, b) => a - b) : [start.getMonth() + 1])) for (const d of RR.monthDays(r, y, mo - 1, start)) { if (stop) break; emit(new Date(y, mo - 1, d, H, Mi)); }
      }
    }
    return out;
  },
  describe(s, startStr) {
    const r = RR.parse(s), st = pd(startStr) || new Date();
    if (!r.freq) return 'Não se repete';
    const unit = { DAILY: ['dia', 'dias'], WEEKLY: ['semana', 'semanas'], MONTHLY: ['mês', 'meses'], YEARLY: ['ano', 'anos'] }[r.freq];
    let t = r.interval > 1 ? `A cada ${r.interval} ${unit[1]}` : { DAILY: 'Todos os dias', WEEKLY: 'Toda semana', MONTHLY: 'Todo mês', YEARLY: 'Todo ano' }[r.freq];
    const ORD = { 1: 'primeira', 2: 'segunda', 3: 'terceira', 4: 'quarta', 5: 'quinta', '-1': 'última' };
    if (r.freq === 'WEEKLY') {
      const ds = (r.byday.length ? r.byday.map(c => BYDAY.indexOf(c.slice(-2))) : [st.getDay()]);
      t += ds.join() === '1,2,3,4,5' ? ' (dias úteis)' : ': ' + ds.map(d => DOW3[d]).join(', ');
    } else if (r.byday.length) t += ', ' + r.byday.map(c => { const m = /^([+-]?\d)?(\w\w)$/.exec(c); return (m[1] ? (ORD[parseInt(m[1])] || m[1] + 'ª') + ' ' : 'toda ') + DOW[BYDAY.indexOf(m[2])]; }).join(' e ');
    else if (r.freq === 'MONTHLY') t += ', dia ' + (r.bymonthday.length ? r.bymonthday.map(d => d < 0 ? 'último' : d).join(', ') : st.getDate());
    else if (r.freq === 'YEARLY') t += `, em ${st.getDate()} de ${MONTHS[(r.bymonth[0] || st.getMonth() + 1) - 1]}`;
    if (r.count) t += `, ${r.count} vezes`; else if (r.until) t += `, até ${fmtDs(pd(r.until))}`;
    return t;
  },
};

/* ---------- Filtro e ocorrências ---------- */
const Filter = { q: '', tags: [], lists: [], types: [], prio: 0, status: '' };
const filterOn = () => !!(Filter.q || Filter.tags.length || Filter.lists.length || Filter.types.length || Filter.prio || Filter.status);
function matchFilter(it) {
  if (Filter.types.length && !Filter.types.includes(it.type)) return false;
  if (Filter.tags.length && !Filter.tags.some(t => it.tags.includes(t))) return false;
  if (Filter.lists.length && !Filter.lists.includes(it.list)) return false;
  if (Filter.prio && it.prio < Filter.prio) return false;
  if (Filter.status && (it.type === 'event' || it.status !== Filter.status)) return false;
  if (Filter.q && !norm(it.title + ' ' + it.loc + ' ' + it.tags.join(' ') + ' ' + plain(it.desc)).includes(norm(Filter.q))) return false;
  return true;
}
const live = it => !it.deleted;
const shown = it => !it.deleted && !S.set.hideCals[it.cal] && matchFilter(it) && (S.set.showDeclined || it.rsvp !== 'no');
const isDone = (it, key) => it.type !== 'event' && (it.rrule && key ? !!it.doneOn[key] : it.status === 'done');
const calOf = it => byId(S.calendars, it.cal) || { name: '', color: '#039be5' };
const colorOf = it => it.color || (it.list && (byId(S.lists, it.list) || {}).color && it.type !== 'event' ? byId(S.lists, it.list).color : calOf(it).color);
const durOf = it => it.type === 'event' ? S.set.defDur : 30;
// início e fim (exclusivo) do item-base
function span(it) {
  const s = pd(it.start); if (!s) return null;
  if (it.scope === 'day') return { s, e: addD(pd(it.end) && pd(it.end) >= s ? pd(it.end) : s, 1), days: daysBetween(s, pd(it.end) && pd(it.end) >= s ? pd(it.end) : s) + 1 };
  const e = pd(it.end);
  return { s, e: e && e > s ? e : addMin(s, durOf(it)) };
}
/* Ocorrências em [from, to): { it, s, e, key, allDay, done } */
function occs(from, to, opt = {}) {
  const out = [];
  for (const it of S.items) {
    if (it.scope !== 'time' && it.scope !== 'day') continue;
    if (opt.all ? it.deleted : !shown(it)) continue;
    if (opt.type && it.type !== opt.type) continue;
    const sp = span(it); if (!sp) continue;
    const allDay = it.scope === 'day', len = sp.e - sp.s;
    if (it.rrule) {
      const lead = allDay ? addD(from, -sp.days) : new Date(from - len);
      for (const d of RR.expand(sp.s, RR.parse(it.rrule), lead, to)) {
        const key = ymd(d);
        if (it.exdates.includes(key)) continue;
        const e = allDay ? addD(d, sp.days) : new Date(d.getTime() + len);
        if (e > from || +d === +from) out.push({ it, s: d, e, key, allDay, done: isDone(it, key) });
      }
    } else if (sp.s < to && (sp.e > from || +sp.s === +from)) out.push({ it, s: sp.s, e: sp.e, key: ymd(sp.s), allDay, done: isDone(it) });
  }
  if (!opt.keepDone && !S.set.showDone) return out.filter(o => !o.done);
  return out.sort((a, b) => (b.allDay - a.allDay) || (a.s - b.s) || (b.e - a.e) || a.it.title.localeCompare(b.it.title));
}
const occsOn = (d, opt) => occs(sod(d), addD(sod(d), 1), opt);
// tarefas e lembretes presos a uma semana, mês ou ano (sem dia definido)
const periodItems = (scope, key) => S.items.filter(it => it.scope === scope && it.start === key && shown(it) && (S.set.showDone || !isDone(it)));
const noteOf = key => byId(S.notes, key);
const hasNote = key => { const n = noteOf(key); return !!(n && (plain(n.html).trim() || n.files.length || n.mood)); };
// próxima ocorrência de um item a partir de uma data
function nextOcc(it, from = new Date()) {
  const sp = span(it); if (!sp) return null;
  if (!it.rrule) return sp.s;
  const r = RR.expand(sp.s, RR.parse(it.rrule), from, addD(from, 800)).find(d => !it.exdates.includes(ymd(d)));
  return r || null;
}
const overdue = it => { if (it.type === 'event' || it.status === 'done' || it.status === 'cancel') return false; const d = pd(it.due) || (it.scope === 'time' || it.scope === 'day' ? (it.rrule ? null : (it.scope === 'time' ? pd(it.start) : addD(pd(it.start), 1))) : null); return !!d && d < (it.due && !it.due.includes('T') ? today() : new Date()); };

/* ---------- Entrada rápida em linguagem natural ---------- */
const WD = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const MON = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function parseQuick(text, base) {
  text = String(text).normalize('NFC');
  let n = norm(text);
  const r = { title: '', tags: [], prio: 0, loc: '', list: '', rrule: '', type: '', scope: '', date: null, t1: null, t2: null, dur: 0 };
  const cuts = [];
  const take = (re, fn) => { let m; re = new RegExp(re.source, 'g'); while ((m = re.exec(n))) { if (fn(m) === false) continue; cuts.push([m.index, m.index + m[0].length]); n = n.slice(0, m.index) + ' '.repeat(m[0].length) + n.slice(m.index + m[0].length); } };
  const nextDow = (dow, min = 0) => addD(today(), ((dow - today().getDay() + 7) % 7) || min);
  take(/^\s*(tarefa|lembrete|lembrar|evento)\s*:\s*/, m => { r.type = m[1] === 'tarefa' ? 'task' : m[1] === 'evento' ? 'event' : 'reminder'; });
  take(/(^|\s)#([\w-]+)/, m => { r.tags.push(text.slice(m.index + m[1].length + 1, m.index + m[0].length).toLowerCase()); });
  take(/(^|\s)!(urgente|alta|media|baixa|[1-4])(?=\s|$)/, m => { r.prio = { urgente: 4, alta: 3, media: 2, baixa: 1 }[m[2]] || +m[2]; });
  take(/(^|\s)~([\w-]+)/, m => { r.list = m[2]; });
  take(/(^|\s)@(?:"([^"]+)"|(\S+))/, m => { r.loc = text.slice(m.index + m[1].length + 1, m.index + m[0].length).replace(/"/g, ''); });
  take(/\b(todo dia|todos os dias|diariamente)\b/, () => { r.rrule = 'FREQ=DAILY'; });
  take(/\b(nos |em )?dias uteis\b/, () => { r.rrule = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'; });
  take(/\ba cada (\d+) (dia|semana|mes|ano)(s|es)?\b/, m => { r.rrule = `FREQ=${{ dia: 'DAILY', semana: 'WEEKLY', mes: 'MONTHLY', ano: 'YEARLY' }[m[2]]};INTERVAL=${m[1]}`; });
  take(/\b(toda|todo|todas as|todos os) (segunda|terca|quarta|quinta|sexta|sabado|domingo)s?(-feira)?s?\b/, m => { const d = WD.indexOf(m[2]); r.rrule = 'FREQ=WEEKLY;BYDAY=' + BYDAY[d]; r.date = nextDow(d); });
  take(/\b(toda semana|semanalmente)\b/, () => { r.rrule = 'FREQ=WEEKLY'; });
  take(/\b(todo mes|mensalmente)\b/, () => { r.rrule = 'FREQ=MONTHLY'; });
  take(/\b(todo ano|anualmente)\b/, () => { r.rrule = 'FREQ=YEARLY'; });
  take(/\bdepois de amanha\b/, () => { r.date = addD(today(), 2); });
  take(/\bamanha\b/, () => { r.date = addD(today(), 1); });
  take(/\bhoje\b/, () => { r.date = today(); });
  take(/\bontem\b/, () => { r.date = addD(today(), -1); });
  take(/\b(semana que vem|proxima semana)\b/, () => { r.scope = 'week'; r.date = addD(today(), 7); });
  take(/\b(esta|essa|nesta|nessa) semana\b/, () => { r.scope = 'week'; r.date = today(); });
  take(/\b(mes que vem|proximo mes)\b/, () => { r.scope = 'month'; r.date = addM(som(today()), 1); });
  take(/\b(este|esse|neste|nesse) mes\b/, () => { r.scope = 'month'; r.date = today(); });
  take(/\b(este|esse|neste|nesse) ano\b/, () => { r.scope = 'year'; r.date = today(); });
  take(/\b(algum dia|sem data)\b/, () => { r.scope = 'none'; });
  take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, m => { const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : today().getFullYear(); let d = new Date(y, m[2] - 1, +m[1]); if (m[2] > 12 || m[1] > 31) return false; if (!m[3] && d < today()) d = new Date(y + 1, m[2] - 1, +m[1]); r.date = d; });
  take(new RegExp(`\\b(?:dia )?(\\d{1,2}) de (${MON.join('|')})(?: de (\\d{4}))?\\b`), m => { const y = +m[3] || today().getFullYear(); let d = new Date(y, MON.indexOf(m[2]), +m[1]); if (!m[3] && d < today()) d.setFullYear(y + 1); r.date = d; });
  take(/\bdia (\d{1,2})\b/, m => { if (m[1] < 1 || m[1] > 31) return false; let d = new Date(today().getFullYear(), today().getMonth(), +m[1]); if (d < today()) d = addM(d, 1); r.date = d; });
  take(/\b(?:em|daqui a) (\d+) (dia|semana|mes)(s|es)?\b/, m => { r.date = m[2] === 'mes' ? addM(today(), +m[1]) : addD(today(), m[1] * (m[2] === 'semana' ? 7 : 1)); });
  take(/\b(?:na |no )?(proxim[ao] )?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(-feira)?\b/, m => { r.date = nextDow(WD.indexOf(m[2]), 7); if (m[1] && daysBetween(today(), r.date) < 7 && r.date.getDay() > today().getDay()) r.date = addD(r.date, 7); });
  take(/\b(?:por|durante) (\d+) ?(h|hora|horas|min|minutos)\b/, m => { r.dur = m[1] * (m[2][0] === 'h' ? 60 : 1); });
  const T = '(\\d{1,2})(?::(\\d{2})|h(\\d{2})?)', tm = (h, a, b) => (+h < 24 ? +h * 60 + (+(a || b || 0)) : null);
  take(new RegExp(`\\b(?:das? |de )?${T}\\s*(?:-|–|ate|as|a)\\s*(?:as )?${T}`), m => { r.t1 = tm(m[1], m[2], m[3]); r.t2 = tm(m[4], m[5], m[6]); if (r.t1 === null || r.t2 === null) return false; });
  take(/\bdas (\d{1,2}) (?:as|ate) (\d{1,2})\b/, m => { if (r.t1 !== null || m[1] > 23 || m[2] > 24) return false; r.t1 = m[1] * 60; r.t2 = m[2] * 60; });
  take(new RegExp(`\\b(?:as |a partir das )?${T}`), m => { if (r.t1 !== null) return false; r.t1 = tm(m[1], m[2], m[3]); if (r.t1 === null) return false; });
  take(/\bas (\d{1,2})\b/, m => { if (r.t1 !== null || m[1] > 23) return false; r.t1 = m[1] * 60; });
  take(/\bmeio[- ]dia\b/, () => { if (r.t1 !== null) return false; r.t1 = 720; });
  let title = '', pos = 0;
  cuts.sort((a, b) => a[0] - b[0]).forEach(([a, b]) => { title += text.slice(pos, a) + ' '; pos = Math.max(pos, b); });
  r.title = (title + text.slice(pos)).replace(/\s+/g, ' ').replace(/^[\s,;:-]+|[\s,;:-]+$/g, '');
  // resultado em campos do item
  const d0 = r.date || (base ? sod(base) : null), o = { title: r.title, tags: r.tags, prio: r.prio, loc: r.loc, rrule: r.rrule };
  if (r.type) o.type = r.type;
  if (r.list) { const l = S.lists.find(x => norm(x.name).replace(/\s+/g, '-') === r.list); if (l) o.list = l.id; }
  if (r.scope === 'none') { o.scope = 'none'; o.start = ''; }
  else if (r.scope === 'week') { o.scope = 'week'; o.start = weekKey(r.date); }
  else if (r.scope === 'month') { o.scope = 'month'; o.start = monthKey(r.date); }
  else if (r.scope === 'year') { o.scope = 'year'; o.start = String(r.date.getFullYear()); }
  else if (r.t1 !== null) {
    const d = d0 || (r.t1 <= new Date().getHours() * 60 + new Date().getMinutes() ? addD(today(), 1) : today());
    const s = addMin(d, r.t1); o.scope = 'time'; o.start = iso(s);
    if (r.t2 !== null) o.end = iso(addMin(d, r.t2 <= r.t1 ? r.t2 + 1440 : r.t2)); else if (r.dur) o.end = iso(addMin(s, r.dur));
    o.timed = true;
  } else if (r.date) { o.scope = 'day'; o.start = ymd(r.date); o.end = ''; }
  o.found = !!(r.date || r.t1 !== null || r.scope);
  return o;
}

/* ---------- Feriados nacionais (Brasil) e fases da lua ---------- */
const HOL = {};
function holidaysOf(y) {
  if (HOL[y]) return HOL[y];
  const h = {}, set = (m, d, n) => { h[`${y}-${pad(m)}-${pad(d)}`] = n; };
  set(1, 1, 'Confraternização Universal'); set(4, 21, 'Tiradentes'); set(5, 1, 'Dia do Trabalho'); set(9, 7, 'Independência do Brasil');
  set(10, 12, 'Nossa Senhora Aparecida'); set(11, 2, 'Finados'); set(11, 15, 'Proclamação da República'); set(11, 20, 'Consciência Negra'); set(12, 25, 'Natal');
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), hh = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451), mo = Math.floor((hh + l - 7 * m + 114) / 31), da = ((hh + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(y, mo - 1, da), rel = (n, name) => { h[ymd(addD(easter, n))] = name; };
  rel(-48, 'Carnaval'); rel(-47, 'Carnaval'); rel(-2, 'Sexta-feira Santa'); rel(0, 'Páscoa'); rel(60, 'Corpus Christi');
  return HOL[y] = h;
}
const holiday = d => S.set.holidays ? holidaysOf(d.getFullYear())[ymd(d)] || '' : '';
function moon(d) {
  const age = (((d - new Date(2000, 0, 6, 18, 14)) / 864e5) % 29.530588853 + 29.530588853) % 29.530588853, p = Math.round(age / 29.530588853 * 8) % 8;
  return { icon: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'][p], name: ['Lua nova', 'Crescente', 'Quarto crescente', 'Crescente gibosa', 'Lua cheia', 'Minguante gibosa', 'Quarto minguante', 'Minguante'][p], main: p % 2 === 0 && Math.abs(age - p * 3.691) < 0.52 };
}

/* ---------- iCalendar (.ics) ---------- */
const ICS = {
  esc: s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'),
  un: s => String(s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1'),
  dt: (s, allDay) => allDay ? s.slice(0, 10).replace(/-/g, '') : s.replace(/[-:]/g, '') + '00',
  export(items, name) {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Alvorada//PT-BR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + ICS.esc(name || 'Alvorada')];
    const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
    for (const it of items) {
      if (it.scope !== 'time' && it.scope !== 'day') continue;
      const todo = it.type !== 'event', allDay = it.scope === 'day', sp = span(it);
      L.push(todo ? 'BEGIN:VTODO' : 'BEGIN:VEVENT', 'UID:' + it.id + '@alvorada', 'DTSTAMP:' + stamp, 'SUMMARY:' + ICS.esc(it.title));
      L.push(allDay ? 'DTSTART;VALUE=DATE:' + ICS.dt(it.start, true) : 'DTSTART:' + ICS.dt(it.start));
      if (!todo) L.push(allDay ? 'DTEND;VALUE=DATE:' + ICS.dt(ymd(sp.e), true) : 'DTEND:' + ICS.dt(iso(sp.e)));
      if (todo && it.due) L.push(it.due.includes('T') ? 'DUE:' + ICS.dt(it.due) : 'DUE;VALUE=DATE:' + ICS.dt(it.due, true));
      if (it.rrule) L.push('RRULE:' + it.rrule);
      if (it.exdates.length) L.push((allDay ? 'EXDATE;VALUE=DATE:' : 'EXDATE:') + it.exdates.map(k => allDay ? k.replace(/-/g, '') : ICS.dt(k + 'T' + it.start.slice(11, 16))).join(','));
      if (it.desc) L.push('DESCRIPTION:' + ICS.esc(plain(it.desc)));
      if (it.loc) L.push('LOCATION:' + ICS.esc(it.loc));
      if (it.url) L.push('URL:' + it.url);
      if (it.tags.length) L.push('CATEGORIES:' + it.tags.map(ICS.esc).join(','));
      if (it.prio) L.push('PRIORITY:' + [0, 9, 5, 3, 1][it.prio]);
      if (todo) L.push('STATUS:' + (it.status === 'done' ? 'COMPLETED' : it.status === 'cancel' ? 'CANCELLED' : it.status === 'doing' ? 'IN-PROCESS' : 'NEEDS-ACTION'));
      else if (!it.busy) L.push('TRANSP:TRANSPARENT');
      it.guests.forEach(g => g.email && L.push(`ATTENDEE;CN=${ICS.esc(g.name || g.email)}:mailto:${g.email}`));
      it.rem.forEach(m => L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + ICS.esc(it.title), `TRIGGER:-PT${m}M`, 'END:VALARM'));
      L.push(todo ? 'END:VTODO' : 'END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.join('\r\n');
  },
  // 20261006 | 20261006T140000 | 20261006T140000Z → { v: 'AAAA-MM-DD[THH:mm]', allDay }
  date(v) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(v || ''); if (!m) return null;
    if (!m[4]) return { v: `${m[1]}-${m[2]}-${m[3]}`, allDay: true };
    if (m[7]) return { v: iso(new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]))), allDay: false };
    return { v: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`, allDay: false };
  },
  import(text) {
    const lines = String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/), out = [];
    let cur = null, alarm = false, name = '';
    for (const ln of lines) {
      const i = ln.indexOf(':'); if (i < 0) continue;
      const head = ln.slice(0, i).split(';'), k = head[0].toUpperCase(), v = ln.slice(i + 1);
      if (k === 'BEGIN') { if (v === 'VEVENT' || v === 'VTODO') cur = { type: v === 'VTODO' ? 'task' : 'event', rem: [], exdates: [], tags: [], guests: [] }; else if (v === 'VALARM') alarm = true; continue; }
      if (k === 'END') {
        if (v === 'VALARM') alarm = false;
        else if ((v === 'VEVENT' || v === 'VTODO') && cur) {
          if (cur.type === 'task' && !cur.start && cur.due) cur.start = cur.due.slice(0, 10);
          if (cur.scope === 'day' && cur.end) { const e = addD(pd(cur.end), -1); cur.end = e > pd(cur.start) ? ymd(e) : ''; }
          if (!cur.start) cur.scope = 'none';
          out.push(cur); cur = null;
        }
        continue;
      }
      if (!cur) { if (k === 'X-WR-CALNAME') name = ICS.un(v); continue; }
      if (alarm) { const m = /^-P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(v); if (k === 'TRIGGER' && m) cur.rem.push((+m[1] || 0) * 10080 + (+m[2] || 0) * 1440 + (+m[3] || 0) * 60 + (+m[4] || 0)); continue; }
      if (k === 'SUMMARY') cur.title = ICS.un(v);
      else if (k === 'DESCRIPTION') cur.desc = esc(ICS.un(v)).replace(/\n/g, '<br>');
      else if (k === 'LOCATION') cur.loc = ICS.un(v);
      else if (k === 'URL') cur.url = v;
      else if (k === 'UID') cur.uid = v;
      else if (k === 'DTSTART') { const d = ICS.date(v); if (d) { cur.start = d.v; cur.scope = d.allDay ? 'day' : 'time'; } }
      else if (k === 'DTEND') { const d = ICS.date(v); if (d) cur.end = d.v; }
      else if (k === 'DUE') { const d = ICS.date(v); if (d) cur.due = d.v; }
      else if (k === 'RRULE') cur.rrule = RR.str(RR.parse(v));
      else if (k === 'EXDATE') v.split(',').forEach(x => { const d = ICS.date(x); if (d) cur.exdates.push(d.v.slice(0, 10)); });
      else if (k === 'CATEGORIES') cur.tags.push(...v.split(',').map(x => ICS.un(x).trim().toLowerCase()).filter(Boolean));
      else if (k === 'PRIORITY') cur.prio = +v >= 1 && +v <= 2 ? 4 : +v <= 4 && +v > 0 ? 3 : +v === 5 ? 2 : +v > 5 ? 1 : 0;
      else if (k === 'STATUS') { if (v === 'COMPLETED') cur.status = 'done'; else if (v === 'IN-PROCESS') cur.status = 'doing'; else if (v === 'CANCELLED') cur.status = 'cancel'; }
      else if (k === 'TRANSP') cur.busy = v !== 'TRANSPARENT';
      else if (k === 'ATTENDEE') { const cn = head.find(p => /^CN=/i.test(p)); cur.guests.push({ email: v.replace(/^mailto:/i, ''), name: cn ? cn.slice(3).replace(/"/g, '') : '' }); }
    }
    return { name, items: out };
  },
};
