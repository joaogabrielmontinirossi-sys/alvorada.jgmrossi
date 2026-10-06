'use strict';
/* Alvorada — ajustes, sincronização (tela), calendários, listas, etiquetas, paleta de comandos, disponibilidade e backup */

const Settings = {
  tab: 'geral',
  open(tab) {
    if (tab) Settings.tab = tab;
    const TABS = { geral: 'Geral', cal: 'Calendário', look: 'Aparência', notif: 'Avisos', sync: 'Sincronização', data: 'Dados' };
    const m = modal({ title: 'Ajustes', wide: true, cls: 'settings', body: `<div class="stabs">${Object.entries(TABS).map(([k, v]) => `<button data-tab="${k}">${v}</button>`).join('')}</div><div id="sbody"></div>` });
    const body = $('#sbody', m.el), s = S.set;
    const sel = (k, opts, t) => `<select data-s="${k}"${t ? ` data-t="${t}"` : ''}>${opts.map(([v, l]) => `<option value="${v}"${String(s[k]) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    const chk = (k, l) => `<label class="ckl"><input type="checkbox" data-s="${k}"${s[k] ? ' checked' : ''}> ${l}</label>`;
    const row = (l, c) => `<div class="setrow"><label>${l}</label><div>${c}</div></div>`;
    const hours = [...Array(25).keys()].map(h => [h, pad(h) + ':00']);
    const draw = () => {
      $$('.stabs button', m.el).forEach(b => b.classList.toggle('on', b.dataset.tab === Settings.tab));
      const t = Settings.tab;
      body.innerHTML = t === 'geral' ? `
        ${row('Abrir o aplicativo em', sel('startView', [['last', 'Última visão usada'], ...['day', 'week', 'month', 'agenda', 'tasks', 'journal'].map(k => [k, Views[k].label])]))}
        ${row('A semana começa em', sel('weekStart', [[0, 'Domingo'], [1, 'Segunda-feira'], [6, 'Sábado']], 'int'))}
        ${row('Formato de hora', sel('h24', [[true, '24 horas (14:30)'], [false, '12 horas (2:30pm)']], 'bool'))}
        ${row('Duração padrão dos eventos', sel('defDur', [15, 30, 45, 60, 90, 120].map(v => [v, fmtDur(v)]), 'int'))}
        ${row('Calendário padrão', `<select data-s="defCal">${S.calendars.filter(c => !c.ro).map(c => `<option value="${c.id}"${c.id === defCal() ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`)}
        ${row('Lembrete padrão de novos eventos', `<select id="sdr">${[['', 'Nenhum'], ...REM_OPTS.map(r => [r, fmtRem(r)])].map(([v, l]) => `<option value="${v}"${String(s.defRem[0] === undefined ? '' : s.defRem[0]) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}
        ${row('Tarefas', chk('autoDone', 'Concluir a tarefa-mãe quando todas as subtarefas terminarem') + chk('shiftDeps', 'Ao mover um item, oferecer mover também os dependentes'))}
        ${row('Seu nome', `<input data-s="me" value="${esc(s.me)}" placeholder="Aparece nos convites" maxlength="60">`)}`
        : t === 'cal' ? `
        ${row('Dias de trabalho', `<div class="dows" id="swd">${[0, 1, 2, 3, 4, 5, 6].map(d => `<button type="button" data-d="${d}" class="${s.workDays.includes(d) ? 'on' : ''}">${DOW3[d]}</button>`).join('')}</div>`)}
        ${row('Horário de trabalho', `<div class="inl">${sel('workStart', hours.slice(0, 24), 'int')}<span>até</span>${sel('workEnd', hours.slice(1), 'int')}</div>`)}
        ${row('Precisão ao arrastar na grade', sel('slot', [[5, '5 minutos'], [10, '10 minutos'], [15, '15 minutos'], [30, '30 minutos'], [60, '1 hora']], 'int'))}
        ${row('Visão de vários dias', sel('nDays', [2, 3, 4, 5, 6, 7, 10, 14].map(n => [n, n + ' dias']), 'int'))}
        ${row('Mostrar', chk('weekends', 'Fins de semana') + chk('weekNums', 'Número da semana') + chk('holidays', 'Feriados nacionais do Brasil') + chk('moon', 'Fases da lua') + chk('showDone', 'Tarefas concluídas') + chk('showDeclined', 'Eventos recusados') + chk('dimPast', 'Esmaecer o que já passou'))}
        ${row('Segundo fuso horário na grade', sel('tz2', [['', 'Nenhum'], ...TZS.map(z => [z, z.replace(/_/g, ' ')])]))}
        ${row('Relógios na barra lateral', `<div class="chips">${s.clocks.map((z, i) => `<span class="chipx">${esc(z.split('/').pop().replace(/_/g, ' '))} ${timeIn(z, new Date())}<button data-x="clock" data-i="${i}">×</button></span>`).join('')}<select id="sclk"><option value="">+ adicionar cidade</option>${TZS.filter(z => !s.clocks.includes(z)).map(z => `<option>${z}</option>`).join('')}</select></div>`)}`
        : t === 'look' ? `
        ${row('Tema', sel('theme', [['auto', 'Automático (segue o sistema)'], ['light', 'Claro'], ['dark', 'Escuro']]))}
        ${row('Cor de destaque', colorDots(s.accent))}
        ${row('Densidade', sel('density', [['compact', 'Compacta'], ['normal', 'Normal'], ['comfy', 'Confortável']]))}
        ${row('Letra', sel('font', [['sans', 'Padrão'], ['serif', 'Serifada'], ['round', 'Arredondada'], ['mono', 'Monoespaçada']]))}
        ${row('Barra lateral', chk('side', 'Mostrar a barra lateral') + chk('panel', 'Mostrar o painel de tarefas ao lado do calendário'))}`
        : t === 'notif' ? `
        ${row('Notificações do sistema', `<p class="muted">${'Notification' in window ? (Notification.permission === 'granted' && s.notif ? 'Ativadas neste aparelho.' : Notification.permission === 'denied' ? 'Bloqueadas nas permissões do navegador para este site.' : 'Desativadas.') : 'Este navegador não tem notificações.'} Os avisos tocam enquanto o Alvorada está aberto (janela, aba ou app instalado em segundo plano).</p><div class="inl"><button class="btn sm" data-x="notif">${s.notif ? 'Pedir permissão de novo' : 'Ativar notificações'}</button><button class="btn ghost sm" data-x="notiftest">Testar aviso</button></div>`)}
        ${row('Som', chk('sound', 'Tocar som nos avisos e ao concluir tarefas'))}
        <p class="muted">Cada evento, tarefa ou lembrete pode ter vários avisos (na hora, minutos, horas, dias ou semanas antes). Para itens de dia inteiro, o aviso conta a partir das 9h. Quando um aviso toca, dá para adiá-lo por 10 minutos.</p>`
        : t === 'sync' ? Settings.syncHtml() : `
        ${row('Backup', `<div class="inl wrap"><button class="btn sm" data-x="bk">${ic('dl')} Exportar backup</button><button class="btn ghost sm" data-x="bkf">${ic('dl')} Exportar com arquivos</button><button class="btn ghost sm" data-x="bki">${ic('up')} Importar backup…</button></div><p class="muted">O backup (.json) leva calendários, itens, anotações, etiquetas, listas, hábitos e modelos.</p>`)}
        ${row('iCalendar (.ics)', `<div class="inl wrap"><button class="btn ghost sm" data-x="icsi">${ic('up')} Importar .ics…</button><button class="btn ghost sm" data-x="icse">${ic('dl')} Exportar tudo em .ics</button><button class="btn ghost sm" data-x="icss">${ic('link')} Assinar por endereço…</button></div><p class="muted">Funciona com Google Agenda, Outlook, Apple Calendário e qualquer programa que use .ics.</p>`)}
        ${row('Modelos de itens', `<button class="btn ghost sm" data-x="tpl">Gerenciar modelos (${S.templates.length})</button>`)}
        ${row('Armazenamento', `<p class="muted">${DB.persistent() ? 'Dados guardados neste aparelho (IndexedDB).' : 'Atenção: este navegador não permitiu guardar dados; tudo se perde ao fechar.'} ${count(S.items.length, 'item', 'itens')}, ${count(S.notes.length, 'anotação', 'anotações')}, ${count(S.filemeta.length, 'arquivo', 'arquivos')} (${fmtSize(S.filemeta.reduce((n, f) => n + f.size, 0))}).</p><button class="btn ghost sm danger" data-x="wipe">Apagar tudo deste aparelho…</button>`)}
        <p class="muted">Alvorada 1.0 · <a href="https://github.com/joaogabrielmontinirossi-sys/alvorada.jgmrossi" target="_blank" rel="noopener">código e ajuda</a></p>`;
      if (t === 'look') bindDots(body, c => { s.accent = c; Store.saveSet(); applyTheme(); });
    };
    Settings.redraw = () => { if (m.el.isConnected) draw(); };
    m.el.addEventListener('click', async e => {
      const tb = e.target.closest('.stabs button'); if (tb) { Settings.tab = tb.dataset.tab; return draw(); }
      const wd = e.target.closest('#swd button'); if (wd) { const d = +wd.dataset.d, i = s.workDays.indexOf(d); i < 0 ? s.workDays.push(d) : s.workDays.splice(i, 1); Store.saveSet(); App.render(); return draw(); }
      const b = e.target.closest('[data-x]'); if (!b) return;
      const x = b.dataset.x;
      if (x === 'clock') { s.clocks.splice(+b.dataset.i, 1); Store.saveSet(); App.render(); draw(); }
      else if (x === 'notif') { await Notif.ask(); draw(); }
      else if (x === 'notiftest') { beep('alarm'); Notif.show('Alvorada', 'É assim que um lembrete aparece.', 'teste'); toast('🔔 Aviso de teste'); }
      else if (x === 'bk' || x === 'bkf') Backup.export(x === 'bkf');
      else if (x === 'bki') Files.pick(fs => Backup.import(fs[0]), '.json,application/json');
      else if (x === 'icsi') Backup.icsPick();
      else if (x === 'icse') download('alvorada.ics', ICS.export(S.items.filter(live)), 'text/calendar');
      else if (x === 'icss') { m.close(); calEdit(null, true); }
      else if (x === 'tpl') Settings.templates();
      else if (x === 'wipe') { if (await confirmBox('Apagar todos os dados do Alvorada neste aparelho? Se a sincronização estiver ligada, a cópia sincronizada continua existindo.', 'Apagar tudo', true)) { indexedDB.deleteDatabase('alvorada'); localStorage.clear(); location.reload(); } }
      else Settings.syncAct(x, b, draw);
    });
    m.el.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'sdr') s.defRem = t.value === '' ? [] : [+t.value];
      else if (t.id === 'sclk') { if (t.value) s.clocks.push(t.value); }
      else if (t.dataset.g) { s.gCals[t.dataset.g] = t.checked; Store.kv('gsync', { tokens: {}, list: [] }); }
      else if (t.dataset.s) { const k = t.dataset.s; s[k] = t.type === 'checkbox' ? t.checked : t.dataset.t === 'int' ? +t.value : t.dataset.t === 'bool' ? t.value === 'true' : t.value; if (k === 'workEnd' && s.workEnd <= s.workStart) s.workEnd = s.workStart + 1; }
      else return;
      Store.saveSet(); applyTheme(); Cal.scroll = Cal.scroll; App.render();
      if (t.id === 'sclk' || t.dataset.s === 'gDrive' || t.dataset.s === 'gCal') draw();
    });
    draw();
  },
  syncHtml() {
    const s = S.set, g = Sync.g, on = Sync.gOn(), list = Store.kv('gsync', { tokens: {}, list: [] }).list;
    return `<h4>${ic('folder')} Pasta do Google Drive para computador</h4>
      ${Sync.avail ? `<p class="muted">Como nos seus outros aplicativos: o Alvorada grava <b>alvorada-sync.json</b> (e a subpasta <b>arquivos</b>) numa pasta sincronizada, e o Drive leva aos outros computadores.</p>
        <p>${Sync.on ? `Ativa em <b>${esc(Sync.folder || '')}</b>${Sync.error ? `<br><span class="err">${esc(Sync.error)}</span>` : Sync.last ? ` · ${fmtRel(Sync.last)}` : ''}` : 'Desativada.'}</p>
        <div class="inl wrap">${Sync.on ? '<button class="btn ghost sm" data-x="foff">Desativar</button>' : Sync.detected ? '<button class="btn sm" data-x="fauto">Ativar no Google Drive</button>' : ''}${Sync.drives.filter(d => d !== Sync.folder).map((d, i) => `<button class="btn ghost sm" data-x="fdrive" data-i="${i}">Usar ${esc(d.slice(0, 2))}</button>`).join('')}<button class="btn ghost sm" data-x="fpick">Escolher outra pasta…</button></div>`
      : '<p class="muted">Disponível no programa de Windows (Alvorada.exe). No site e no celular, use a conta Google abaixo.</p>'}
      <h4>${ic('globe')} Conta Google: Windows, site e celular</h4>
      <p class="muted">Com a sua conta Google, os mesmos dados aparecem no .exe, no site e no celular (ficam na área privada do aplicativo no seu Google Drive), e os eventos sincronizam nos dois sentidos com o <b>Google Agenda</b>. O Google exige que cada aplicativo tenha um “ID do cliente”; ele é gratuito e você cria uma vez só. <button class="link" data-x="gguide">Ver o passo a passo</button></p>
      <label>ID do cliente OAuth</label><input data-s="gClient" value="${esc(s.gClient)}" placeholder="0000000000-xxxxxxxx.apps.googleusercontent.com" autocomplete="off" spellcheck="false">
      <div class="cks"><label class="ckl"><input type="checkbox" data-s="gDrive"${s.gDrive ? ' checked' : ''}> Sincronizar todos os dados do Alvorada entre aparelhos (Google Drive)</label><label class="ckl"><input type="checkbox" data-s="gCal"${s.gCal ? ' checked' : ''}> Sincronizar eventos com o Google Agenda</label></div>
      <p>${on ? `Conectado${g.error ? `<br><span class="err">${esc(g.error)}</span>` : g.last ? ` · sincronizado ${fmtRel(g.last)}` : ''}` : s.gWas ? '<span class="err">A sessão do Google expirou (ela dura cerca de 1 hora). Clique em Reconectar.</span>' : 'Não conectado.'}</p>
      <div class="inl wrap"><button class="btn sm" data-x="gcon">${on ? 'Reconectar' : s.gWas ? 'Reconectar' : 'Conectar ao Google'}</button>${on ? '<button class="btn ghost sm" data-x="gnow">Sincronizar agora</button>' : ''}${on || s.gWas ? '<button class="btn ghost sm" data-x="goff">Desconectar</button>' : ''}</div>
      ${list.length && s.gCal ? `<label>Agendas do Google a sincronizar</label><div class="cks">${list.map(c => `<label class="ckl"><input type="checkbox" data-g="${esc(c.id)}"${(s.gCals[c.id] !== undefined ? s.gCals[c.id] : (c.primary || (c.selected && !c.ro))) ? ' checked' : ''}> <i class="dot" style="background:${esc(c.color || '#888')}"></i> ${esc(c.name)}${c.ro ? ' <small>(somente leitura)</small>' : ''}</label>`).join('')}</div>` : ''}
      <p class="muted">Tarefas, lembretes, anotações e arquivos não existem no Google Agenda: eles seguem pelo Google Drive. Sem conta Google, use <b>Dados › Exportar backup</b> ou arquivos .ics para levar e trazer.</p>`;
  },
  async syncAct(x, b, draw) {
    const wrap = async fn => { b.disabled = true; try { await fn(); } catch (e) { toast(e.message || 'Não foi possível concluir'); } draw(); App.render(true); App.renderFoot(); };
    if (x === 'foff') wrap(() => Sync.config('off'));
    else if (x === 'fauto') wrap(() => Sync.config('auto'));
    else if (x === 'fdrive') wrap(() => Sync.config(Sync.drives.filter(d => d !== Sync.folder)[+b.dataset.i]));
    else if (x === 'fpick') wrap(() => Sync.config('choose'));
    else if (x === 'gcon') { const v = $('[data-s=gClient]').value.trim(); if (!/\.apps\.googleusercontent\.com$/.test(v)) return toast('Cole o ID do cliente OAuth (termina em .apps.googleusercontent.com)'); S.set.gClient = v; Store.saveSet(); wrap(() => Sync.connect()); }
    else if (x === 'gnow') wrap(() => Sync.run(true));
    else if (x === 'goff') { Sync.disconnect(); draw(); App.renderFoot(); }
    else if (x === 'gguide') modal({ title: 'Como criar o ID do cliente do Google', wide: true, body: `<ol class="guide">
      <li>Abra <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">console.cloud.google.com</a> com a sua conta Google e crie um projeto (qualquer nome, por exemplo “Alvorada”).</li>
      <li>Em <b>APIs e serviços › Biblioteca</b>, ative a <b>Google Calendar API</b> e a <b>Google Drive API</b>.</li>
      <li>Em <b>APIs e serviços › Tela de permissão OAuth</b>, escolha o tipo <b>Externo</b>, preencha o nome do app e o seu e-mail, e em <b>Usuários de teste</b> adicione o seu próprio e-mail.</li>
      <li>Em <b>APIs e serviços › Credenciais</b>, clique em <b>Criar credenciais › ID do cliente OAuth</b>, tipo <b>Aplicativo da Web</b>. Em <b>Origens JavaScript autorizadas</b>, adicione estes endereços:<br><code>https://joaogabrielmontinirossi-sys.github.io</code><br><code>http://localhost:47841</code>${/github\.io|localhost:47841/.test(location.origin) ? '' : `<br><code>${esc(location.origin)}</code>`}</li>
      <li>Copie o <b>ID do cliente</b> (termina em <code>.apps.googleusercontent.com</code>), cole no Alvorada e clique em <b>Conectar ao Google</b>. Repita só a colagem em cada aparelho.</li></ol>
      <p class="muted">O ID do cliente não é uma senha: ele só identifica o aplicativo. O acesso aos seus dados é autorizado por você na janela do próprio Google, e pode ser revogado em myaccount.google.com › Segurança. Enquanto o app estiver em modo de teste, o Google mostra um aviso de “app não verificado” e a sessão precisa ser renovada de tempos em tempos.</p>` });
  },
  shortcuts() {
    const K = [['C', 'Criar'], ['O', 'Adição rápida (linguagem natural)'], ['Ctrl+K ou /', 'Pesquisar e comandos'], ['H', 'Hoje'], ['← →', 'Período anterior / próximo'], ['I', 'Ir para uma data'], ['D S U M A G', 'Dia, Semana, dias Úteis, Mês, Ano, aGenda'], ['2…9', 'Visão de N dias'], ['T Q Z L', 'Tarefas, Quadro, matriZ, Linha do tempo'], ['J B R N E', 'diário (Journal), háBitos, aRquivos, coNexões, Estatísticas'], ['P', 'Painel de tarefas'], ['F', 'Filtros'], ['Ctrl+\\', 'Barra lateral'], ['Ctrl+Z / Ctrl+Y', 'Desfazer / refazer'], ['E, Del, Espaço', 'No cartão aberto: editar, excluir, concluir'], ['Ctrl+Enter', 'Salvar no editor'], ['Duplo clique', 'Abrir o editor completo'], ['Botão direito', 'Menu do item'], ['Esc', 'Fechar'], [',', 'Ajustes']];
    modal({ title: 'Atalhos de teclado', body: `<div class="keys">${K.map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div><p class="muted">Na adição rápida: datas (“amanhã”, “sexta”, “25/12”, “em 3 dias”), horas (“14h”, “9h-10h30”, “por 2h”), repetição (“toda segunda”, “todo mês”, “dias úteis”), <b>#etiqueta</b>, <b>!alta</b>, <b>@local</b>, <b>~lista</b> e os prefixos <b>tarefa:</b> e <b>lembrete:</b>.</p>` });
  },
  templates() {
    const m = modal({ title: 'Modelos', body: '<div id="tpl"></div><p class="muted">Para criar um modelo, abra o menu ⋯ de um item e escolha “Salvar como modelo”.</p>' });
    const draw = () => { $('#tpl', m.el).innerHTML = S.templates.map(t => `<div class="srow"><span class="sname">${ic('star')}${esc(t.name)} <small>${TYPES[t.item.type] || ''}</small></span><button class="icon sm" data-id="${t.id}">${ic('trash')}</button></div>`).join('') || '<p class="empty">Nenhum modelo salvo.</p>'; };
    $('#tpl', m.el).onclick = e => { const b = e.target.closest('button'); if (b) { Data.del('templates', b.dataset.id); draw(); } };
    draw();
  },
  tagMenu(el) {
    const t = byId(S.tags, el.dataset.id); if (!t) return;
    menu(el, [{ label: 'Renomear', icon: 'edit', fn: async () => { const n = await ask('Renomear etiqueta', t.name); if (n) { t.name = n; Data.put('tags', t); App.render(); } } },
      { label: 'Cor…', icon: 'circle', fn: () => setTimeout(() => menu(el, PALETTE.map(([n, c]) => ({ label: n, color: c, checked: t.color === c, fn: () => { t.color = c; Data.put('tags', t); App.render(); } }))), 0) },
      { label: 'Ver itens com esta etiqueta', icon: 'search', fn: () => { Filter.tags = [t.id]; S.set.taskTab = 'all'; App.go('agenda'); } },
      { label: 'Excluir', icon: 'trash', danger: true, fn: () => { S.items.filter(i => i.tags.includes(t.id)).forEach(i => { i.tags = i.tags.filter(x => x !== t.id); Data.put('items', i, true); }); Filter.tags = Filter.tags.filter(x => x !== t.id); Data.del('tags', t.id); App.render(); } }]);
  },
};

/* ---------- Calendários, listas e etiquetas ---------- */
function calEdit(cal, sub) {
  const isNew = !cal; cal = cal || NORM.calendars({ id: uid(), name: '', color: PALETTE[(S.calendars.length * 3) % 16][1], order: S.calendars.length });
  const m = modal({ title: isNew ? (sub ? 'Assinar calendário por endereço' : 'Novo calendário') : 'Editar calendário', body: `<label>Nome</label><input id="cn" value="${esc(cal.name)}" maxlength="60" placeholder="Ex.: Família, Estudos, Jogos do time">
    ${sub || cal.url ? `<label>Endereço do calendário (.ics)</label><input id="cu" value="${esc(cal.url)}" placeholder="https://… ou webcal://…" maxlength="800"><p class="muted">Calendários públicos de feriados, times, faculdades, Outlook, Google (endereço secreto em iCal)… Atualiza sozinho a cada 6 horas e fica somente para leitura.</p>` : ''}
    <label>Cor</label>${colorDots(cal.color)}<div class="mfoot"><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="cok">Salvar</button></div>` });
  bindDots(m.el, c => { cal.color = c; });
  $('#cok', m.el).onclick = () => {
    const u = $('#cu', m.el);
    if (u) { cal.url = u.value.trim(); if (!/^(https?|webcal):\/\//i.test(cal.url)) return toast('Informe um endereço que comece com https:// ou webcal://'); cal.ro = true; }
    cal.name = $('#cn', m.el).value.trim() || (cal.url ? 'Calendário assinado' : 'Calendário');
    Data.put('calendars', cal); m.close(); App.render();
    if (cal.url) Sync.subs(cal.id);
  };
}
Actions.calAdd = el => menu(el, [{ label: 'Novo calendário', icon: 'plus', fn: () => calEdit() }, { label: 'Assinar por endereço (.ics)', icon: 'link', fn: () => calEdit(null, true) }, { label: 'Importar arquivo .ics', icon: 'up', fn: () => Backup.icsPick() }, { label: 'Conectar ao Google Agenda', icon: 'globe', fn: () => Settings.open('sync') }]);
Actions.calMenu = el => {
  const c = byId(S.calendars, el.dataset.id), its = S.items.filter(i => i.cal === c.id);
  menu(el, [{ label: 'Mostrar só este', icon: 'eye', fn: () => { S.set.hideCals = {}; S.calendars.forEach(x => { if (x.id !== c.id) S.set.hideCals[x.id] = 1; }); Store.saveSet(); App.render(); } },
    { label: 'Mostrar todos', icon: 'eye', fn: () => { S.set.hideCals = {}; Store.saveSet(); App.render(); } },
    { label: 'Editar nome e cor', icon: 'edit', fn: () => calEdit(c) },
    !c.ro && { label: 'Definir como padrão', icon: 'star', checked: c.id === defCal(), fn: () => { S.set.defCal = c.id; Store.saveSet(); App.render(); } },
    c.url && { label: 'Atualizar agora', icon: 'sync', fn: () => Sync.subs(c.id) },
    { label: 'Exportar .ics', icon: 'dl', fn: () => download(c.name.replace(/[\\/:*?"<>|]/g, ' ') + '.ics', ICS.export(its.filter(live), c.name), 'text/calendar') },
    '-',
    { label: 'Excluir calendário', icon: 'trash', danger: true, fn: async () => {
      if (S.calendars.length < 2) return toast('É preciso manter ao menos um calendário');
      const other = S.calendars.find(x => x.id !== c.id && !x.ro) || S.calendars.find(x => x.id !== c.id);
      const v = c.ro || !its.length ? (await confirmBox(`Excluir o calendário "${c.name}"${its.length ? ` e ${count(its.length, 'item', 'itens')}` : ''}?`, 'Excluir', true) ? 'del' : null) : await pick(`Excluir "${c.name}"`, [{ v: 'move', label: `Mover os ${its.length} itens para "${other.name}"` }, { v: 'del', label: 'Excluir também os itens', desc: 'Eles vão para a lixeira (os do Google são removidos de lá na próxima sincronização).' }]);
      if (!v) return;
      its.forEach(i => { if (v === 'move') { i.cal = other.id; Data.put('items', i); } else if (c.ro) Data.del('items', i.id); else { i.deleted = Date.now(); i.cal = c.gid ? i.cal : other.id; Data.put('items', i); } });
      if (c.gid) { S.set.gCals[c.gid] = false; Store.saveSet(); }
      Data.del('calendars', c.id); if (S.set.defCal === c.id) S.set.defCal = ''; App.render();
    } }]);
};
function listEdit(l) {
  const isNew = !l; l = l || NORM.lists({ id: uid(), name: '', color: PALETTE[(S.lists.length * 5 + 2) % 16][1] });
  const m = modal({ title: isNew ? 'Nova lista ou projeto' : 'Editar lista', body: `<div class="row2"><div><label>Nome</label><input id="ln" value="${esc(l.name)}" maxlength="60" placeholder="Ex.: Casa, TCC, Viagem"></div><div><label>Ícone (emoji)</label><input id="li" value="${esc(l.icon)}" maxlength="4" placeholder="🏠"></div></div><label>Cor</label>${colorDots(l.color)}<div class="mfoot"><button class="btn ghost" data-close>Cancelar</button><button class="btn" id="lok">Salvar</button></div>` });
  bindDots(m.el, c => { l.color = c; });
  $('#lok', m.el).onclick = () => { l.name = $('#ln', m.el).value.trim() || 'Lista'; l.icon = $('#li', m.el).value.trim(); Data.put('lists', l); m.close(); App.render(); };
}
Actions.listAdd = () => listEdit();
Actions.listMenu = el => { const l = byId(S.lists, el.dataset.id); menu(el, [{ label: 'Editar', icon: 'edit', fn: () => listEdit(l) }, { label: 'Ver no quadro', icon: 'board', fn: () => { Filter.lists = [l.id]; App.go('board'); } }, { label: 'Ver na linha do tempo', icon: 'gantt', fn: () => { Filter.lists = [l.id]; App.go('timeline'); } }, { label: 'Arquivar', icon: 'inbox', fn: () => { l.archived = true; Data.put('lists', l); Filter.lists = []; App.render(); } }, { label: 'Excluir lista', icon: 'trash', danger: true, fn: () => { S.items.filter(i => i.list === l.id).forEach(i => { i.list = ''; Data.put('items', i, true); }); Filter.lists = []; Data.del('lists', l.id); App.render(); toast('Lista excluída; as tarefas foram mantidas', { label: 'Desfazer', fn: () => Hist.undo() }); } }]); };
Actions.tagAdd = async () => { const n = await ask('Nova etiqueta', '', 'ex.: urgente, casa, estudo', 'Criar'); if (n) { ensureTag(n.replace(/^#/, '')); App.render(); } };

/* ---------- Paleta: pesquisa e comandos ---------- */
const Palette = {
  open() {
    if ($('.palette')) return;
    const cmds = [
      ...Object.keys(Views).filter(k => k !== 'trash').map(k => ({ label: 'Ir para: ' + Views[k].label, icon: Views[k].icon, hint: Views[k].key, fn: () => App.go(k) })),
      { label: 'Hoje', icon: 'today', hint: 'H', fn: () => Actions.today() }, { label: 'Ir para uma data…', icon: 'today', hint: 'I', fn: () => Actions.goto() },
      { label: 'Novo evento', icon: 'cal', fn: () => Editor.open(newItem('event', { scope: 'time', start: iso(addMin(new Date(), 60)).slice(0, 14) + '00', end: iso(addMin(new Date(), 60 + S.set.defDur)).slice(0, 14) + '00' })) },
      { label: 'Nova tarefa', icon: 'check', fn: () => Editor.open(newItem('task', { scope: 'day', start: ymd(App.cur) })) }, { label: 'Novo lembrete', icon: 'bell', fn: () => Editor.open(newItem('reminder', { scope: 'time', start: iso(addMin(new Date(), 60)), rem: [0] })) },
      { label: 'Diário de hoje', icon: 'book', fn: () => App.go('journal', today()) }, { label: 'Novo hábito', icon: 'heart', fn: () => habitEdit() }, { label: 'Novo calendário', icon: 'plus', fn: () => calEdit() }, { label: 'Nova lista ou projeto', icon: 'folder', fn: () => listEdit() },
      { label: 'Encontrar horário livre / disponibilidade', icon: 'users', fn: () => Avail.open() }, { label: 'Sincronizar agora', icon: 'sync', fn: () => Sync.any() ? Sync.run(true) : Settings.open('sync') },
      { label: 'Tema claro', icon: 'sun', fn: () => { S.set.theme = 'light'; Store.saveSet(); applyTheme(); } }, { label: 'Tema escuro', icon: 'sun', fn: () => { S.set.theme = 'dark'; Store.saveSet(); applyTheme(); } },
      { label: 'Mostrar ou ocultar fins de semana', icon: 'eye', fn: () => { S.set.weekends = !S.set.weekends; Store.saveSet(); App.render(); } }, { label: 'Mostrar ou ocultar concluídas', icon: 'eye', fn: () => { S.set.showDone = !S.set.showDone; Store.saveSet(); App.render(); } },
      { label: 'Exportar backup', icon: 'dl', fn: () => Backup.export() }, { label: 'Importar arquivo .ics', icon: 'up', fn: () => Backup.icsPick() }, { label: 'Imprimir', icon: 'print', fn: () => print() }, { label: 'Lixeira', icon: 'trash', fn: () => App.go('trash') },
      { label: 'Atalhos de teclado', icon: 'cmd', fn: () => Settings.shortcuts() }, { label: 'Ajustes', icon: 'gear', fn: () => Settings.open() }, { label: 'Ajustes de sincronização', icon: 'sync', fn: () => Settings.open('sync') },
    ];
    const m = modal({ title: '', cls: 'palette', body: `<div class="qadd big">${ic('search')}<input id="pq" placeholder="Pesquisar itens, anotações e arquivos, ou digitar um comando" autocomplete="off" autofocus></div><div id="pres"></div><p class="muted">↑ ↓ para escolher · Enter para abrir · Esc para fechar</p>` });
    let res = [], cur = 0;
    const paint = () => {
      const raw = $('#pq', m.el).value.trim(), q = norm(raw);
      res = [];
      if (q) {
        const p = parseQuick(raw, null);
        res.push({ label: `Criar: ${p.title || raw}`, sub: p.found ? whenText(normItem(Object.assign({ type: 'task' }, p))) : 'tarefa sem data', icon: 'plus', fn: () => { if (!p.found) { p.scope = 'none'; p.start = ''; } const it = Ops.create(Object.assign({ type: p.timed ? 'event' : 'task' }, p)); App.render(); toast('Criado: ' + cut(it.title, 40), { label: 'Abrir', fn: () => Editor.open(it) }); } });
        if (p.found && p.start && !p.title) res.push({ label: 'Ir para ' + whenText(normItem(Object.assign({ type: 'task' }, p))), icon: 'today', fn: () => App.go(null, p.scope === 'week' ? weekStartOf(p.start) : pd(p.start)) });
        S.items.filter(i => !i.deleted && norm(i.title + ' ' + i.loc + ' ' + i.tags.join(' ') + ' ' + plain(i.desc) + ' ' + i.check.map(c => c.text).join(' ') + ' ' + i.guests.map(g => g.email + ' ' + g.name).join(' ')).includes(q)).sort((a, b) => (norm(b.title).startsWith(q) - norm(a.title).startsWith(q)) || b.updated - a.updated).slice(0, 25)
          .forEach(i => res.push({ label: i.title || '(sem título)', sub: `${TYPES[i.type]} · ${whenText(i)}${isDone(i) ? ' · concluída' : ''}`, icon: typeIcon(i), color: colorOf(i), fn: () => { const d = tdate(i) || (span(i) || {}).s; if (d && Views[App.view].group === 'cal') App.go(null, i.rrule ? nextOcc(i, today()) || d : d); setTimeout(() => openPop(getOcc(i.id, i.rrule ? tkey(i) : ''), $(`[data-id="${i.id}"]`)), 60); } }));
        S.notes.filter(n => norm((n.title || '') + ' ' + plain(n.html)).includes(q)).slice(0, 10).forEach(n => { const t = plain(n.html), ix = norm(t).indexOf(q); res.push({ label: noteTitle(n.id), sub: 'Diário · ' + cut((ix > 30 ? '…' : '') + t.slice(Math.max(0, ix - 30)), 80), icon: 'book', fn: () => App.go('journal', null, n.id) }); });
        S.filemeta.filter(f => norm(f.name).includes(q)).slice(0, 8).forEach(f => res.push({ label: f.name, sub: 'Arquivo · ' + Files.ownerText(f), icon: 'clip', fn: () => Files.open(f.id) }));
        S.tags.filter(t => norm(t.name).includes(q)).slice(0, 4).forEach(t => res.push({ label: 'Filtrar por #' + t.name, icon: 'tag', color: t.color, fn: () => { Filter.tags = [t.id]; App.render(); } }));
        res.push({ label: `Filtrar tudo por “${raw}”`, icon: 'filter', fn: () => { Filter.q = raw; App.render(); } });
      }
      cmds.filter(c => !q || norm(c.label).includes(q)).slice(0, q ? 8 : 40).forEach(c => res.push(c));
      cur = clamp(cur, 0, Math.max(0, res.length - 1));
      $('#pres', m.el).innerHTML = res.map((r, i) => `<button class="pal${i === cur ? ' on' : ''}" data-i="${i}">${r.color ? `<i class="dot" style="background:${r.color}"></i>` : ic(r.icon)}<span><b>${esc(cut(r.label, 70))}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span>${r.hint ? `<kbd>${r.hint}</kbd>` : ''}</button>`).join('');
      const on = $('.pal.on', m.el); if (on) on.scrollIntoView({ block: 'nearest' });
    };
    const run = i => { const r = res[i]; if (!r) return; m.close(); r.fn(); };
    $('#pq', m.el).oninput = () => { cur = 0; paint(); };
    m.el.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); cur++; paint(); } else if (e.key === 'ArrowUp') { e.preventDefault(); cur--; paint(); } else if (e.key === 'Enter') { e.preventDefault(); run(cur); } });
    $('#pres', m.el).onclick = e => { const b = e.target.closest('.pal'); if (b) run(+b.dataset.i); };
    paint();
  },
};

/* ---------- Disponibilidade: horários livres ---------- */
const Avail = {
  slots(days, min) {
    const out = [], now = new Date();
    for (let i = 0; i < 60 && out.length < days; i++) {
      const d = addD(today(), i); if (!isWorkDay(d)) continue;
      const a = addMin(d, S.set.workStart * 60), b = addMin(d, S.set.workEnd * 60);
      const busy = occs(d, addD(d, 1)).filter(o => o.it.type === 'event' && o.it.busy && o.it.rsvp !== 'no' && (!o.allDay || o.it.kind === 'ooo')).map(o => [Math.max(+o.s, +a), Math.min(+o.e, +b)]).filter(x => x[1] > x[0]).sort((x, y) => x[0] - y[0]);
      const free = []; let t = Math.max(+a, i ? 0 : Math.ceil(+now / 1800000) * 1800000);
      for (const [s, e] of busy) { if (s - t >= min * 60000) free.push([t, s]); t = Math.max(t, e); }
      if (+b - t >= min * 60000) free.push([t, +b]);
      out.push({ d, free });
    }
    return out;
  },
  open() {
    let days = 5, min = 60;
    const m = modal({ title: 'Horários livres', wide: true, body: `<div class="inl wrap"><label>Próximos</label><select id="ad">${[3, 5, 7, 10, 14].map(n => `<option value="${n}"${n === 5 ? ' selected' : ''}>${n} dias úteis</option>`).join('')}</select><label>com pelo menos</label><select id="am">${[15, 30, 45, 60, 90, 120, 180].map(n => `<option value="${n}"${n === 60 ? ' selected' : ''}>${fmtDur(n)}</option>`).join('')}</select></div><p class="muted">Considera seu horário de trabalho (${pad(S.set.workStart)}h às ${pad(S.set.workEnd)}h) e os eventos marcados como “ocupado” nos calendários visíveis. Clique num horário para criar um evento, ou copie o texto para enviar a alguém.</p><div id="av"></div><div class="mfoot"><button class="btn" id="ac">${ic('copy')} Copiar disponibilidade</button></div>` });
    const text = () => 'Tenho disponibilidade nos seguintes horários:\n' + Avail.slots(days, min).filter(x => x.free.length).map(x => `• ${cap(DOW3[x.d.getDay()])}, ${fmtDs(x.d)}: ${x.free.map(([s, e]) => `${fmtT(new Date(s))}–${fmtT(new Date(e))}`).join(', ')}`).join('\n');
    const paint = () => { $('#av', m.el).innerHTML = Avail.slots(days, min).map(x => `<div class="avd"><b>${cap(DOW[x.d.getDay()])}, ${fmtD(x.d)}</b><div>${x.free.map(([s, e]) => `<button class="btn ghost sm" data-s="${s}">${fmtT(new Date(s))} – ${fmtT(new Date(e))}</button>`).join('') || '<span class="muted">sem horário livre</span>'}</div></div>`).join(''); };
    m.el.addEventListener('change', () => { days = +$('#ad', m.el).value; min = +$('#am', m.el).value; paint(); });
    $('#av', m.el).onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; const s = new Date(+b.dataset.s); m.close(); Editor.open(newItem('event', { scope: 'time', start: iso(s), end: iso(addMin(s, min)) })); };
    $('#ac', m.el).onclick = () => copyText(text());
    paint();
  },
};

/* ---------- Backup e .ics ---------- */
const Backup = {
  async export(withFiles) {
    const p = Object.assign(Sync.payload(), { backup: 1, settings: Object.assign({}, S.set, { gWas: false }) });
    if (withFiles) {
      p.files = {};
      for (const f of S.filemeta) { const b = await Files.blob(f.id); if (b) p.files[f.id] = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); }); }
    }
    const d = new Date();
    download(`alvorada-backup-${ymd(d)}.json`, JSON.stringify(p), 'application/json');
    toast('Backup exportado');
  },
  async import(file) {
    let p; try { p = JSON.parse(await file.text()); } catch (e) { return toast('Este arquivo não é um backup válido'); }
    if (!p || p.app !== 'alvorada' || !p.stores) return toast('Este arquivo não é um backup do Alvorada');
    const n = DB.SYNCED.reduce((k, s) => k + (p.stores[s] || []).length, 0);
    if (!await confirmBox(`Importar ${count(n, 'registro', 'registros')} deste backup? Eles são mesclados ao que já existe (em caso de conflito, vale o backup).`, 'Importar')) return;
    const tomb = DB.tomb(), now = Date.now();
    DB.SYNCED.forEach(s => (p.stores[s] || []).forEach(r => { if (r && r.id) { delete tomb[s + ':' + r.id]; r.mod = now; } }));
    DB.saveTomb(); p.tomb = {};
    await Sync.merge(p);
    for (const [id, url] of Object.entries(p.files || {})) { try { await DB.put('files', { id, blob: await (await fetch(url)).blob() }); } catch (e) {} }
    DB.onChange(); App.render(); toast('Backup importado');
  },
  icsPick() {
    Files.pick(async fs => {
      const text = await fs[0].text();
      if (!/BEGIN:VCALENDAR/i.test(text)) return toast('Este arquivo não é um calendário .ics');
      const { name, items } = ICS.import(text);
      const cals = S.calendars.filter(c => !c.ro), v = await pick(`Importar ${count(items.length, 'item', 'itens')}${name ? ` de “${cut(name, 30)}”` : ''}`, [...cals.map(c => ({ v: c.id, label: 'Para o calendário ' + c.name })), { v: 'new', label: 'Criar um calendário novo', desc: name || fs[0].name.replace(/\.ics$/i, '') }]);
      if (!v) return;
      let id = v;
      if (v === 'new') { const c = NORM.calendars({ id: uid(), name: name || fs[0].name.replace(/\.ics$/i, ''), color: PALETTE[(S.calendars.length * 3) % 16][1] }); Data.put('calendars', c); id = c.id; }
      const r = Sync.importIcs(text, id);
      App.render(); toast(`${count(r.total, 'item importado', 'itens importados')}`, { label: 'Desfazer', fn: () => Hist.undo() });
    }, '.ics,text/calendar');
  },
};
