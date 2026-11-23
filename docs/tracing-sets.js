'use strict';
/*
 * tracing-sets.js — 自选描红练习: practice sets a teacher puts together
 * (decided 2026-11-23), e.g. "走之旁的字" with the note "这些都是常见的走之旁的字".
 *
 * It owns:
 *   - the sets in the teacher data: OVERLAY.tracingSets = [
 *       { id, title, note, chars: ['这', …],
 *         extra: { 迍: { pinyin, words: ['…'] } } } ]
 *     `extra` is only for characters that have no card in the app's
 *     character list; a character with a card uses the card's pinyin/words.
 *   - the list of sets on the 每周生字 page, under the writing units;
 *   - opening a set like a writing unit (its cards, its note, and the
 *     📝 生成描红练习 button, which then makes pages from the set);
 *   - the teacher's window to make or change a set, with 按部首找字.
 * Students can open sets and make pages; only teachers change them.
 * It must not: draw the practice pages (tracing-sheet.js) or run the
 * tracing window (tracing-ui.js). Sets are not added to the character list.
 *
 * Why the sets are read from the data tag: the page's own loading code keeps
 * only the teacher-data fields it knows, so `tracingSets` would be dropped.
 * The full text is still in <script id="overlay-data">, so it is read from
 * there once and put back on OVERLAY; from then on the normal saving,
 * export and import carry it (they save the whole OVERLAY object).
 *
 * Opened in a normal browser (no window.desktopApp), this file does nothing.
 */
(function () {
  if (!window.desktopApp || !window.TracingUI) return;

  /* ---- the data -------------------------------------------------------- */
  (function restore() {
    var sets = [];
    try {
      var tag = document.getElementById('overlay-data');
      var raw = tag && tag.textContent.trim() ? JSON.parse(tag.textContent) : {};
      if (Array.isArray(raw.tracingSets)) sets = raw.tracingSets;
    } catch (e) { console.error('自选描红练习读取失败', e); }
    window.OVERLAY.tracingSets = sets.filter(function (s) { return s && s.id; });
  })();
  function sets() { return window.OVERLAY.tracingSets || (window.OVERLAY.tracingSets = []); }
  function findSet(id) { return sets().filter(function (s) { return s.id === id; })[0] || null; }
  function save() { window.queueSave(); }

  var HAN = /[㐀-䶿一-鿿豈-﫿]/;
  function hanChars(text) { return Array.from(String(text || '')).filter(function (c) { return HAN.test(c); }); }
  function uniq(list) { var seen = {}; return list.filter(function (c) { if (seen[c]) return false; seen[c] = true; return true; }); }
  function inLibrary(ch) { return window.getCardsForChar(ch).length > 0; }
  function el(id) { return document.getElementById(id); }
  function esc(s) { return window.escAttr(String(s == null ? '' : s)); }

  /* What the tracing window needs for a set (see tracing-ui.js open()). */
  function sourceFor(set) {
    return { chars: set.chars || [], heading: set.title || '自选描红练习', note: set.note || '', extra: set.extra || {} };
  }

  /* ---- styles ------------------------------------------------------------ */
  var style = document.createElement('style');
  style.textContent =
    '#tset-section{margin-top:18px;}' +
    '#tset-section .tset-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}' +
    '#tset-section .tset-head h3{margin:0;}' +
    '.tset-row-note{margin-left:10px;font-size:13px;color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40%;}' +
    '.tset-note{margin:-6px 0 14px;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,.75);font-size:15px;line-height:1.6;white-space:pre-line;}' +
    '.modal.tset-modal{max-width:760px;max-height:94vh;overflow:auto;}' +
    '.tset-modal label.tset-label{display:block;font-weight:700;margin:12px 0 4px;}' +
    '.tset-modal input[type=text],.tset-modal textarea{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:#fff;}' +
    '.tset-modal textarea{min-height:64px;resize:vertical;}' +
    '.tset-modal .tset-add-row{display:flex;gap:8px;}' +
    '.tset-modal .tset-add-row input{flex:1;}' +
    '#tset-chars .chip{cursor:pointer;font-size:18px;padding:4px 10px;}' +
    '#tset-chars .chip small{font-size:11px;color:var(--ink-soft);margin-left:3px;}' +
    '.tset-extra-row{display:grid;grid-template-columns:36px 1fr 2fr;gap:8px;align-items:center;margin:6px 0;}' +
    '.tset-extra-row .ch{font-size:24px;text-align:center;}' +
    '#tset-radical-panel{margin-top:8px;padding:10px;border-radius:12px;background:var(--paper,#eaf7ff);}' +
    '#tset-radicals{display:flex;flex-wrap:wrap;gap:6px;}' +
    '#tset-radicals button{font-size:15px;}' +
    '#tset-radicals button.active{outline:2px solid var(--seal,#e8553d);}' +
    '#tset-radical-result .chip{cursor:pointer;font-size:20px;padding:4px 10px;}' +
    '#tset-radical-result h4{margin:10px 0 4px;font-size:14px;}' +
    '.tset-modal .t-hint{margin:2px 0;}';
  document.head.appendChild(style);

  /* ---- the list on the 每周生字 page ---------------------------------------- */
  function section() {
    var s = el('tset-section');
    if (s) return s;
    s = document.createElement('div');
    s.id = 'tset-section';
    el('write-toc').insertAdjacentElement('afterend', s);
    s.addEventListener('click', onSectionClick);
    return s;
  }
  function rowHtml(set) {
    var teacher = window.teacherMode
      ? '<button class="btn tiny toc-edit-btn" data-tset-edit="' + esc(set.id) + '" type="button" title="修改这份练习">✏️</button>' +
        '<button class="btn tiny danger toc-del-btn" data-tset-del="' + esc(set.id) + '" type="button" title="删除这份练习">🗑</button>'
      : '';
    return '<div class="lesson-toc-item" data-tset="' + esc(set.id) + '">' +
      '<span class="lesson-toc-title">' + esc(set.title || '（无标题）') + '</span>' +
      '<span class="t-hint-inline" style="margin-left:8px;">共 ' + (set.chars || []).length + ' 字</span>' +
      (set.note ? '<span class="tset-row-note">' + esc(set.note) + '</span>' : '') +
      teacher + '<span class="lesson-toc-arrow">›</span></div>';
  }
  function renderSection() {
    var s = section();
    var list = sets();
    if (!list.length && !window.teacherMode) { s.hidden = true; s.innerHTML = ''; return; }
    s.hidden = false;
    s.innerHTML = '<div class="toc-unit">' +
      '<div class="tset-head"><h3 class="toc-unit-title brush">✏️ 自选描红练习</h3>' +
      (window.teacherMode ? '<button class="btn tiny" id="tset-new" type="button">＋ 新建自选描红练习</button>' : '') + '</div>' +
      '<div class="toc-sub-list">' + (list.length ? list.map(rowHtml).join('')
        : '<div class="empty-msg">还没有自选描红练习。点“＋ 新建自选描红练习”，可以自己选字、加注释。</div>') + '</div></div>';
  }
  function onSectionClick(e) {
    if (e.target.closest('#tset-new')) { openEditor(null); return; }
    var ed = e.target.closest('[data-tset-edit]');
    if (ed) { openEditor(findSet(ed.dataset.tsetEdit)); return; }
    var del = e.target.closest('[data-tset-del]');
    if (del) { confirmDelete(findSet(del.dataset.tsetDel)); return; }
    var row = e.target.closest('[data-tset]');
    if (row) openSet(findSet(row.dataset.tset));
  }
  function confirmDelete(set) {
    if (!set) return;
    window.openConfirmModal('删除这份练习？', '“' + (set.title || '（无标题）') + '”会被删除（字库里的字不受影响）。', '删除', function (ok) {
      if (!ok) return;
      window.OVERLAY.tracingSets = sets().filter(function (s) { return s.id !== set.id; });
      save();
      renderSection();
    });
  }

  // The page redraws the catalogue → the list of sets goes under it again.
  var pageRenderWriteView = window.renderWriteView;
  window.renderWriteView = function () {
    var r = pageRenderWriteView.apply(this, arguments);
    showNote('');
    renderSection();
    return r;
  };
  // A writing unit opened → no list of sets, no note.
  var openUnit = window.openWriteUnit;
  window.openWriteUnit = function (idx) {
    var r = openUnit.apply(this, arguments);
    showNote('');
    var s = el('tset-section');
    if (s) s.hidden = true;
    return r;
  };

  /* ---- a set opened like a writing unit ------------------------------------- */
  function noteEl() {
    var n = el('tset-reader-note');
    if (!n) {
      n = document.createElement('p');
      n.id = 'tset-reader-note';
      n.className = 'tset-note';
      el('write-reader-title').insertAdjacentElement('afterend', n);
    }
    return n;
  }
  function showNote(text) { var n = noteEl(); n.textContent = text || ''; n.hidden = !text; }

  /* A card for a character with no card in the app: the set's pinyin and words. */
  function ownCard(ch, own) {
    var words = ((own && own.words) || []).map(function (w) { return [w, window.autoPinyinWord(w) || '']; });
    return { char: ch, pinyin: (own && own.pinyin) || window.autoPinyin(ch) || '', words: words, _key: 'tset:' + ch };
  }
  function cardsFor(set) {
    var out = [];
    uniq(set.chars || []).forEach(function (ch) {
      var cards = window.getCardsForChar(ch);
      if (cards.length) out.push(cards[0]);
      else out.push(ownCard(ch, (set.extra || {})[ch]));
    });
    return out;
  }
  var openSetId = null;
  function drawSetCards(set) {
    var cards = cardsFor(set);
    el('write-char-grid').innerHTML = cards.length ? cards.map(window.charCardHtml).join('')
      : '<div class="empty-msg">这份练习还没有字。</div>';
  }
  function openSet(set) {
    if (!set) return;
    openSetId = set.id;
    el('write-toc').hidden = true;
    section().hidden = true;
    var reader = el('write-reader');
    reader.hidden = false;
    el('write-reader-title').innerHTML = '<span class="lesson-title-idx custom">自选描红</span> ' + esc(set.title || '');
    showNote(set.note || '');
    drawSetCards(set);
    window.TracingUI.setCurrent(sourceFor(set));
    // Characters without stroke outlines yet: fetched once from the internet, then drawn.
    uniq(set.chars || []).forEach(function (ch) {
      if (window.getStrokeData(ch)) return;
      window.ensureStrokeData(ch, function (d, state) {
        if (state === 'ok' && openSetId === set.id && !el('write-reader').hidden) drawSetCards(set);
      });
    });
    reader.scrollIntoView && reader.scrollIntoView({ block: 'start' });
  }

  /* ---- the teacher's window -------------------------------------------------- */
  // Common radicals with their school names; 月 also finds the 肉月 form ⺼.
  var RADICALS = [
    ['辶', '走之旁'], ['走', '走字旁'], ['氵', '三点水'], ['亻', '单人旁'], ['扌', '提手旁'], ['艹', '草字头'],
    ['口', '口字旁'], ['木', '木字旁'], ['讠', '言字旁'], ['女', '女字旁'], ['日', '日字旁'], ['月', '月字旁', ['月', '⺼']],
    ['火', '火字旁'], ['土', '提土旁'], ['钅', '金字旁'], ['纟', '绞丝旁'], ['宀', '宝盖头'], ['忄', '竖心旁'],
    ['心', '心字底'], ['足', '足字旁'], ['目', '目字旁'], ['⺮', '竹字头'], ['雨', '雨字头'], ['页', '页字边'],
    ['刂', '立刀旁'], ['阝', '耳刀旁'], ['犭', '反犬旁'], ['衤', '衣字旁'], ['礻', '示字旁'], ['王', '王字旁'],
    ['禾', '禾木旁'], ['米', '米字旁'], ['虫', '虫字旁'], ['鸟', '鸟字边'], ['马', '马字旁'], ['山', '山字旁'],
    ['石', '石字旁'], ['贝', '贝字旁'], ['车', '车字旁'], ['饣', '食字旁'], ['疒', '病字旁'], ['彳', '双人旁'],
    ['门', '门字框'], ['广', '广字旁'], ['力', '力字旁'], ['田', '田字旁'], ['巾', '巾字旁'], ['穴', '穴宝盖'],
  ];
  var byRadical = null;
  function charsWithRadical(forms) {
    if (!byRadical) {
      byRadical = {};
      var info = window.CHAR_INFO || {};
      Object.keys(info).forEach(function (ch) { (byRadical[info[ch][0]] = byRadical[info[ch][0]] || []).push(ch); });
    }
    var out = [];
    forms.forEach(function (f) { out = out.concat(byRadical[f] || []); });
    return uniq(out);
  }

  var draft = null;   // the set being made or changed: a copy, saved only with 保存
  var overlayEl = null;
  var radicalForms = null, showRare = false;

  function buildEditor() {
    overlayEl = document.createElement('div');
    overlayEl.className = 'modal-overlay';
    overlayEl.id = 'tset-overlay';
    overlayEl.innerHTML =
      '<div class="modal tset-modal">' +
        '<button class="modal-close" id="tset-close" type="button">✕</button>' +
        '<h3 id="tset-editor-title">✏️ 自选描红练习</h3>' +
        '<label class="tset-label" for="tset-title">标题</label>' +
        '<input type="text" id="tset-title" placeholder="例如：走之旁的字">' +
        '<label class="tset-label" for="tset-add">字</label>' +
        '<div class="tset-add-row"><input type="text" id="tset-add" placeholder="输入或粘贴汉字，可以一次输入很多个">' +
          '<button class="btn" id="tset-add-btn" type="button">加入</button>' +
          '<button class="btn" id="tset-radical-btn" type="button">🔍 按部首找字</button></div>' +
        '<div id="tset-radical-panel" hidden>' +
          '<div class="t-hint">点一个部首，下面会列出带这个部首的字，点字就加进练习（再点一下取消）。</div>' +
          '<div id="tset-radicals"></div>' +
          '<div id="tset-radical-result"></div>' +
        '</div>' +
        '<p class="t-hint">已选的字（点一下去掉）：</p>' +
        '<div class="chip-row" id="tset-chars"></div>' +
        '<div id="tset-extra"></div>' +
        '<label class="tset-label" for="tset-note">老师的注释（印在每一页的上方）</label>' +
        '<textarea id="tset-note" placeholder="例如：这些都是常见的走之旁的字，注意走之旁最后一笔要写得平而长。"></textarea>' +
        '<span class="t-status" id="tset-status"></span>' +
        '<div class="modal-actions">' +
          '<button class="btn" id="tset-cancel" type="button">取消</button>' +
          '<button class="btn primary" id="tset-save" type="button">💾 保存</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlayEl);
    el('tset-radicals').innerHTML = RADICALS.map(function (r, i) {
      return '<button class="btn tiny" type="button" data-radical="' + i + '">' + r[0] + ' ' + r[1] + '</button>';
    }).join('');

    el('tset-close').addEventListener('click', closeEditor);
    el('tset-cancel').addEventListener('click', closeEditor);
    el('tset-save').addEventListener('click', saveEditor);
    el('tset-add-btn').addEventListener('click', addTyped);
    el('tset-add').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } });
    el('tset-radical-btn').addEventListener('click', function () { el('tset-radical-panel').hidden = !el('tset-radical-panel').hidden; });
    el('tset-radicals').addEventListener('click', function (e) {
      var b = e.target.closest('[data-radical]');
      if (!b) return;
      var r = RADICALS[+b.dataset.radical];
      radicalForms = r[2] || [r[0]];
      showRare = false;
      el('tset-radicals').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
      renderRadicalResult();
    });
    el('tset-radical-result').addEventListener('click', function (e) {
      if (e.target.closest('#tset-more')) { showRare = true; renderRadicalResult(); return; }
      var chip = e.target.closest('.chip[data-char]');
      if (!chip) return;
      toggleChar(chip.dataset.char);
    });
    el('tset-chars').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip[data-char]');
      if (chip) toggleChar(chip.dataset.char);
    });
    el('tset-extra').addEventListener('input', function (e) {
      var row = e.target.closest('[data-extra]');
      if (!row) return;
      var ch = row.dataset.extra;
      var own = draft.extra[ch] = draft.extra[ch] || {};
      if (e.target.classList.contains('tset-py')) own.pinyin = window.normalizePinyinInput ? window.normalizePinyinInput(e.target.value.trim()) : e.target.value.trim();
      if (e.target.classList.contains('tset-words')) own.words = e.target.value.split(/[\s,，、;；]+/).filter(Boolean);
    });
  }

  function toggleChar(ch) {
    var i = draft.chars.indexOf(ch);
    if (i >= 0) draft.chars.splice(i, 1); else draft.chars.push(ch);
    renderDraft();
  }
  function addTyped() {
    var input = el('tset-add');
    var added = hanChars(input.value).filter(function (c) { return draft.chars.indexOf(c) < 0; });
    draft.chars = uniq(draft.chars.concat(added));
    input.value = '';
    setStatus(added.length ? '' : '没有新的汉字可以加入。');
    renderDraft();
  }
  function setStatus(t, err) { var s = el('tset-status'); s.textContent = t || ''; s.className = 't-status' + (err ? ' err' : ''); }

  function chipHtml(ch, selected) {
    return '<span class="chip' + (selected ? ' selected' : '') + '" data-char="' + esc(ch) + '">' + esc(ch) +
      (inLibrary(ch) ? '' : '<small>字库外</small>') + '</span>';
  }
  function renderDraft() {
    el('tset-chars').innerHTML = draft.chars.length ? draft.chars.map(function (c) { return chipHtml(c, true); }).join('')
      : '<span class="t-hint">还没有字</span>';
    // Characters outside the character list: their pinyin (filled in automatically) and words.
    var outside = draft.chars.filter(function (c) { return !inLibrary(c); });
    el('tset-extra').innerHTML = outside.length
      ? '<p class="t-hint">“字库外”的字不在全部生字里：拼音已经自动填好，多音字请检查；组词可以不填（用空格分开，最多印 3 个）。</p>' +
        outside.map(function (ch) {
          var own = draft.extra[ch] || {};
          var py = own.pinyin || window.autoPinyin(ch) || '';
          return '<div class="tset-extra-row" data-extra="' + esc(ch) + '"><span class="ch">' + esc(ch) + '</span>' +
            '<input type="text" class="tset-py" value="' + esc(py) + '" placeholder="拼音，例如 yíng 或 ying2">' +
            '<input type="text" class="tset-words" value="' + esc((own.words || []).join(' ')) + '" placeholder="组词（可以不填），例如：欢迎 迎接"></div>';
        }).join('')
      : '';
    if (radicalForms) renderRadicalResult();
  }
  function renderRadicalResult() {
    var all = charsWithRadical(radicalForms);
    var lib = all.filter(inLibrary), rest = all.filter(function (c) { return !inLibrary(c); });
    var html = '<h4>字库里的字（' + lib.length + '）</h4><div class="chip-row">' +
      (lib.length ? lib.map(function (c) { return chipHtml(c, draft.chars.indexOf(c) >= 0); }).join('') : '<span class="t-hint">没有</span>') + '</div>';
    if (rest.length) {
      html += showRare
        ? '<h4>字库外的字（' + rest.length + '，里面也有繁体字和不常用的字）</h4><div class="chip-row">' +
          rest.map(function (c) { return chipHtml(c, draft.chars.indexOf(c) >= 0); }).join('') + '</div>'
        : '<button class="btn tiny" id="tset-more" type="button">显示更多：字库外的字（' + rest.length + '）</button>';
    }
    el('tset-radical-result').innerHTML = html;
  }

  function openEditor(set) {
    if (!window.teacherMode) return;
    if (!overlayEl) buildEditor();
    draft = set ? JSON.parse(JSON.stringify(set)) : { id: 'tset' + Date.now(), title: '', note: '', chars: [], extra: {} };
    draft.chars = draft.chars || [];
    draft.extra = draft.extra || {};
    el('tset-editor-title').textContent = set ? '✏️ 修改自选描红练习' : '✏️ 新建自选描红练习';
    el('tset-title').value = draft.title || '';
    el('tset-note').value = draft.note || '';
    el('tset-add').value = '';
    el('tset-radical-panel').hidden = true;
    radicalForms = null;
    el('tset-radicals').querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
    el('tset-radical-result').innerHTML = '';
    setStatus('');
    renderDraft();
    overlayEl.classList.add('active');
    setTimeout(function () { el('tset-title').focus(); }, 60);
  }
  function closeEditor() { if (overlayEl) overlayEl.classList.remove('active'); draft = null; }

  function saveEditor() {
    // Whatever is still typed in the 字 box counts too.
    if (hanChars(el('tset-add').value).length) addTyped();
    draft.title = el('tset-title').value.trim();
    draft.note = el('tset-note').value.trim();
    if (!draft.title) { setStatus('请填写标题。', true); el('tset-title').focus(); return; }
    if (!draft.chars.length) { setStatus('请至少加入一个字。', true); return; }
    // Keep pinyin/words only for characters outside the character list that are still in the set,
    // and store the automatic pinyin so the printed page does not depend on it later.
    var extra = {};
    draft.chars.forEach(function (ch) {
      if (inLibrary(ch)) return;
      var own = draft.extra[ch] || {};
      extra[ch] = { pinyin: own.pinyin || window.autoPinyin(ch) || '', words: (own.words || []).slice(0, 6) };
    });
    draft.extra = extra;
    var list = sets(), i = -1;
    list.forEach(function (s, k) { if (s.id === draft.id) i = k; });
    if (i >= 0) list[i] = draft; else list.push(draft);
    var saved = draft;
    closeEditor();
    save();
    if (openSetId === saved.id && !el('write-reader').hidden) openSet(saved);
    else renderSection();
  }

  /* ---- start-up --------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    // After the page's own start-up: if the 每周生字 catalogue is on screen, add the list.
    if (el('write-toc') && !el('write-toc').hidden) renderSection();
  });

  // For the automatic check.
  window.TracingSets = { list: sets, open: function (id) { openSet(findSet(id)); }, edit: function (id) { openEditor(id ? findSet(id) : null); }, source: function (id) { return sourceFor(findSet(id)); } };
})();
