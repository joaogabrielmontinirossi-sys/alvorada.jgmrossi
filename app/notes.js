'use strict';
/* Alvorada — editor de texto, diário (anotações por dia, semana, mês, ano e páginas livres) e arquivos */

/* ---------- Editor de texto rico ---------- */
const RT_TOOLS = [['bold', 'N', 'Negrito (Ctrl+B)'], ['italic', 'I', 'Itálico (Ctrl+I)'], ['underline', 'S', 'Sublinhado (Ctrl+U)'], ['strikeThrough', 'T', 'Tachado'], '|', ['h1', 'T1', 'Título'], ['h2', 'T2', 'Subtítulo'], ['p', '¶', 'Texto normal'], '|',
  ['ul', '•', 'Lista'], ['ol', '1.', 'Lista numerada'], ['chk', '☑', 'Lista de verificação'], ['quote', '❝', 'Citação'], ['code', '{}', 'Código'], '|', ['link', '🔗', 'Link'], ['hl', '🖍', 'Marca-texto'], ['color', 'A', 'Cor do texto'], ['hr', '—', 'Linha'], ['img', '🖼', 'Imagem'], ['time', '🕒', 'Inserir hora'], ['item', '@', 'Mencionar tarefa ou evento'], ['table', '▦', 'Tabela'], '|', ['clear', '⌫', 'Limpar formatação'], ['undo', '↶', 'Desfazer'], ['redo', '↷', 'Refazer']];
const RT_MINI = ['bold', 'italic', 'underline', 'ul', 'ol', 'chk', 'link', 'hl', 'clear'];
function imgData(file, max = 1400) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL(file.type === 'image/png' && file.size < 400000 ? 'image/png' : 'image/jpeg', .85)); };
    img.onerror = rej; img.src = url;
  });
}
function richEditor(host, html, onChange, opt = {}) {
  const tools = opt.mini ? RT_TOOLS.filter(t => t !== '|' && RT_MINI.includes(t[0])) : RT_TOOLS;
  host.innerHTML = `<div class="rtbar">${tools.map(t => t === '|' ? '<i></i>' : `<button type="button" data-c="${t[0]}" title="${t[2]}" class="c-${t[0]}">${t[1]}</button>`).join('')}</div><div class="rte rt${opt.mini ? ' mini' : ''}" contenteditable="true" data-ph="${esc(opt.placeholder || 'Escreva aqui…')}">${clean(html)}</div>`;
  const ed = $('.rte', host), val = () => { const h = ed.innerHTML; return h === '<br>' || h === '<div><br></div>' || h === '<p><br></p>' ? '' : h; };
  const later = debounce(() => onChange(val()), 500), fire = () => { later(); };
  const ex = (c, v) => { ed.focus(); document.execCommand(c, false, v); fire(); };
  const block = () => { let n = getSelection().anchorNode; while (n && n !== ed) { if (n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName)) return n; n = n.parentNode; } return null; };
  $('.rtbar', host).onmousedown = e => e.preventDefault();
  $('.rtbar', host).onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const c = b.dataset.c;
    if (c === 'h1') ex('formatBlock', 'H2'); else if (c === 'h2') ex('formatBlock', 'H3'); else if (c === 'p') ex('formatBlock', 'P'); else if (c === 'quote') ex('formatBlock', 'BLOCKQUOTE'); else if (c === 'code') ex('formatBlock', 'PRE');
    else if (c === 'ul') ex('insertUnorderedList'); else if (c === 'ol') ex('insertOrderedList');
    else if (c === 'chk') { let l = block(); if (!l || l.tagName !== 'UL') { ex('insertUnorderedList'); l = block(); } if (l) l.classList.toggle('chk'); fire(); }
    else if (c === 'link') { const sel = getSelection(), rng = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null, u = await ask('Endereço do link', 'https://'); if (!u) return; ed.focus(); if (rng) { sel.removeAllRanges(); sel.addRange(rng); } if (sel.isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(u)}">${esc(u)}</a>`); else document.execCommand('createLink', false, u); fire(); }
    else if (c === 'hl') menu(b, [['Amarelo', '#fff176'], ['Verde', '#b9f6ca'], ['Azul', '#b3e5fc'], ['Rosa', '#f8bbd0'], ['Laranja', '#ffd180']].map(([n, v]) => ({ label: n, color: v, fn: () => { ex('hiliteColor', v); ex('foreColor', '#1f2937'); } })).concat([{ label: 'Sem marca', fn: () => { ex('hiliteColor', 'transparent'); ex('removeFormat'); } }]));
    else if (c === 'color') menu(b, [['Padrão', ''], ...PALETTE.slice(0, 12)].map(([n, v]) => ({ label: n, color: v || '#888', fn: () => v ? ex('foreColor', v) : ex('removeFormat') })));
    else if (c === 'hr') ex('insertHorizontalRule');
    else if (c === 'img') Files.pick(async fs => { for (const f of fs) if (f.type.startsWith('image/')) ex('insertHTML', `<img src="${await imgData(f)}" alt="">`); }, 'image/*');
    else if (c === 'time') ex('insertText', fmtT(new Date()) + ' ');
    else if (c === 'table') ex('insertHTML', '<table><tbody>' + '<tr><td><br></td><td><br></td><td><br></td></tr>'.repeat(3) + '</tbody></table><p><br></p>');
    else if (c === 'item') { const sel = getSelection(), rng = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null; pickItem(it => { ed.focus(); if (rng) { sel.removeAllRanges(); sel.addRange(rng); } document.execCommand('insertHTML', false, `<a class="ilink" data-item="${it.id}" contenteditable="false">@${esc(cut(it.title, 50))}</a>&nbsp;`); fire(); }); }
    else if (c === 'clear') { ex('removeFormat'); ex('formatBlock', 'P'); }
    else ex(c);
  };
  ed.addEventListener('input', fire);
  ed.addEventListener('blur', () => onChange(val()));
  ed.addEventListener('click', e => {
    const li = e.target.closest('ul.chk > li'), a = e.target.closest('a');
    if (li && e.target === li && e.offsetX < 24) { li.classList.toggle('on'); fire(); }
    else if (a && a.dataset.item) { e.preventDefault(); const it = Ops.get(a.dataset.item); it ? openPop(getOcc(it.id, ''), a) : toast('Este item não existe mais'); }
    else if (a && a.href && (e.ctrlKey || e.metaKey || !ed.isContentEditable || 'ontouchstart' in window)) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
  });
  ed.addEventListener('paste', async e => {
    const cd = e.clipboardData; if (!cd) return;
    const imgs = [...cd.files].filter(f => f.type.startsWith('image/'));
    if (imgs.length) { e.preventDefault(); for (const f of imgs) ex('insertHTML', `<img src="${await imgData(f)}" alt="">`); }
    else if (cd.types.includes('text/html')) { e.preventDefault(); ex('insertHTML', clean(cd.getData('text/html')).replace(/ (style|class|id)="[^"]*"/g, '')); }
  });
  ed.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') e.stopPropagation(); });
  return { el: ed, value: val, set(h) { ed.innerHTML = clean(h); onChange(val()); }, focus: () => ed.focus() };
}
function pickItem(cb) {
  const m = modal({ title: 'Mencionar um item', body: '<input id="pq" placeholder="Procurar tarefa, lembrete ou evento" autocomplete="off"><div class="picks" id="pr"></div>' });
  const paint = () => { const q = norm($('#pq', m.el).value); $('#pr', m.el).innerHTML = S.items.filter(o => !o.deleted && norm(o.title).includes(q)).sort((a, b) => b.updated - a.updated).slice(0, 30).map(o => `<button class="pickb" data-id="${o.id}"><b>${ic(typeIcon(o))} ${esc(o.title || '(sem título)')}</b><span>${esc(whenText(o))}</span></button>`).join('') || '<p class="muted">Nada encontrado.</p>'; };
  $('#pq', m.el).oninput = paint;
  $('#pr', m.el).onclick = e => { const b = e.target.closest('.pickb'); if (b) { m.close(); cb(Ops.get(b.dataset.id)); } };
  paint();
}

/* ---------- Arquivos ---------- */
const Files = {
  urls: new Map(),
  meta: id => byId(S.filemeta, id),
  kind(f) { const t = f.type || '', n = (f.name || '').toLowerCase(); return t.startsWith('image/') ? 'img' : t.startsWith('video/') ? 'video' : t.startsWith('audio/') ? 'audio' : t === 'application/pdf' || n.endsWith('.pdf') ? 'pdf' : t.startsWith('text/') || /\.(txt|md|csv|json|xml|log|js|css|html|py|ini|yml|yaml)$/.test(n) ? 'text' : 'other'; },
  icon: f => ({ img: 'img', video: 'play', audio: 'mic', pdf: 'file', text: 'note', other: 'file' }[Files.kind(f)]),
  async add(list, owner) {
    const ids = [];
    for (const f of list) {
      if (f.size > 300 * 1048576) { toast(`"${cut(f.name, 30)}" passa de 300 MB e não foi anexado`); continue; }
      const id = uid();
      await DB.put('files', { id, blob: f });
      Data.put('filemeta', NORM.filemeta({ id, name: f.name, type: f.type, size: f.size, owner }));
      ids.push(id);
    }
    if (ids.length) Sync.filesSoon();
    return ids;
  },
  async blob(id) {
    const r = await DB.get('files', id);
    if (r && r.blob) return r.blob;
    const b = await Sync.fetchFile(id);
    if (b) await DB.put('files', { id, blob: b });
    return b || null;
  },
  async url(id) { if (Files.urls.has(id)) return Files.urls.get(id); const b = await Files.blob(id); if (!b) return ''; const m = Files.meta(id), u = URL.createObjectURL(m && m.type && b.type !== m.type ? new Blob([b], { type: m.type }) : b); Files.urls.set(id, u); return u; },
  rows(ids, del) { return ids.map(Files.meta).filter(Boolean).map(f => `<div class="frowf"><button type="button" class="fth" data-fid="${f.id}" data-act="fileOpen" data-id="${f.id}">${ic(Files.icon(f))}</button><button type="button" class="fname" data-act="fileOpen" data-id="${f.id}"><b>${esc(f.name)}</b><span>${fmtSize(f.size)} · ${fmtRel(f.created)}</span></button><button type="button" class="icon sm" data-act="fileDl" data-id="${f.id}" title="Baixar">${ic('dl')}</button>${del ? `<button type="button" class="icon sm" ${del === 'e' ? 'data-e="fx"' : 'data-act="fileDel"'} data-id="${f.id}" title="Remover">${ic('x')}</button>` : ''}</div>`).join(''); },
  chips: ids => ids.map(Files.meta).filter(Boolean).map(f => `<button class="fchip" data-act="fileOpen" data-id="${f.id}"><span class="fth" data-fid="${f.id}">${ic(Files.icon(f))}</span>${esc(cut(f.name, 28))}</button>`).join(''),
  thumbs(root) { $$('.fth[data-fid]', root).forEach(el => { const f = Files.meta(el.dataset.fid); if (f && Files.kind(f) === 'img' && f.size < 30 * 1048576) Files.url(f.id).then(u => { if (u) el.innerHTML = `<img src="${u}" alt="">`; }); }); },
  pick(cb, accept) { const p = $('#filepick'); p.value = ''; p.accept = accept || ''; p.onchange = () => { if (p.files.length) cb([...p.files]); }; p.click(); },
  async open(id) {
    const f = Files.meta(id); if (!f) return toast('Arquivo não encontrado');
    const u = await Files.url(id); if (!u) return toast('O arquivo ainda não chegou a este aparelho. Sincronize e tente de novo.');
    const k = Files.kind(f);
    let body = k === 'img' ? `<img class="pv" src="${u}" alt="">` : k === 'video' ? `<video class="pv" src="${u}" controls autoplay></video>` : k === 'audio' ? `<audio class="pva" src="${u}" controls autoplay></audio>` : k === 'pdf' ? `<iframe class="pvf" src="${u}"></iframe>` : '';
    if (k === 'text' && f.size < 2 * 1048576) body = `<pre class="pvt">${esc(await (await Files.blob(id)).text())}</pre>`;
    const m = modal({ title: esc(cut(f.name, 60)), wide: true, cls: 'preview', body: `${body || `<p class="empty">${ic('file')}<br>Este tipo de arquivo não tem pré-visualização.<br>${esc(f.type || 'tipo desconhecido')} · ${fmtSize(f.size)}</p>`}<div class="mfoot"><span class="muted">${fmtSize(f.size)} · ${esc(Files.ownerText(f))}</span><span class="grow"></span><a class="btn ghost" href="${u}" target="_blank" rel="noopener">Abrir em nova aba</a><button class="btn" id="pvd">${ic('dl')} Baixar</button></div>` });
    $('#pvd', m.el).onclick = () => Files.download(id);
  },
  async download(id) { const f = Files.meta(id), b = await Files.blob(id); if (!f || !b) return toast('Arquivo indisponível neste aparelho'); download(f.name, b); },
  remove(id) { Data.del('filemeta', id); DB.del('files', id); const u = Files.urls.get(id); if (u) { URL.revokeObjectURL(u); Files.urls.delete(id); } },
  ownerText(f) { const [k, id] = f.owner.split(/:(.*)/); if (k === 'note') return noteTitle(id); const it = Ops.get(id); return it ? it.title : 'sem dono'; },
  // gravação de áudio pelo microfone
  async record(owner, done) {
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('Este navegador não grava áudio');
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return toast('Microfone não autorizado'); }
    const rec = new MediaRecorder(stream), parts = [], t0 = Date.now(); let keep = false;
    const m = modal({ title: 'Gravando áudio…', body: `<p class="recT" id="rect">00:00</p><div class="mfoot"><button class="btn ghost" data-close>Descartar</button><button class="btn" id="recok">${ic('check')} Parar e anexar</button></div>`, onClose: () => { clearInterval(iv); rec.state !== 'inactive' && rec.stop(); } });
    const iv = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $('#rect', m.el).textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }, 500);
    rec.ondataavailable = e => parts.push(e.data);
    rec.onstop = async () => { stream.getTracks().forEach(t => t.stop()); if (!keep) return; const d = new Date(), f = new File(parts, `Gravação ${pad(d.getDate())}-${pad(d.getMonth() + 1)} ${pad(d.getHours())}h${pad(d.getMinutes())}.webm`, { type: rec.mimeType || 'audio/webm' }); done(await Files.add([f], owner)); };
    $('#recok', m.el).onclick = () => { keep = true; m.close(); };
    rec.start();
  },
};
Actions.fileOpen = el => Files.open(el.dataset.id);
Actions.fileDl = el => Files.download(el.dataset.id);

/* ---------- Diário ---------- */
const keyKind = k => /^p-/.test(k) ? 'page' : k.includes('W') ? 'week' : k.length === 10 ? 'day' : k.length === 7 ? 'month' : 'year';
const keyDate = k => keyKind(k) === 'week' ? weekStartOf(k) : keyKind(k) === 'page' ? today() : pd(k);
const keyFor = (kind, d) => kind === 'week' ? weekKey(d) : kind === 'month' ? monthKey(d) : kind === 'year' ? String(d.getFullYear()) : ymd(d);
function noteTitle(k) {
  const kind = keyKind(k), d = keyDate(k);
  if (kind === 'page') return (noteOf(k) || {}).title || 'Página sem título';
  if (!d) return k;
  return kind === 'day' ? fmtLong(d) : kind === 'week' ? `Semana ${+k.slice(6)} · ${fmtDs(d)} a ${fmtDs(addD(d, 6))}` : kind === 'month' ? `${cap(MONTHS[d.getMonth()])} de ${d.getFullYear()}` : 'Ano de ' + k;
}
const getNote = (k, create) => noteOf(k) || (create ? NORM.notes({ id: k, page: keyKind(k) === 'page' }) : null);
const words = html => (plain(html).trim().match(/\S+/g) || []).length;
const Journal = { ed: null };
Views.journal = {
  label: 'Diário', icon: 'book', key: 'J', group: 'org',
  title: () => noteTitle(App.noteKey),
  step(n) { const k = App.noteKey, kind = keyKind(k), d = keyDate(k); if (kind === 'page') return; App.cur = kind === 'day' ? addD(d, n) : kind === 'week' ? addD(d, 7 * n) : kind === 'month' ? addM(d, n) : new Date(d.getFullYear() + n, 0, 1); App.noteKey = keyFor(kind, App.cur); },
  render(el) {
    const k = App.noteKey, kind = keyKind(k), d = keyDate(k), n = getNote(k), owner = 'note:' + k;
    const from = kind === 'day' ? d : kind === 'week' ? d : kind === 'month' ? d : d, to = kind === 'day' ? addD(d, 1) : kind === 'week' ? addD(d, 7) : kind === 'month' ? addM(d, 1) : new Date(d.getFullYear() + 1, 0, 1);
    const list = kind === 'page' ? [] : occs(from, to, { keepDone: true }), per = kind === 'day' || kind === 'page' ? [] : periodItems(kind, k);
    const same = kind === 'day' ? S.notes.filter(x => x.id.length === 10 && x.id !== k && x.id.slice(5) === k.slice(5) && plain(x.html).trim()).sort((a, b) => b.id.localeCompare(a.id)) : [];
    const refs = n ? (n.refs || []).map(Ops.get).filter(x => x && !x.deleted) : [];
    const sub = kind === 'week' ? [...Array(7).keys()].map(i => ymd(addD(d, i))).filter(hasNote) : kind === 'month' ? S.notes.filter(x => x.id.length === 10 && x.id.startsWith(k) && hasNote(x.id)).map(x => x.id).sort() : [];
    el.innerHTML = `<div class="jv" style="${n && n.color ? '--tint:' + n.color : ''}"><div class="jbar"><div class="seg">${[['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano']].map(([t, l]) => `<button class="${kind === t ? 'on' : ''}" data-act="jKind" data-k="${t}">${l}</button>`).join('')}<button class="${kind === 'page' ? 'on' : ''}" data-act="jPages">Páginas ${ic('down')}</button></div><span class="grow"></span>
        ${kind === 'day' ? `<button class="btn ghost sm" data-act="jMood" title="Como foi o dia?">${n && n.mood ? n.mood : '🙂'} <span>Humor</span></button>` : ''}<button class="btn ghost sm" data-act="jColor" title="Cor de destaque (aparece no calendário)"><i class="dot" style="background:${n && n.color ? n.color : 'var(--line)'}"></i><span>Cor</span></button><button class="icon" data-act="jMenu" title="Mais">${ic('more')}</button></div>
      <div class="jcols"><div class="jmain">${kind === 'page' ? `<input id="jtitle" class="big" value="${esc(n ? n.title : '')}" placeholder="Título da página" maxlength="120">` : ''}
        <div id="jed"></div><div class="jstat"><span id="jwc">${count(words(n ? n.html : ''), 'palavra', 'palavras')}</span>${!n || !plain(n.html).trim() ? (S.set.dailyTpl && kind === 'day' ? ' · <button class="link" data-act="jTpl">usar o modelo diário</button>' : '') : ''}<span class="grow"></span><span id="jsaved"></span></div>
        <div class="jfiles" id="jdrop"><h4>${ic('clip')} Arquivos <span>${n ? n.files.length : 0}</span><span class="grow"></span><button class="btn ghost sm" data-act="jRec">${ic('mic')}<span>Gravar áudio</span></button><button class="btn ghost sm" data-act="jFile">${ic('plus')}<span>Anexar</span></button></h4>
          <div class="flist">${n && n.files.length ? Files.rows(n.files, true) : '<p class="muted">Arraste arquivos de qualquer tipo para cá: fotos, PDFs, áudios, vídeos, planilhas…</p>'}</div></div></div>
      <aside class="jside">
        ${kind === 'page' ? '' : `<section><h4>${kind === 'day' ? 'Agenda do dia' : 'No período'} <span>${list.length + per.length}</span><span class="grow"></span>${kind === 'day' ? `<button class="link sm" data-act="goDay" data-date="${k}">ver na grade</button>` : ''}</h4>
          <div class="qadd">${ic('plus')}<input id="jadd" placeholder="${kind === 'day' ? 'Tarefa ou evento neste dia' : 'Tarefa para ' + (kind === 'week' ? 'a semana' : kind === 'month' ? 'o mês' : 'o ano')}" autocomplete="off"></div>
          <div class="daylist">${per.map(pchip).join('')}${(kind === 'day' ? list : list.slice(0, 60)).map(o => chip(o, { multi: o.allDay })).join('')}${kind !== 'day' && list.length > 60 ? `<p class="muted">e mais ${list.length - 60}…</p>` : ''}${list.length + per.length ? '' : '<p class="muted">Nada marcado.</p>'}</div></section>`}
        ${kind === 'day' && S.habits.some(h => !h.archived) ? `<section><h4>Hábitos</h4><div class="jhab">${S.habits.filter(h => !h.archived).map(h => `<button class="${h.days[k] ? 'on' : ''}" style="--c:${h.color}" data-act="habitTog" data-id="${h.id}" data-date="${k}">${h.icon || '•'} ${esc(h.name)}</button>`).join('')}</div></section>` : ''}
        ${sub.length ? `<section><h4>Anotações dos dias</h4>${sub.map(x => `<button class="lk" data-act="openNote" data-key="${x}"><small>${fmtDs(pd(x))}</small> ${esc(cut(plain(noteOf(x).html).trim() || '(arquivos)', 60))}</button>`).join('')}</section>` : ''}
        ${refs.length ? `<section><h4>Itens mencionados</h4>${refs.map(x => `<button class="lk" data-act="openItem" data-id="${x.id}">${ic(typeIcon(x))} ${esc(cut(x.title, 50))}</button>`).join('')}</section>` : ''}
        ${same.length ? `<section><h4>Neste dia, em outros anos</h4>${same.map(x => `<button class="lk" data-act="openNote" data-key="${x.id}"><small>${x.id.slice(0, 4)}</small> ${esc(cut(plain(x.html).trim(), 70))}</button>`).join('')}</section>` : ''}
        ${kind === 'day' ? `<section><h4>Outros níveis</h4><button class="lk" data-act="openNote" data-key="${weekKey(d)}">${ic('note')} Notas da semana${hasNote(weekKey(d)) ? ' •' : ''}</button><button class="lk" data-act="openNote" data-key="${monthKey(d)}">${ic('note')} Notas do mês${hasNote(monthKey(d)) ? ' •' : ''}</button><button class="lk" data-act="openNote" data-key="${d.getFullYear()}">${ic('note')} Notas do ano${hasNote(String(d.getFullYear())) ? ' •' : ''}</button></section>` : ''}
      </aside></div></div>`;
    const save = html => {
      const cur = getNote(k); if (!cur && !html) return;
      const x = getNote(k, true); if (x.html === html) return;
      x.html = html; x.refs = [...new Set((html.match(/data-item="([^"]+)"/g) || []).map(s => s.slice(11, -1)))];
      Data.put('notes', x);
      const wc = $('#jwc'); if (wc) wc.textContent = count(words(html), 'palavra', 'palavras');
      const sv = $('#jsaved'); if (sv) sv.textContent = 'Salvo às ' + fmtT(new Date());
    };
    Journal.ed = richEditor($('#jed', el), n ? n.html : '', save, { placeholder: kind === 'day' ? 'Como foi o dia? Anote o que quiser: ideias, reuniões, lembranças…' : 'Anotações livres…' });
    Files.thumbs(el);
    const ti = $('#jtitle', el); if (ti) ti.onchange = () => { const x = getNote(k, true); x.title = ti.value.trim(); Data.put('notes', x); App.renderTop(); };
    const add = $('#jadd', el);
    if (add) add.onkeydown = e => {
      if (e.key !== 'Enter' || !add.value.trim()) return;
      const o = parseQuick(add.value, kind === 'day' ? d : null);
      if (kind === 'day') { if (!o.found || !o.start) { o.scope = 'day'; o.start = k; } } else if (!o.found) { o.scope = kind; o.start = k; }
      Ops.create(Object.assign({ type: o.timed && kind === 'day' && !o.type ? 'event' : 'task' }, o)); App.render(); setTimeout(() => { const x = $('#jadd'); if (x) x.focus(); }, 0);
    };
  },
};
const noteUpd = fn => { const x = getNote(App.noteKey, true); fn(x); Data.put('notes', x); App.render(); };
async function attachToNote(files, key) { const ids = await Files.add(files, 'note:' + key); if (!ids.length) return; const x = getNote(key, true); x.files.push(...ids); Data.put('notes', x); App.render(); toast(`${count(ids.length, 'arquivo anexado', 'arquivos anexados')} a ${noteTitle(key)}`); }
Actions.jKind = el => { App.noteKey = keyFor(el.dataset.k, keyKind(App.noteKey) === 'page' ? App.cur : keyDate(App.noteKey) < App.cur && keyKind(App.noteKey) !== 'day' ? App.cur : keyDate(App.noteKey)); App.render(); };
Actions.jMood = el => menu(el, [...MOODS.map(m => ({ label: '', emoji: m, fn: () => noteUpd(x => { x.mood = m; }) })), { label: 'Sem humor', fn: () => noteUpd(x => { x.mood = ''; }) }], { cls: 'emojis' });
Actions.jColor = el => menu(el, [{ label: 'Sem cor', fn: () => noteUpd(x => { x.color = ''; }) }, ...PALETTE.map(([n, c]) => ({ label: n, color: c, fn: () => noteUpd(x => { x.color = c; }) }))]);
Actions.jFile = () => Files.pick(fs => attachToNote(fs, App.noteKey));
Actions.jRec = () => Files.record('note:' + App.noteKey, ids => { const x = getNote(App.noteKey, true); x.files.push(...ids); Data.put('notes', x); App.render(); });
Actions.fileDel = async el => { const id = el.dataset.id, f = Files.meta(id); if (!f || !await confirmBox(`Remover o arquivo "${f.name}"?`, 'Remover', true)) return; const [k, oid] = f.owner.split(/:(.*)/), rec = k === 'note' ? noteOf(oid) : Ops.get(oid); if (rec) { rec.files = rec.files.filter(x => x !== id); Data.put(k === 'note' ? 'notes' : 'items', rec); } Files.remove(id); App.render(); };
Actions.jTpl = () => { Journal.ed.set(S.set.dailyTpl); App.render(); };
Actions.jPages = el => menu(el, [...S.notes.filter(n => n.page).sort((a, b) => a.title.localeCompare(b.title)).map(n => ({ label: n.title || 'Página sem título', icon: 'note', checked: n.id === App.noteKey, fn: () => App.go('journal', null, n.id) })), '-', { label: 'Nova página', icon: 'plus', fn: async () => { const t = await ask('Nova página', '', 'Título (ex.: Ideias, Metas de 2027, Lista de livros)', 'Criar'); if (t === null) return; const n = NORM.notes({ id: 'p-' + uid(), title: t, page: true }); Data.put('notes', n); App.go('journal', null, n.id); } }]);
Actions.jMenu = el => {
  const k = App.noteKey, n = getNote(k), html = n ? n.html : '';
  menu(el, [
    { label: 'Ir para hoje', icon: 'today', fn: () => App.go('journal', today()) },
    { label: 'Salvar este texto como modelo diário', icon: 'star', fn: () => { S.set.dailyTpl = html; Store.saveSet(); toast('Modelo diário salvo'); } },
    S.set.dailyTpl && { label: 'Aplicar o modelo diário', icon: 'copy', fn: () => { Journal.ed.set((html || '') + S.set.dailyTpl); App.render(); } },
    { label: 'Inserir a agenda do dia no texto', icon: 'list', fn: () => { const d = keyDate(k), l = keyKind(k) === 'day' ? occsOn(d, { keepDone: true }) : []; Journal.ed.set((html || '') + `<h3>Agenda</h3><ul>${l.map(o => `<li>${o.allDay ? '' : fmtT(o.s) + ' '}${esc(o.it.title)}</li>`).join('') || '<li>Nada marcado</li>'}</ul>`); App.render(); } },
    '-',
    { label: 'Exportar como página (.html)', icon: 'dl', fn: () => download(noteTitle(k).replace(/[\\/:*?"<>|]/g, ' ') + '.html', `<!doctype html><meta charset="utf-8"><title>${esc(noteTitle(k))}</title><body style="font:16px/1.6 Segoe UI,sans-serif;max-width:760px;margin:40px auto;padding:0 16px"><h1>${esc(noteTitle(k))}</h1>${html}`, 'text/html') },
    { label: 'Exportar como texto (.txt)', icon: 'dl', fn: () => download(noteTitle(k).replace(/[\\/:*?"<>|]/g, ' ') + '.txt', noteTitle(k) + '\n\n' + ($('.rte') ? $('.rte').innerText : plain(html))) },
    { label: 'Imprimir', icon: 'print', fn: () => print() },
    '-',
    { label: keyKind(k) === 'page' ? 'Excluir esta página' : 'Apagar estas anotações', icon: 'trash', danger: true, fn: async () => { if (!n || !await confirmBox('Apagar o texto e os arquivos desta página do diário?', 'Apagar', true)) return; n.files.forEach(Files.remove); Data.del('notes', k); if (keyKind(k) === 'page') App.noteKey = ymd(today()); App.render(); toast('Anotações apagadas', { label: 'Desfazer', fn: () => Hist.undo() }); } },
  ]);
};

/* ---------- Todos os arquivos ---------- */
const FilesView = { q: '', kind: '' };
Views.files = {
  label: 'Arquivos', icon: 'clip', key: 'R', group: 'org', title: () => 'Arquivos', step() {},
  render(el) {
    const all = S.filemeta.filter(f => (!FilesView.kind || Files.kind(f) === FilesView.kind) && norm(f.name).includes(norm(FilesView.q))).sort((a, b) => b.created - a.created), total = S.filemeta.reduce((n, f) => n + f.size, 0);
    el.innerHTML = `<div class="fv"><div class="tbar"><div class="qadd">${ic('search')}<input id="fq" placeholder="Procurar arquivo" value="${esc(FilesView.q)}" autocomplete="off"></div>${[['', 'Todos'], ['img', 'Imagens'], ['pdf', 'PDFs'], ['audio', 'Áudios'], ['video', 'Vídeos'], ['text', 'Textos'], ['other', 'Outros']].map(([k, l]) => `<button class="btn ghost sm${FilesView.kind === k ? ' on' : ''}" data-act="fKind" data-k="${k}">${l}</button>`).join('')}</div>
      <p class="muted">${count(S.filemeta.length, 'arquivo', 'arquivos')} · ${fmtSize(total)}. Anexe arquivos no Diário de cada dia ou dentro de uma tarefa ou evento.</p>
      <div class="fgrid">${all.map(f => `<div class="fcard"><button class="fth big" data-fid="${f.id}" data-act="fileOpen" data-id="${f.id}">${ic(Files.icon(f))}</button><b title="${esc(f.name)}">${esc(cut(f.name, 40))}</b><span>${fmtSize(f.size)} · ${fmtDs(new Date(f.created))}</span><button class="link" data-act="fOwner" data-id="${f.id}">${ic(f.owner.startsWith('note') ? 'book' : 'check')}${esc(cut(Files.ownerText(f), 30))}</button><div class="inl"><button class="icon sm" data-act="fileDl" data-id="${f.id}" title="Baixar">${ic('dl')}</button><button class="icon sm" data-act="fileDel" data-id="${f.id}" title="Remover">${ic('trash')}</button></div></div>`).join('') || '<p class="empty">Nenhum arquivo aqui.</p>'}</div></div>`;
    Files.thumbs(el);
    $('#fq', el).oninput = debounce(e => { FilesView.q = e.target.value; App.renderMain(); const x = $('#fq'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 250);
  },
};
Actions.fKind = el => { FilesView.kind = el.dataset.k; App.renderMain(); };
Actions.fOwner = el => { const f = Files.meta(el.dataset.id), [k, id] = f.owner.split(/:(.*)/); if (k === 'note') App.go('journal', null, id); else { const it = Ops.get(id); if (it) Editor.open(it); } };

// soltar arquivos em qualquer lugar: vão para o diário aberto (ou para o dia em foco)
addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
addEventListener('drop', e => {
  if (!e.dataTransfer || !e.dataTransfer.files.length || e.target.closest('.rte,.mback')) return;
  e.preventDefault();
  attachToNote([...e.dataTransfer.files], App.view === 'journal' ? App.noteKey : ymd(App.cur));
});
