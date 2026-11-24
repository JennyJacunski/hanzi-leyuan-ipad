'use strict';
/*
 * add-chars.js — one teacher tab, “➕ 加字”, for every way of adding characters
 * (decided 2026-11-23). It replaces two places that each did half the job:
 *   - ➕ 上传新字表: new characters, always under a named list (a “标签”);
 *   - ✍️ 学写字管理: making a week, but only from characters already known.
 *
 * In ➕ 加字 the teacher:
 *   ① types or pastes one or many characters (or lines “字,拼音,组词1,组词2”),
 *     checks them, and sees which are new (pinyin, 组词 and a recording can be
 *     set) and which the app already knows (shown, never changed here — that
 *     is 🔧 修改/纠错's job; the old upload silently overwrote them);
 *   ② optionally puts them under a 标签: none, an existing one, or a new one;
 *   ③ optionally puts them into a week: grade → unit → week, existing or new.
 *
 * Also owned here:
 *   - “未分类” in 学习 → 📚 全部生字: new characters with no 标签 and in no
 *     week, so a character the teacher added is never impossible to find.
 *     Worked out each time from the data, not stored.
 *   - ✍️ 学写字管理 now only edits an existing week (opened by ✏️ in the
 *     每周生字 list); new weeks are made in ➕ 加字. Its two boxes are labelled
 *     单元 / 周, which is what they hold (the page's own labels had them the
 *     other way round).
 *   - the page's messages that send the teacher to the old tabs now name ➕ 加字.
 *
 * Data: the page's own fields, unchanged — newCharBase (new characters),
 * customAudio, groups/groupChars (标签), writingUnits (weeks:
 * {grade, indexLabel: '二年级 第一单元', title: '第一周', chars}).
 * It must not: change characters the app already has, or how any page draws.
 *
 * Opened in a normal browser (no window.desktopApp), this file does nothing.
 */
(function () {
  if (!window.desktopApp) return;
  var W = window;

  var UNSORTED = '__unsorted__';
  var HAN = /[㐀-䶿一-鿿豈-﫿]/;
  var NEW_OPT = '__new__';

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function O() { return W.OVERLAY; }
  function isKnown(ch) { return !!(W.BASE_CHAR_SET[ch] || O().newCharBase[ch]); }

  /* ---- 未分类 ------------------------------------------------------------- */
  function inAnyTag(ch) {
    return (O().groups || []).some(function (g) { return (O().groupChars[g.key] || []).indexOf(ch) >= 0; });
  }
  function inAnyWeek(ch) {
    return (O().writingUnits || []).some(function (u) { return (u.chars || []).indexOf(ch) >= 0; });
  }
  function unsortedChars() {
    return Object.keys(O().newCharBase || {}).filter(function (ch) {
      return !W.BASE_CHAR_SET[ch] && !inAnyTag(ch) && !inAnyWeek(ch) && W.getCardsForChar(ch).length > 0;
    });
  }
  var pageAllGroups = W.allGroups;
  W.allGroups = function () {
    var groups = pageAllGroups();
    var loose = unsortedChars();
    if (loose.length) groups = groups.concat([{ key: UNSORTED, label: '未分类', chars: loose, custom: true }]);
    return groups;
  };

  /* ---- styles ------------------------------------------------------------- */
  var style = document.createElement('style');
  style.textContent =
    '.t-tab[data-ttab="group"]{display:none !important;}' +
    '.ac-step{margin:0 0 16px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel);}' +
    '.ac-step-title{font-weight:700;font-size:15px;margin:0 0 8px;}' +
    '.ac-step .t-hint{margin-bottom:8px;}' +
    '.ac-choice{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0;font-size:14px;}' +
    '.ac-choice > label{display:inline-flex;align-items:center;gap:6px;cursor:pointer;min-width:92px;}' +
    '.ac-choice input[type="text"]{padding:8px 10px;border-radius:9px;border:1px solid var(--line);font-size:14px;background:var(--panel);color:var(--ink);min-width:160px;}' +
    '.ac-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:14px;}' +
    '.ac-table th{text-align:left;font-size:12.5px;color:var(--ink-soft);font-weight:700;padding:4px 6px;border-bottom:1px solid var(--line);}' +
    '.ac-table td{padding:6px;border-bottom:1px dashed var(--line);vertical-align:top;}' +
    '.ac-table td.ac-ch{font-size:26px;width:44px;text-align:center;line-height:1.2;}' +
    '.ac-table input[type="text"]{width:100%;min-width:70px;box-sizing:border-box;padding:6px 8px;border-radius:8px;border:1px solid var(--line);font-size:14px;background:var(--panel);color:var(--ink);}' +
    '.ac-table .ac-words{display:flex;gap:6px;}' +
    '.ac-table .audio-recorder{display:flex;flex-wrap:wrap;gap:4px;align-items:center;}' +
    '.ac-table .audio-recorder .preview audio{max-width:180px;height:30px;}' +
    '.ac-badge{display:inline-block;font-size:12px;font-weight:700;border-radius:8px;padding:2px 8px;white-space:nowrap;}' +
    '.ac-badge.new{background:var(--jade-soft);color:var(--jade);}' +
    '.ac-badge.old{background:rgba(0,0,0,0.06);color:var(--ink-soft);}' +
    '.ac-known{color:var(--ink-soft);}' +
    '.ac-remove{border:none;background:none;cursor:pointer;font-size:15px;color:var(--ink-soft);}' +
    '#ac-table:empty{display:none;}' +
    // ✍️ 学写字管理: only the intro until a week is being edited
    '#t-pane-write:not(.ac-editing) > :not(.ac-write-idle){display:none !important;}' +
    '#t-pane-write.ac-editing > .ac-write-idle{display:none !important;}';
  document.head.appendChild(style);

  /* ---- the tab and its pane ---------------------------------------------- */
  var PANE_HTML =
    '<p class="t-hint">一次加一个字或很多字。字库里没有的字会作为新字加进字库；②和③都可以不选。</p>' +
    '<div class="ac-step"><div class="ac-step-title">① 要加的字</div>' +
      '<textarea id="ac-input" rows="3" placeholder="直接输入或粘贴，比如：走起赶越趁趣（标点、空格都没关系）&#10;想同时写拼音和组词，就一行一个字：趁,chèn,趁早,趁热"></textarea>' +
      '<div class="t-row"><button class="btn" id="ac-check" type="button">检查这些字</button><span class="t-status" id="ac-check-status"></span></div>' +
      '<div id="ac-table"></div>' +
    '</div>' +
    '<div class="ac-step"><div class="ac-step-title">② 标签（可选）</div>' +
      '<p class="t-hint">有标签的字，在“学习 → 📚 全部生字”里有自己的按钮，测试时也可以选它出题。</p>' +
      '<div class="ac-choice"><label><input type="radio" name="ac-tag" value="none" checked> 不加标签</label></div>' +
      '<div class="ac-choice"><label><input type="radio" name="ac-tag" value="old" id="ac-tag-old-radio"> 已有标签</label><select id="ac-tag-select" class="single-group-select"></select></div>' +
      '<div class="ac-choice"><label><input type="radio" name="ac-tag" value="new"> 新标签</label><input type="text" id="ac-tag-new" placeholder="例如：走字旁的字"></div>' +
    '</div>' +
    '<div class="ac-step"><div class="ac-step-title">③ 放进每周生字（可选）</div>' +
      '<p class="t-hint">放进“学习 → 📅 每周生字”的某一周。同一个字不会在同一周里出现两次。</p>' +
      '<div class="ac-choice"><label><input type="radio" name="ac-week" value="none" checked> 不放</label></div>' +
      '<div class="ac-choice"><label><input type="radio" name="ac-week" value="put"> 放进</label>' +
        '<select id="ac-grade" class="single-group-select"></select>' +
        '<select id="ac-unit" class="single-group-select"></select><input type="text" id="ac-unit-new" placeholder="新单元，例如：第三单元">' +
        '<select id="ac-week-select" class="single-group-select"></select><input type="text" id="ac-week-new" placeholder="新的一周，例如：第一周">' +
      '</div>' +
    '</div>' +
    '<div class="t-row"><button class="btn primary" id="ac-save" type="button">保存</button><span class="t-status" id="ac-status"></span></div>';

  function buildTab() {
    var oldTab = document.querySelector('.t-tab[data-ttab="group"]');
    var oldPane = el('t-pane-group');
    if (!oldTab || !oldPane || el('t-pane-addchars')) return;
    var tab = document.createElement('button');
    tab.className = 't-tab';
    tab.dataset.ttab = 'addchars';
    tab.type = 'button';
    tab.textContent = '➕ 加字';
    oldTab.insertAdjacentElement('beforebegin', tab);
    var pane = document.createElement('div');
    pane.className = 't-pane';
    pane.id = 't-pane-addchars';
    pane.innerHTML = PANE_HTML;
    oldPane.insertAdjacentElement('afterend', pane);
    // The page wires its tabs when it starts; this one may come after that.
    tab.addEventListener('click', function () { W.switchToTeacherTab('addchars'); refreshPickers(); });
  }

  /* ---- ① the characters --------------------------------------------------- */
  var rows = []; // {ch, isNew, pinyin, w1, w2, audio}

  function parseInput(text) {
    var out = [];
    String(text || '').split(/\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      if (/[,，]/.test(line)) {
        var parts = line.split(/[,，]/).map(function (s) { return s.trim(); });
        var ch = Array.from(parts[0]).filter(function (c) { return HAN.test(c); })[0];
        if (ch) out.push({ ch: ch, pinyin: parts[1] || '', w1: parts[2] || '', w2: parts[3] || '', given: true });
        return;
      }
      Array.from(line).forEach(function (c) { if (HAN.test(c)) out.push({ ch: c, pinyin: '', w1: '', w2: '' }); });
    });
    return out;
  }

  function checkInput() {
    var input = el('ac-input');
    var status = el('ac-check-status');
    var found = parseInput(input.value);
    if (!found.length) {
      if (!rows.length) { setStatus(status, '请先输入或粘贴一些汉字', true); }
      return;
    }
    var added = 0, dup = [], keptOld = [];
    found.forEach(function (f) {
      if (rows.some(function (r) { return r.ch === f.ch; })) { dup.push(f.ch); return; }
      var isNew = !isKnown(f.ch);
      if (!isNew && f.given && (f.pinyin || f.w1 || f.w2)) keptOld.push(f.ch);
      rows.push({
        ch: f.ch,
        isNew: isNew,
        pinyin: isNew ? (f.pinyin ? W.normalizePinyinInput(f.pinyin) : W.autoPinyin(f.ch)) : '',
        w1: isNew ? f.w1 : '',
        w2: isNew ? f.w2 : '',
        audio: null,
      });
      added++;
    });
    input.value = '';
    var msg = '下面的表里加了 ' + added + ' 个字';
    if (dup.length) msg += '；' + uniq(dup).join('、') + ' 已经在表里了';
    if (keptOld.length) msg += '；' + keptOld.join('、') + ' 是字库里已有的字，拼音和组词不在这里改（请用“🔧 修改/纠错”）';
    setStatus(status, msg, false);
    renderTable();
  }
  function uniq(list) { var seen = {}; return list.filter(function (c) { if (seen[c]) return false; seen[c] = true; return true; }); }

  function knownSummary(ch) {
    var cards = W.getCardsForChar(ch);
    if (!cards.length) return { pinyin: '（这个字的卡片已被删除）', words: '' };
    var words = [];
    cards.forEach(function (c) { (c.words || []).forEach(function (w) { if (words.length < 3) words.push(w[0]); }); });
    return { pinyin: cards.map(function (c) { return c.pinyin; }).join(' / '), words: words.join('  ') };
  }

  function renderTable() {
    var wrap = el('ac-table');
    if (!rows.length) { wrap.innerHTML = ''; return; }
    var html = '<table class="ac-table"><thead><tr><th>字</th><th>情况</th><th>拼音</th><th>组词</th><th>读音（可选）</th><th></th></tr></thead><tbody>';
    rows.forEach(function (r, i) {
      if (r.isNew) {
        html += '<tr data-i="' + i + '"><td class="ac-ch">' + esc(r.ch) + '</td>' +
          '<td><span class="ac-badge new">新字</span></td>' +
          '<td><input type="text" class="ac-py" value="' + esc(r.pinyin) + '" placeholder="例如 chèn 或 chen4"></td>' +
          '<td><div class="ac-words"><input type="text" class="ac-w1" value="' + esc(r.w1) + '" placeholder="组词1"><input type="text" class="ac-w2" value="' + esc(r.w2) + '" placeholder="组词2"></div></td>' +
          '<td class="ac-audio"></td>' +
          '<td><button type="button" class="ac-remove" title="不加这个字">✕</button></td></tr>';
      } else {
        var k = knownSummary(r.ch);
        html += '<tr data-i="' + i + '"><td class="ac-ch">' + esc(r.ch) + '</td>' +
          '<td><span class="ac-badge old">字库里已有</span></td>' +
          '<td class="ac-known">' + esc(k.pinyin) + '</td><td class="ac-known">' + esc(k.words) + '</td><td class="ac-known">—</td>' +
          '<td><button type="button" class="ac-remove" title="不加这个字">✕</button></td></tr>';
      }
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
    rows.forEach(function (r, i) {
      if (!r.isNew) return;
      var cell = wrap.querySelector('tr[data-i="' + i + '"] .ac-audio');
      cell.innerHTML = W.audioRecorderHtml();
      W.wireAudioRecorder(cell, function (url) { r.audio = url; }, r.audio);
    });
  }

  function onTableInput(e) {
    var tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    var r = rows[+tr.dataset.i];
    if (!r) return;
    if (e.target.classList.contains('ac-py')) r.pinyin = e.target.value;
    if (e.target.classList.contains('ac-w1')) r.w1 = e.target.value;
    if (e.target.classList.contains('ac-w2')) r.w2 = e.target.value;
  }
  function onTableClick(e) {
    var btn = e.target.closest('.ac-remove');
    if (!btn) return;
    rows.splice(+btn.closest('tr[data-i]').dataset.i, 1);
    renderTable();
  }

  /* ---- ② and ③ pickers ---------------------------------------------------- */
  function radio(name) {
    var r = document.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : 'none';
  }
  function setRadio(name, value) {
    var r = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (r) r.checked = true;
  }
  function options(list, selected) {
    return list.map(function (o) {
      return '<option value="' + esc(o.value) + '"' + (o.value === selected ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('');
  }
  function byOrder(a, b) { return W.numOrLast(W.parseOrderNum(a)) - W.numOrLast(W.parseOrderNum(b)); }

  function unitsOf(grade) {
    var seen = {}, list = [];
    (O().writingUnits || []).forEach(function (u) {
      if (W.writeUnitGrade(u) !== grade) return;
      var label = W.writeUnitGroupLabel(u) || '';
      if (!seen.hasOwnProperty(label)) { seen[label] = true; list.push(label); }
    });
    return list.sort(function (a, b) { if (a === '') return 1; if (b === '') return -1; return byOrder(a, b); });
  }
  function weeksOf(grade, unit) {
    var list = [];
    (O().writingUnits || []).forEach(function (u) {
      if (W.writeUnitGrade(u) === grade && (W.writeUnitGroupLabel(u) || '') === unit && list.indexOf(u.title || '') < 0) list.push(u.title || '');
    });
    return list.sort(byOrder);
  }

  function refreshTagSelect(selected) {
    var sel = el('ac-tag-select');
    var groups = O().groups || [];
    var current = selected != null ? selected : sel.value;
    sel.innerHTML = groups.length
      ? options(groups.map(function (g) { return { value: g.key, label: g.label }; }), current)
      : '<option value="">（还没有标签）</option>';
    sel.disabled = !groups.length;
    el('ac-tag-old-radio').disabled = !groups.length;
    if (!groups.length && radio('ac-tag') === 'old') setRadio('ac-tag', 'none');
  }

  function refreshWeekSelects(want) {
    want = want || {};
    var gradeSel = el('ac-grade'), unitSel = el('ac-unit'), weekSel = el('ac-week-select');
    var grade = want.grade || gradeSel.value || W.lastWriteGrade || W.DEFAULT_GRADE;
    gradeSel.innerHTML = options(W.GRADES.map(function (g) { return { value: g, label: g }; }), grade);

    var units = unitsOf(grade);
    var unit = want.unit != null ? want.unit : unitSel.value;
    if (unit !== NEW_OPT && units.indexOf(unit) < 0) unit = units.length ? units[0] : NEW_OPT;
    unitSel.innerHTML = options(units.map(function (u) { return { value: u, label: u || '未分组' }; })
      .concat([{ value: NEW_OPT, label: '＋ 新单元…' }]), unit);
    el('ac-unit-new').style.display = unit === NEW_OPT ? '' : 'none';

    var weeks = unit === NEW_OPT ? [] : weeksOf(grade, unit);
    var week = want.week != null ? want.week : weekSel.value;
    if (week !== NEW_OPT && weeks.indexOf(week) < 0) week = weeks.length ? weeks[0] : NEW_OPT;
    weekSel.innerHTML = options(weeks.map(function (w) { return { value: w, label: w || '（无标题）' }; })
      .concat([{ value: NEW_OPT, label: '＋ 新的一周…' }]), week);
    el('ac-week-new').style.display = week === NEW_OPT ? '' : 'none';
  }

  function refreshPickers() {
    if (!el('t-pane-addchars')) return;
    refreshTagSelect();
    refreshWeekSelects();
  }

  /* ---- saving ------------------------------------------------------------- */
  function setStatus(node, text, isError) {
    node.textContent = text;
    node.className = 't-status' + (isError ? ' err' : '');
  }

  function save() {
    var status = el('ac-status');
    if (el('ac-input').value.trim()) checkInput();
    if (!rows.length) return setStatus(status, '请先在①里输入要加的字，再点“检查这些字”', true);

    var newRows = rows.filter(function (r) { return r.isNew && !isKnown(r.ch); });
    var noPinyin = [];
    newRows.forEach(function (r) {
      r.finalPinyin = r.pinyin.trim() ? W.normalizePinyinInput(r.pinyin.trim()) : W.autoPinyin(r.ch);
      if (!r.finalPinyin) noPinyin.push(r.ch);
    });
    if (noPinyin.length) return setStatus(status, '请填写这些新字的拼音：' + noPinyin.join('、'), true);

    // ② which 标签
    var tagMode = radio('ac-tag'), tagKey = null, tagLabel = '';
    if (tagMode === 'old') {
      tagKey = el('ac-tag-select').value;
      var g = (O().groups || []).filter(function (x) { return x.key === tagKey; })[0];
      if (!g) return setStatus(status, '请选一个已有的标签', true);
      tagLabel = g.label;
    } else if (tagMode === 'new') {
      tagLabel = el('ac-tag-new').value.trim();
      if (!tagLabel) return setStatus(status, '请写新标签的名称', true);
    }

    // ③ which week
    var weekMode = radio('ac-week'), grade = '', unit = '', week = '';
    if (weekMode === 'put') {
      grade = el('ac-grade').value;
      unit = el('ac-unit').value === NEW_OPT ? el('ac-unit-new').value.trim() : el('ac-unit').value;
      week = el('ac-week-select').value === NEW_OPT ? el('ac-week-new').value.trim() : el('ac-week-select').value;
      if (el('ac-unit').value === NEW_OPT && !unit) return setStatus(status, '请写新单元的名称，例如：第三单元', true);
      if (!week) return setStatus(status, '请写这一周的名称，例如：第一周', true);
    }

    if (!newRows.length && tagMode === 'none' && weekMode === 'none') {
      return setStatus(status, '这些字都已经在字库里了。要给它们加标签或放进某一周，请在②或③里选。', true);
    }

    var chars = rows.map(function (r) { return r.ch; });

    // new characters
    newRows.forEach(function (r) {
      var words = [r.w1, r.w2].map(function (w) { return String(w || '').trim(); }).filter(Boolean)
        .map(function (w) { return [w, W.autoPinyinWord(w)]; });
      O().newCharBase[r.ch] = { pinyin: r.finalPinyin, words: words };
      if (r.audio) O().customAudio[r.ch] = r.audio;
    });

    // ② 标签
    if (tagMode === 'new') {
      var same = (O().groups || []).filter(function (x) { return x.label === tagLabel; })[0];
      if (same) tagKey = same.key;
      else {
        tagKey = 'custom_' + Date.now();
        O().groups.push({ key: tagKey, label: tagLabel });
      }
    }
    if (tagKey) {
      var list = O().groupChars[tagKey] || (O().groupChars[tagKey] = []);
      chars.forEach(function (ch) { if (list.indexOf(ch) < 0) list.push(ch); });
    }

    // ③ week
    if (weekMode === 'put') {
      var units = O().writingUnits || (O().writingUnits = []);
      var target = units.filter(function (u) {
        return W.writeUnitGrade(u) === grade && (W.writeUnitGroupLabel(u) || '') === unit && (u.title || '') === week;
      })[0];
      if (target) {
        target.chars = target.chars || [];
        chars.forEach(function (ch) { if (target.chars.indexOf(ch) < 0) target.chars.push(ch); });
      } else {
        units.push({ title: week, indexLabel: unit ? grade + ' ' + unit : grade, grade: grade, chars: chars.slice(),
          bg: Math.floor(Math.random() * W.LESSON_BG_COUNT) });
      }
      W.lastWriteGrade = grade;
    }

    // what changed, in one line
    var msg = '已保存：';
    var parts = [];
    if (newRows.length) parts.push(newRows.length + ' 个新字');
    if (rows.length - newRows.length) parts.push((rows.length - newRows.length) + ' 个已有的字');
    msg += parts.join('、');
    if (tagKey) msg += '；标签“' + tagLabel + '”';
    if (weekMode === 'put') msg += '；放进' + grade + ' ' + (unit ? unit + ' ' : '') + week;
    if (tagMode === 'none' && weekMode === 'none') msg += '（在“全部生字 → 未分类”里）';

    // refresh every place that shows these
    W.populateGradeSeg();
    W.renderLearnGrid();
    W.renderCustomGroupChips();
    if (weekMode === 'put') { W.renderWriteView(); W.renderWriteManageToc(); }
    W.queueSave();

    var fetchList = newRows.map(function (r) { return r.ch; }).filter(function (ch) { return !W.getStrokeData(ch); });
    rows = [];
    renderTable();
    el('ac-tag-new').value = '';
    el('ac-unit-new').value = '';
    el('ac-week-new').value = '';
    if (tagKey) { setRadio('ac-tag', 'old'); refreshTagSelect(tagKey); } else refreshTagSelect();
    if (weekMode === 'put') refreshWeekSelects({ grade: grade, unit: unit, week: week });
    else refreshWeekSelects();
    setStatus(el('ac-check-status'), '', false);
    setStatus(status, msg, false);

    // new characters need their stroke order once (needs the internet)
    if (fetchList.length) {
      setStatus(status, msg + '。正在联网获取 ' + fetchList.length + ' 个新字的笔顺…', false);
      var done = 0, ok = 0;
      fetchList.forEach(function (ch) {
        W.ensureStrokeData(ch, function (data, state) {
          done++;
          if (state === 'ok') ok++;
          if (done < fetchList.length) return;
          setStatus(status, msg + '。笔顺：' + ok + ' / ' + fetchList.length + ' 个新字已获取' +
            (ok < fetchList.length ? '（其余可能是没联网，打开这个字时会再试）' : ''), ok < fetchList.length);
          W.renderLearnGrid();
        });
      });
    }
  }

  function wirePane() {
    el('ac-check').addEventListener('click', checkInput);
    el('ac-save').addEventListener('click', save);
    var table = el('ac-table');
    table.addEventListener('input', onTableInput);
    table.addEventListener('click', onTableClick);
    // using a choice's own control picks that choice
    el('ac-tag-select').addEventListener('change', function () { setRadio('ac-tag', 'old'); });
    el('ac-tag-new').addEventListener('input', function () { setRadio('ac-tag', 'new'); });
    el('ac-grade').addEventListener('change', function () { setRadio('ac-week', 'put'); refreshWeekSelects({ grade: el('ac-grade').value }); });
    el('ac-unit').addEventListener('change', function () { setRadio('ac-week', 'put'); refreshWeekSelects({ unit: el('ac-unit').value }); });
    el('ac-week-select').addEventListener('change', function () { setRadio('ac-week', 'put'); refreshWeekSelects({ unit: el('ac-unit').value, week: el('ac-week-select').value }); });
    ['ac-unit-new', 'ac-week-new'].forEach(function (id) { el(id).addEventListener('input', function () { setRadio('ac-week', 'put'); }); });
    refreshPickers();
  }

  /* ---- ✍️ 学写字管理: editing an existing week only ------------------------- */
  function setupWritePane() {
    var pane = el('t-pane-write');
    if (!pane || el('ac-write-idle')) return;
    var idle = document.createElement('div');
    idle.className = 'ac-write-idle';
    idle.id = 'ac-write-idle';
    idle.innerHTML =
      '<p class="t-hint">这里修改已经建好的一周：在“学习 → 📅 每周生字”的目录里，点某一周旁边的 ✏️，就会在这里打开。' +
      '要新建一周，或者往某一周里加字（包括新字），请用“➕ 加字”。</p>' +
      '<span class="t-status" id="ac-write-idle-status"></span>';
    var intro = pane.querySelector('p.t-hint');
    pane.insertBefore(idle, pane.firstChild);
    if (intro) intro.textContent = '修改这一周：可以改年级、单元和周的名称，点一下字把它移出这一周，或者再加字库里已有的字（新字请用“➕ 加字”）。';
    var unitInput = el('write-index-input'), weekInput = el('write-title-input');
    if (unitInput) unitInput.placeholder = '单元，例如：第一单元';
    if (weekInput) weekInput.placeholder = '周，例如：第一周';

    var pageStart = W.startEditingWriteUnit;
    W.startEditingWriteUnit = function (idx) {
      pane.classList.add('ac-editing');
      var r = pageStart.apply(this, arguments);
      // the unit box shows just the unit; the grade has its own menu
      var u = O().writingUnits[idx];
      if (u && unitInput) unitInput.value = W.writeUnitGroupLabel(u) || '';
      return r;
    };
    var pageReset = W.resetWriteUnitForm;
    W.resetWriteUnitForm = function () {
      var r = pageReset.apply(this, arguments);
      pane.classList.remove('ac-editing');
      var s = el('write-status');
      el('ac-write-idle-status').textContent = s ? s.textContent : '';
      return r;
    };
  }
  // Saving an edited week: the unit box holds only the unit, so the grade is
  // put back in front of it, the way the weeks are stored ('二年级 第一单元').
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('#btn-save-write-unit')) return;
    var unitInput = el('write-index-input'), gradeSel = el('write-grade-select');
    if (!unitInput || !gradeSel) return;
    var unit = unitInput.value.trim();
    if (!W.detectGradeFromText(unit)) unitInput.value = unit ? gradeSel.value + ' ' + unit : gradeSel.value;
  }, true);

  // Deleting or editing weeks elsewhere changes what ③ can offer.
  var pageRenderWriteView = W.renderWriteView;
  W.renderWriteView = function () {
    var r = pageRenderWriteView.apply(this, arguments);
    if (el('t-pane-addchars')) refreshWeekSelects();
    return r;
  };

  /* ---- the page's own messages that name the old tabs --------------------- */
  var RENAMES = [
    [/["“]➕ ?上传新字表["”]/g, '“➕ 加字”'],
    [/["“]上传新字表["”]/g, '“➕ 加字”'],
    [/「✍️ 学写字管理」里创建一个/g, '「➕ 加字」里新建一周'],
    [/「✍️ 学写字管理」就能创建/g, '「➕ 加字」就能新建一周'],
  ];
  function fixText(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      var v = root.nodeValue;
      if (v.indexOf('上传新字表') < 0 && v.indexOf('学写字管理」') < 0) return;
      RENAMES.forEach(function (p) { v = v.replace(p[0], p[1]); });
      if (v !== root.nodeValue) root.nodeValue = v;
      return;
    }
    if (root.nodeType !== 1 || root.id === 't-pane-group') return;
    var t = root.textContent;
    if (t.indexOf('上传新字表') < 0 && t.indexOf('学写字管理」') < 0) return;
    for (var c = root.firstChild; c; c = c.nextSibling) fixText(c);
  }

  buildTab();
  document.addEventListener('DOMContentLoaded', function () {
    buildTab();
    wirePane();
    setupWritePane();
    fixText(document.body);
    new MutationObserver(function (records) {
      records.forEach(function (rec) { rec.addedNodes.forEach(fixText); });
    }).observe(document.body, { childList: true, subtree: true });
  });

  W.AddChars = { unsorted: unsortedChars, refresh: refreshPickers };
})();
