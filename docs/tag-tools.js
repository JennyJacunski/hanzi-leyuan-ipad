'use strict';
/*
 * tag-tools.js — the teacher's 标签 on 学习 → 📚 全部生字 (decided 2026-11-23).
 *
 * The grade row shows only 一年级…四年级 and one button, “偏旁部首归类”, that
 * holds every teacher tag (and “未分类”, see add-chars.js). It opens:
 *
 *   the overview   one card per tag (here called a 类): its 偏旁 in large
 *                  type, name, number of characters, the first few, and the
 *                  teacher's note. Two orders: 按偏旁部首 (cards) or 按名称和
 *                  注释 (a list that is easier to read for long notes).
 *   one 类         its title, note and all its character cards, with
 *                  ← 返回偏旁部首归类 and ◀ 上一类 / 下一类 ▶ to go through
 *                  them one by one, and:
 *                    📝 生成描红练习  everyone: the tracing window with this
 *                                     类's characters (all or some), the note
 *                                     printed on every page; save PDF or print
 *                    ✏️ 修改          teachers: name, note, 偏旁
 *                    🗑 删除这个标签   teachers, real tags only. Characters from
 *                                     the app's own list only leave the tag;
 *                                     ones the teacher added are deleted with
 *                                     it unless another tag, a week or a 自选
 *                                     描红练习 still uses them. A confirm says
 *                                     exactly what will happen first.
 *
 * The 偏旁 of a 类: what the teacher set, else worked out — the radical
 * (char-info.js) most of its characters share (at least 2 characters, 60 %).
 * “含有青” has no shared radical, so it shows its name unless the teacher
 * sets “青”.
 *
 * Data: a tag stays {key, label} in OVERLAY.groups, with two optional
 * fields, note and radical. The page keeps groups as they are, so they are
 * saved, exported and imported with the rest; the web version ignores them.
 * Showing tags this way changes no data; the test page still lists them.
 * It must not: change how a character card draws, or delete anything from
 * the app's own character list.
 *
 * Opened in a normal browser (no window.desktopApp), this file does nothing.
 */
(function () {
  if (!window.desktopApp || !window.TracingUI) return;
  var W = window;
  var UNSORTED = '__unsorted__';
  var RADICALS = '__radicals__';
  var GRADE_KEYS = ['g1', 'g2', 'g3', 'g4'];
  var VIEW_KEY = 'hanzi_radical_view';
  var HAN = /[㐀-䶿一-鿿豈-﫿⺀-⿕]/;

  function el(id) { return document.getElementById(id); }
  function O() { return W.OVERLAY; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function hasCard(ch) { return W.getCardsForChar(ch).length > 0; }

  var view = 'radical';
  try { if (localStorage.getItem(VIEW_KEY) === 'name') view = 'name'; } catch (e) { /* storage unavailable */ }

  /* ---- styles --------------------------------------------------------------- */
  var style = document.createElement('style');
  style.textContent =
    '#view-learn.rg-overview-on #btn-print-learn{display:none !important;}' +
    '.rg-overview{grid-column:1/-1;}' +
    '.rg-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 14px;}' +
    '.rg-head .t-hint{margin:0;}' +
    '.rg-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;}' +
    '.rg-card,.rg-row{all:unset;box-sizing:border-box;cursor:pointer;background:var(--panel);border:1px solid var(--line);border-radius:16px;' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.05);color:var(--ink);transition:transform .12s,box-shadow .12s;}' +
    '.rg-card:hover,.rg-row:hover,.rg-card:focus-visible,.rg-row:focus-visible{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,0.1);}' +
    '.rg-card{display:flex;flex-direction:column;gap:6px;padding:14px 16px;min-height:180px;}' +
    '.rg-radical{font-family:"Kaiti SC","STKaiti",KaiTi,serif;font-size:54px;line-height:1;color:var(--jade);}' +
    '.rg-noradical{font-size:22px;font-weight:700;line-height:1.3;color:var(--jade);}' +
    '.rg-name{font-size:17px;font-weight:700;}' +
    '.rg-count{font-size:13px;color:var(--ink-soft);}' +
    '.rg-chars{font-family:"Kaiti SC","STKaiti",KaiTi,serif;font-size:20px;letter-spacing:2px;color:var(--ink);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}' +
    '.rg-note{font-size:13px;color:var(--ink-soft);line-height:1.5;}' +
    '.rg-list{display:flex;flex-direction:column;gap:10px;}' +
    '.rg-row{display:grid;grid-template-columns:64px minmax(140px,1fr) 2fr auto;align-items:center;gap:14px;padding:10px 16px;}' +
    '.rg-row .rg-radical{font-size:40px;text-align:center;}' +
    '.rg-row .rg-noradical{font-size:15px;text-align:center;}' +
    '.rg-row .rg-text{display:flex;flex-direction:column;gap:2px;min-width:0;}' +
    '.tag-section{margin:0 0 14px;padding:14px 18px;background:var(--panel);border:1px solid var(--line);border-radius:16px;}' +
    '.tag-section[hidden],.tag-section [hidden],.tag-section-foot[hidden]{display:none !important;}' +
    '.tag-section-title{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:10px 0 4px;}' +
    '.tag-section-title h2{margin:0;font-size:24px;}' +
    '.tag-section-title .rg-radical{font-size:46px;}' +
    '.tag-section-note{margin:2px 0 10px;font-size:15px;color:var(--ink-soft);line-height:1.6;}' +
    '.tag-section-actions{display:flex;gap:8px;flex-wrap:wrap;}' +
    '.tag-edit{margin-top:12px;padding-top:12px;border-top:1px dashed var(--line);}' +
    '.tag-edit .t-row label{display:flex;align-items:center;gap:8px;flex:1;min-width:220px;font-size:14px;}' +
    '.tag-edit input[type="text"]{flex:1;padding:8px 10px;border-radius:9px;border:1px solid var(--line);font-size:14px;background:var(--panel);color:var(--ink);}' +
    '.tag-section-foot{display:flex;gap:10px;margin:16px 0 4px;}' +
    '#tag-next{margin-left:auto;}';
  document.head.appendChild(style);

  /* ---- the 类 ------------------------------------------------------------------ */
  function sections() {
    var list = (O().groups || []).map(function (g) {
      return { key: g.key, label: g.label, note: g.note || '', radical: g.radical || '',
        chars: O().groupChars[g.key] || [], real: true };
    });
    var loose = W.findGroup(UNSORTED);
    if (loose) list.push({ key: UNSORTED, label: loose.label, note: '老师加的、还没有标签也不在任何一周里的字', radical: '', chars: loose.chars, real: false });
    return list;
  }
  function findSection(key) { return sections().filter(function (s) { return s.key === key; })[0] || null; }

  function autoRadical(chars) {
    var info = W.CHAR_INFO || {};
    var shown = chars.filter(hasCard);
    if (shown.length < 2) return '';
    var count = {}, best = '', n = 0;
    shown.forEach(function (ch) {
      var r = info[ch] && info[ch][0];
      if (!r) return;
      count[r] = (count[r] || 0) + 1;
      if (count[r] > n) { n = count[r]; best = r; }
    });
    return n / shown.length >= 0.6 ? best : '';
  }
  function radicalOf(sec) { return sec.radical || autoRadical(sec.chars); }

  function ordered() {
    var list = sections();
    var loose = list.filter(function (s) { return !s.real; });
    var real = list.filter(function (s) { return s.real; });
    var zh = function (a, b) { return a.localeCompare(b, 'zh-Hans-CN'); };
    if (view === 'radical') {
      real.sort(function (a, b) {
        var ra = radicalOf(a), rb = radicalOf(b);
        if (!!ra !== !!rb) return ra ? -1 : 1; // those with a 偏旁 first
        return (ra && rb && ra !== rb) ? zh(ra, rb) : zh(a.label, b.label);
      });
    } else {
      real.sort(function (a, b) { return zh(a.label, b.label); });
    }
    return real.concat(loose);
  }

  /* The 类 shown now, or null (a grade, or the overview). */
  function currentTag() {
    var key = W.learnState && W.learnState.group;
    if (!key || key === RADICALS || GRADE_KEYS.indexOf(key) >= 0) return null;
    return findSection(key);
  }
  function inRadicals() { return W.learnState.group === RADICALS || !!currentTag(); }

  /* ---- the grade row ---------------------------------------------------------- */
  var pagePopulateGradeSeg = W.populateGradeSeg;
  W.populateGradeSeg = function () {
    var r = pagePopulateGradeSeg.apply(this, arguments);
    var seg = el('learn-grade-seg');
    if (!seg) return r;
    seg.querySelectorAll('button[data-group]').forEach(function (b) {
      if (GRADE_KEYS.indexOf(b.dataset.group) < 0) b.remove();
    });
    if (sections().length) {
      var btn = document.createElement('button');
      btn.dataset.group = RADICALS;
      btn.textContent = '偏旁部首归类';
      if (inRadicals()) btn.className = 'active';
      btn.addEventListener('click', function () {
        seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
        btn.classList.add('active');
        open(RADICALS);
      });
      seg.appendChild(btn);
    }
    return r;
  };

  /* ---- drawing ------------------------------------------------------------------ */
  function radicalHtml(sec, cls) {
    var r = radicalOf(sec);
    return r ? '<span class="rg-radical ' + (cls || '') + '">' + esc(r) + '</span>'
      : '<span class="rg-noradical ' + (cls || '') + '">' + esc(sec.label) + '</span>';
  }
  function preview(sec) { return sec.chars.filter(hasCard).slice(0, 12).join(''); }
  function countText(sec) { return sec.chars.filter(hasCard).length + ' 个字'; }

  function overviewHtml() {
    var list = ordered();
    var head = '<div class="rg-head"><div class="seg rg-view">' +
        '<button type="button" data-rgview="radical" class="' + (view === 'radical' ? 'active' : '') + '">按偏旁部首</button>' +
        '<button type="button" data-rgview="name" class="' + (view === 'name' ? 'active' : '') + '">按名称和注释</button>' +
      '</div><span class="t-hint">点一类，看这一类的全部字</span></div>';
    var body;
    if (view === 'radical') {
      body = '<div class="rg-cards">' + list.map(function (s) {
        return '<button type="button" class="rg-card" data-section="' + esc(s.key) + '">' + radicalHtml(s) +
          (radicalOf(s) ? '<span class="rg-name">' + esc(s.label) + '</span>' : '') +
          '<span class="rg-count">' + countText(s) + '</span>' +
          '<span class="rg-chars">' + esc(preview(s)) + '</span>' +
          (s.note ? '<span class="rg-note">' + esc(s.note) + '</span>' : '') + '</button>';
      }).join('') + '</div>';
    } else {
      body = '<div class="rg-list">' + list.map(function (s) {
        return '<button type="button" class="rg-row" data-section="' + esc(s.key) + '">' +
          (radicalOf(s) ? '<span class="rg-radical">' + esc(radicalOf(s)) + '</span>' : '<span class="rg-noradical">—</span>') +
          '<span class="rg-text"><span class="rg-name">' + esc(s.label) + '</span><span class="rg-count">' + countText(s) + '</span></span>' +
          '<span class="rg-note">' + esc(s.note || '') + '</span>' +
          '<span class="rg-chars">' + esc(preview(s)) + '</span></button>';
      }).join('') + '</div>';
    }
    return '<div class="rg-overview" id="rg-overview">' + head + body + '</div>';
  }

  function build() {
    if (el('tag-section')) return;
    var grid = el('char-grid');
    if (!grid) return;
    var box = document.createElement('div');
    box.className = 'tag-section';
    box.id = 'tag-section';
    box.hidden = true;
    box.innerHTML =
      '<button class="btn tiny" id="tag-back" type="button">← 返回偏旁部首归类</button>' +
      '<div class="tag-section-title"><span id="tag-sec-radical"></span><h2 id="tag-sec-name"></h2><span class="count-pill" id="tag-sec-count"></span></div>' +
      '<p class="tag-section-note" id="tag-sec-note"></p>' +
      '<div class="tag-section-actions">' +
        '<button class="btn" id="tag-tracing" type="button">📝 生成描红练习</button>' +
        '<button class="btn" id="tag-edit-btn" type="button">✏️ 修改名称、注释、偏旁</button>' +
        '<button class="btn danger" id="tag-delete" type="button">🗑 删除这个标签</button>' +
      '</div>' +
      '<div class="tag-edit" id="tag-edit" hidden>' +
        '<div class="t-row"><label>名称 <input type="text" id="tag-edit-name"></label></div>' +
        '<div class="t-row"><label>注释 <input type="text" id="tag-edit-note" placeholder="可选，例如：走之旁要最后写"></label></div>' +
        '<div class="t-row"><label>偏旁 <input type="text" id="tag-edit-radical" maxlength="2"></label></div>' +
        '<div class="t-row"><button class="btn primary" id="tag-edit-save" type="button">保存</button>' +
          '<button class="btn" id="tag-edit-cancel" type="button">取消</button><span class="t-status" id="tag-edit-status"></span></div>' +
      '</div>';
    grid.insertAdjacentElement('beforebegin', box);
    var foot = document.createElement('div');
    foot.className = 'tag-section-foot';
    foot.id = 'tag-section-foot';
    foot.hidden = true;
    foot.innerHTML = '<button class="btn" id="tag-prev" type="button"></button><button class="btn" id="tag-next" type="button"></button>';
    grid.insertAdjacentElement('afterend', foot);

    el('tag-back').addEventListener('click', function () { open(RADICALS); });
    el('tag-tracing').addEventListener('click', openTracing);
    el('tag-delete').addEventListener('click', askDelete);
    el('tag-edit-btn').addEventListener('click', startEdit);
    el('tag-edit-cancel').addEventListener('click', function () { el('tag-edit').hidden = true; });
    el('tag-edit-save').addEventListener('click', saveEdit);
    ['tag-prev', 'tag-next'].forEach(function (id) {
      el(id).addEventListener('click', function () { if (el(id).dataset.key) open(el(id).dataset.key); });
    });
    // the overview's own buttons live inside the grid
    grid.addEventListener('click', function (e) {
      var v = e.target.closest('[data-rgview]');
      if (v) {
        view = v.dataset.rgview;
        try { localStorage.setItem(VIEW_KEY, view); } catch (err) { /* ignore */ }
        W.renderLearnGrid();
        return;
      }
      var s = e.target.closest('[data-section]');
      if (s) open(s.dataset.section);
    });
  }

  /* Show the overview (RADICALS) or one 类. */
  function open(key) {
    W.learnState.group = key;
    W.learnState.query = '';
    var back = el('btn-learn-back');
    if (back) back.style.display = 'none';
    W.populateGradeSeg();
    W.renderLearnGrid();
    var v = el('view-learn');
    if (v && v.getBoundingClientRect().top < 0 && v.scrollIntoView) v.scrollIntoView({ block: 'start' });
  }

  function update() {
    var v = el('view-learn');
    var box = el('tag-section'), foot = el('tag-section-foot');
    if (!v || !box) return;
    var overview = W.learnState.group === RADICALS;
    var sec = currentTag();
    v.classList.toggle('rg-overview-on', overview);
    box.hidden = !sec;
    foot.hidden = !sec || !!W.learnState.query;
    if (!sec) { el('tag-edit').hidden = true; return; }
    if (box.dataset.key !== sec.key) el('tag-edit').hidden = true;
    box.dataset.key = sec.key;
    el('tag-sec-radical').innerHTML = radicalOf(sec) ? '<span class="rg-radical">' + esc(radicalOf(sec)) + '</span>' : '';
    el('tag-sec-name').textContent = sec.label;
    el('tag-sec-count').textContent = countText(sec);
    el('tag-sec-note').textContent = sec.note;
    el('tag-sec-note').hidden = !sec.note;
    var filtered = !!W.learnState.query;
    el('tag-tracing').hidden = filtered;
    el('tag-tracing').disabled = !sec.chars.some(hasCard);
    el('tag-edit-btn').hidden = filtered || !(sec.real && W.teacherMode);
    el('tag-delete').hidden = filtered || !(sec.real && W.teacherMode);
    if (!W.teacherMode) el('tag-edit').hidden = true;
    var list = ordered(), i = list.map(function (s) { return s.key; }).indexOf(sec.key);
    var prev = list[i - 1], next = list[i + 1];
    el('tag-prev').hidden = !prev;
    el('tag-next').hidden = !next;
    el('tag-prev').dataset.key = prev ? prev.key : '';
    el('tag-next').dataset.key = next ? next.key : '';
    el('tag-prev').textContent = prev ? '◀ 上一类：' + prev.label : '';
    el('tag-next').textContent = next ? '下一类：' + next.label + ' ▶' : '';
  }

  var pageRenderLearnGrid = W.renderLearnGrid;
  W.renderLearnGrid = function () {
    if (W.learnState.group === RADICALS) {
      if (!sections().length) { // nothing left to show: back to the first grade
        W.learnState.group = 'g1';
        W.populateGradeSeg();
      } else {
        el('char-grid').innerHTML = overviewHtml();
        el('learn-count').textContent = sections().length + ' 类';
        update();
        return;
      }
    }
    var r = pageRenderLearnGrid.apply(this, arguments);
    update();
    return r;
  };
  var pageApplyTeacherUI = W.applyTeacherUI;
  W.applyTeacherUI = function () {
    var r = pageApplyTeacherUI.apply(this, arguments);
    update();
    return r;
  };

  /* ---- 📝 生成描红练习 ------------------------------------------------------------ */
  function openTracing() {
    var sec = currentTag();
    if (!sec) return;
    var chars = sec.chars.filter(hasCard);
    if (chars.length) W.TracingUI.open({ chars: chars, heading: sec.label, note: sec.real ? sec.note : '', extra: {} });
  }

  /* ---- ✏️ 修改名称、注释、偏旁 ------------------------------------------------------ */
  function startEdit() {
    var sec = currentTag();
    if (!sec || !sec.real || !W.teacherMode) return;
    el('tag-edit-name').value = sec.label;
    el('tag-edit-note').value = sec.note;
    el('tag-edit-radical').value = sec.radical;
    var auto = autoRadical(sec.chars);
    el('tag-edit-radical').placeholder = auto ? '不填就用自动找到的“' + auto + '”' : '可选，例如：青';
    el('tag-edit-status').textContent = '';
    el('tag-edit').hidden = false;
    el('tag-edit-name').focus();
  }
  function saveEdit() {
    var sec = currentTag();
    if (!sec || !sec.real) return;
    var status = el('tag-edit-status');
    var label = el('tag-edit-name').value.trim();
    if (!label) { status.textContent = '请填写名称'; status.className = 't-status err'; return; }
    if ((O().groups || []).some(function (g) { return g.key !== sec.key && g.label === label; })) {
      status.textContent = '已经有一个叫“' + label + '”的标签了'; status.className = 't-status err'; return;
    }
    var radical = Array.from(el('tag-edit-radical').value.trim()).filter(function (c) { return HAN.test(c); })[0] || '';
    var g = O().groups.filter(function (x) { return x.key === sec.key; })[0];
    g.label = label;
    var note = el('tag-edit-note').value.trim();
    if (note) g.note = note; else delete g.note;
    if (radical) g.radical = radical; else delete g.radical;
    el('tag-edit').hidden = true;
    W.renderCustomGroupChips();
    if (typeof W.updatePoolCount === 'function') W.updatePoolCount();
    if (W.AddChars) W.AddChars.refresh();
    W.renderLearnGrid();
    W.queueSave();
  }

  /* ---- 🗑 删除这个标签 ------------------------------------------------------------- */
  // Is this character still used outside the tag being deleted?
  function usedElsewhere(ch, key) {
    var o = O();
    if ((o.groups || []).some(function (g) { return g.key !== key && (o.groupChars[g.key] || []).indexOf(ch) >= 0; })) return true;
    if ((o.writingUnits || []).some(function (u) { return (u.chars || []).indexOf(ch) >= 0; })) return true;
    if ((o.tracingSets || []).some(function (s) { return (s.chars || []).indexOf(ch) >= 0; })) return true;
    return false;
  }

  /* What deleting this tag would do: {own, kept, removed}. */
  function planDelete(tag) {
    var own = [], kept = [], removed = [];
    tag.chars.forEach(function (ch) {
      if (W.BASE_CHAR_SET[ch] || !O().newCharBase[ch]) own.push(ch);
      else if (usedElsewhere(ch, tag.key)) kept.push(ch);
      else removed.push(ch);
    });
    return { own: own, kept: kept, removed: removed };
  }

  // A character's own keys in the per-card maps: the character itself, its
  // other readings ('都@dū') and its word recordings ('都::w::首都').
  function belongsTo(key, ch) { return key === ch || key.indexOf(ch + '@') === 0 || key.indexOf(ch + '::') === 0; }
  function dropKeys(map, ch) {
    if (!map) return;
    Object.keys(map).forEach(function (k) { if (belongsTo(k, ch)) delete map[k]; });
  }

  function deleteTag(tag, plan) {
    var o = O();
    plan.removed.forEach(function (ch) {
      delete o.newCharBase[ch];
      delete o.extraReadings[ch];
      delete o.customStrokeData[ch];
      [o.customAudio, o.charEdits, o.extraWords, o.deletedCards].forEach(function (m) { dropKeys(m, ch); });
    });
    o.groups = o.groups.filter(function (g) { return g.key !== tag.key; });
    delete o.groupChars[tag.key];
    if (W.testConfig && W.testConfig.customGroups) delete W.testConfig.customGroups[tag.key];

    W.renderCustomGroupChips();
    if (typeof W.updatePoolCount === 'function') W.updatePoolCount();
    if (W.AddChars) W.AddChars.refresh();
    open(sections().length ? RADICALS : 'g1');
    W.queueSave();
  }

  function askDelete() {
    var tag = currentTag();
    if (!tag || !tag.real || !W.teacherMode) return;
    var plan = planDelete(tag);
    var parts = ['删除标签“' + tag.label + '”。'];
    if (plan.removed.length) parts.push(plan.removed.length + ' 个老师加的新字会从字库删除（连同拼音、组词、录音）：' + plan.removed.join('、') + '。');
    if (plan.kept.length) parts.push(plan.kept.length + ' 个老师加的字还在别的标签、每周生字或自选描红练习里用着，保留：' + plan.kept.join('、') + '。');
    if (plan.own.length) parts.push(plan.own.length + ' 个字库原有的字只移出这个标签，字本身不删。');
    if (!tag.chars.length) parts.push('这个标签里没有字。');
    parts.push('删除后不能撤销。');
    W.openConfirmModal('删除这个标签？', parts.join(''), '删除', function (ok) {
      if (ok) deleteTag(tag, plan);
    });
  }

  build();
  document.addEventListener('DOMContentLoaded', function () {
    build();
    W.populateGradeSeg();
    W.renderLearnGrid();
  });

  W.TagTools = {
    current: currentTag,
    sections: function () { return ordered().map(function (s) { return { key: s.key, label: s.label, radical: radicalOf(s), note: s.note }; }); },
    open: open,
    plan: function () { var t = currentTag(); return t && t.real ? planDelete(t) : null; },
  };
})();
