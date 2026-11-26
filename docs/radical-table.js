'use strict';
/*
 * radical-table.js — 📖 偏旁总表 inside 学习 → 📚 全部生字 → 偏旁部首归类
 * (decided 2026-11-25).
 *
 * The teacher writes a list of 偏旁 sorted by meaning, e.g.
 *     与人、身体有关
 *     * 亻（人字旁）：他、们、你、住
 *     * 手（扌，提手旁）：打、找、拿、推
 * and students look up characters by 偏旁 and see which 偏旁 there are.
 *
 * It owns:
 *   - the list in the teacher data: OVERLAY.radicalTable = [
 *       { id, category: '与人、身体有关', forms: ['手', '扌'], name: '提手旁',
 *         examples: ['打', '找', '拿', '推'] } ]
 *     The order of the list is the order on screen; categories appear in the
 *     order of their first 偏旁. If the data has no radicalTable at all (a
 *     teacher who never edited it), the starter list below is used.
 *   - the 偏旁总表 overview (tag-tools.js draws the frame and asks for it):
 *     a short note on where 偏旁 sit (左右 / 上下 / 包围 / 独体), the 偏旁
 *     by category, and, folded, the other 偏旁 found in the character list;
 *   - one 偏旁's page (learnState.group 'rad:<id>', or 'rad:=<偏旁>' for one
 *     of the other 偏旁): the teacher's 例字 first, then every character in
 *     the list with that 偏旁 (char-info.js), grouped by structure, with
 *     📝 生成描红练习 and 上一个 / 下一个;
 *   - the teacher's editor: paste a whole list in the format above (shown
 *     first, saved only after 保存), or change, add, move or delete rows.
 * A character belongs to a 偏旁 when its radical in char-info.js is one of
 * the 偏旁's forms (so 手 and 扌 together cover 拿 and 打). 例字 not in the
 * character list are shown as text, marked, and never added automatically.
 * It must not: change tags (tag-tools.js), add or delete characters, or
 * change how a character card draws.
 *
 * Why the list is read from the data tag: as in tracing-sets.js, the page's
 * own loading code keeps only the fields it knows.
 *
 * Opened in a normal browser (no window.desktopApp), this file does nothing.
 */
(function () {
  if (!window.desktopApp || !window.TracingUI || !window.TagTools) return;
  var W = window;
  var PREFIX = 'rad:';
  var RADICALS = '__radicals__';
  var HAN = /[㐀-䶿一-鿿豈-﫿⺀-⿕]/;
  // char-info.js writes a few 偏旁 in their special radical form
  var SAME = { '月': ['⺼'], '肉': ['⺼'], '竹': ['⺮'], '⻊': ['足'], '⺮': ['竹'] };
  // …and those forms look like another 偏旁 (⺼ is drawn as 月), so they get a name
  var SPECIAL_NAME = { '⺼': '肉月旁', '⺮': '竹字头', '⺌': '小字头', '⺗': '心字底', '⺳': '网字头', '⺊': '卜字头', '⺀': '两点' };
  var STRUCT_GROUP = { 5: '左右结构', 11: '左右结构', 2: '上下结构', 8: '上下结构',
    4: '包围结构', 6: '包围结构', 7: '包围结构', 9: '包围结构', 10: '包围结构', 0: '独体字', 1: '独体字', 3: '独体字' };
  var STRUCT_ORDER = ['左右结构', '上下结构', '包围结构', '独体字'];

  var STARTER =
    '与人、身体有关\n' +
    '* 亻（人字旁）：他、们、你、住\n' +
    '* 口：吃、吗、名、和\n' +
    '* 目：眼、看、睡、睛\n' +
    '* 手（扌，提手旁）：打、找、拿、推\n' +
    '* 足（⻊，足字旁）：跑、跳、路、踢\n' +
    '与心理、情感有关\n' +
    '* 忄（竖心旁）：情、快、慢、怕\n' +
    '* 心：思、想、意、志\n' +
    '与自然、天地有关\n' +
    '* 氵（三点水）：河、海、清、法\n' +
    '* 火（灬，四点底）：热、点、然、照\n' +
    '* 木：林、树、材、校\n' +
    '* 石：破、矿、码、础\n' +
    '* 土：地、城、场、坏\n' +
    '* 日：时、明、早、晴\n' +
    '与语言、符号有关\n' +
    '* 讠（言字旁）：说、话、语、请\n' +
    '* 纟（绞丝旁）：红、线、纸、练\n' +
    '与饮食、器物有关\n' +
    '* 饣（食字旁）：饭、饱、饿、饺\n' +
    '* 钅（金字旁）：银、铁、钱、钟\n' +
    '* 犭（反犬旁）：狗、猫、猪、狼\n' +
    '* 礻（示字旁）：神、社、祝、祖\n' +
    '与行动、位置有关\n' +
    '* 辶（走之旁）：过、这、进、道\n' +
    '* 门：问、间、闻、闭\n' +
    '* 女：好、她、妈、姐\n';

  function el(id) { return document.getElementById(id); }
  function O() { return W.OVERLAY; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function hanChars(text) { return Array.from(String(text || '')).filter(function (c) { return HAN.test(c); }); }
  function uniq(list) { var seen = {}; return list.filter(function (c) { if (seen[c]) return false; seen[c] = true; return true; }); }
  function hasCard(ch) { return W.getCardsForChar(ch).length > 0; }
  var idCount = 0;
  function newId() { idCount += 1; return 'r' + Date.now().toString(36) + idCount; }

  /* ---- reading a pasted list ------------------------------------------------- */
  // "* 手（扌，提手旁）：打、找、拿、推" → {forms, name, examples}; null if not such a line
  var LINE = /^[\s*•·\-–—]*([^\s（(：:]{1,3})\s*(?:[（(]([^）)]*)[）)])?\s*[：:]\s*(.*)$/;
  function parseLine(line) {
    var m = LINE.exec(line);
    if (!m) return null;
    var main = Array.from(m[1]);
    if (!main.every(function (c) { return HAN.test(c); }) || main.length > 2) return null;
    var forms = main.slice(), names = [];
    (m[2] || '').split(/[，,、;；\s]+/).forEach(function (t) {
      if (!t) return;
      if (Array.from(t).length === 1 && HAN.test(t)) forms.push(t); else names.push(t);
    });
    return { forms: uniq(forms), name: names.join('，'), examples: uniq(hanChars(m[3])) };
  }
  /* The whole text → {rows, ignored}: rows carry their category. */
  function parseText(text) {
    var rows = [], ignored = [], category = '';
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var r = parseLine(line);
      if (r) { r.category = category || '其他'; rows.push(r); return; }
      var plain = line.replace(/^[#\s*•·\-–—]+/, '').replace(/[：:。.]+$/, '').trim();
      if (plain && Array.from(plain).length <= 20 && hanChars(plain).length) category = plain;
      else ignored.push(line);
    });
    return { rows: rows, ignored: ignored };
  }

  /* ---- the data ---------------------------------------------------------------- */
  (function restore() {
    var list = null;
    try {
      var tag = document.getElementById('overlay-data');
      var raw = tag && tag.textContent.trim() ? JSON.parse(tag.textContent) : {};
      if (Array.isArray(raw.radicalTable)) list = raw.radicalTable;
    } catch (e) { console.error('偏旁总表读取失败', e); }
    if (!list) list = parseText(STARTER).rows.map(function (r) { r.id = newId(); return r; });
    O().radicalTable = list.filter(function (r) { return r && r.id && r.forms && r.forms.length; });
  })();
  function table() { return O().radicalTable || (O().radicalTable = []); }
  function findEntry(id) { return table().filter(function (r) { return r.id === id; })[0] || null; }

  /* Every character that has a card: the app's own list, then the teacher's. */
  function libraryChars() {
    var out = Object.keys(W.BASE_CHAR_SET || {}).concat(Object.keys(O().newCharBase || {}));
    return uniq(out).filter(hasCard);
  }
  function radicalOfChar(ch) { var i = W.CHAR_INFO && W.CHAR_INFO[ch]; return i ? i[0] : ''; }
  function matchSet(forms) {
    var set = {};
    forms.forEach(function (f) { set[f] = true; (SAME[f] || []).forEach(function (g) { set[g] = true; }); });
    return set;
  }
  function charsFor(forms, lib) {
    var set = matchSet(forms);
    return (lib || libraryChars()).filter(function (ch) { return set[radicalOfChar(ch)]; });
  }
  /* 偏旁 found in the character list that no row of the table covers. */
  function others(lib) {
    lib = lib || libraryChars();
    var covered = {};
    table().forEach(function (r) { Object.keys(matchSet(r.forms)).forEach(function (f) { covered[f] = true; }); });
    var count = {};
    lib.forEach(function (ch) { var r = radicalOfChar(ch); if (r && !covered[r]) count[r] = (count[r] || 0) + 1; });
    return Object.keys(count).sort(function (a, b) { return count[b] - count[a] || a.localeCompare(b, 'zh-Hans-CN'); })
      .map(function (r) { return { form: r, count: count[r] }; });
  }
  function hasAny() { return table().length > 0 || libraryChars().length > 0; }

  /* A page: {key, forms, name, category, examples, entry} or null. */
  function pageFor(key) {
    if (!key || key.indexOf(PREFIX) !== 0) return null;
    var rest = key.slice(PREFIX.length);
    if (rest.charAt(0) === '=') {
      var f = rest.slice(1);
      return f ? { key: key, forms: [f], name: SPECIAL_NAME[f] || '', category: '', examples: [], entry: null } : null;
    }
    var e = findEntry(rest);
    return e ? { key: key, forms: e.forms, name: e.name || '', category: e.category || '', examples: e.examples || [], entry: e } : null;
  }
  function pageKeys() {
    return table().map(function (r) { return PREFIX + r.id; })
      .concat(others().map(function (o) { return PREFIX + '=' + o.form; }));
  }
  function titleOf(p) { return p.forms.join(' ') + (p.name ? '（' + p.name + '）' : ''); }
  function shortTitle(p) { return p.forms[0] + (p.name ? ' ' + p.name : ''); }

  /* The page's characters in order, with where each structure group starts. */
  function layout(p) {
    var lib = libraryChars();
    var ex = p.examples.filter(hasCard);
    var rest = charsFor(p.forms, lib).filter(function (ch) { return ex.indexOf(ch) < 0; });
    var groups = {};
    rest.forEach(function (ch) {
      var info = W.CHAR_INFO[ch];
      var g = p.forms.indexOf(ch) >= 0 ? '独体字' : (STRUCT_GROUP[info ? info[1] : 0] || '独体字');
      (groups[g] = groups[g] || []).push(ch);
    });
    var parts = [];
    if (ex.length) parts.push({ title: '老师的例字', chars: ex });
    STRUCT_ORDER.forEach(function (g) { if (groups[g]) parts.push({ title: g, chars: groups[g] }); });
    return parts;
  }
  function pageChars(p) { return [].concat.apply([], layout(p).map(function (x) { return x.chars; })); }

  /* ---- styles --------------------------------------------------------------- */
  var style = document.createElement('style');
  style.textContent =
    '.rt-intro{margin:0 0 16px;padding:12px 16px;background:var(--panel);border:1px solid var(--line);border-radius:14px;}' +
    '.rt-intro h3{margin:0 0 8px;font-size:16px;}' +
    '.rt-structs{display:flex;flex-wrap:wrap;gap:10px 22px;font-size:14px;color:var(--ink-soft);}' +
    '.rt-structs b{font-family:"Kaiti SC","STKaiti",KaiTi,serif;font-size:24px;color:var(--ink);margin-right:6px;font-weight:400;}' +
    '.rt-cat{margin:18px 0 10px;font-size:18px;display:flex;align-items:baseline;gap:10px;}' +
    '.rt-cat small{font-size:13px;font-weight:400;color:var(--ink-soft);}' +
    '.rt-card{min-height:150px !important;}' +
    '.rt-forms{font-family:"Kaiti SC","STKaiti",KaiTi,serif;font-size:50px;line-height:1;color:var(--jade);letter-spacing:6px;}' +
    '.rt-ex{font-family:"Kaiti SC","STKaiti",KaiTi,serif;font-size:20px;letter-spacing:2px;}' +
    '.rt-missing{color:var(--ink-soft);opacity:.55;}' +
    '.rt-others{margin-top:22px;}' +
    '.rt-others summary{cursor:pointer;font-size:16px;font-weight:700;padding:6px 0;}' +
    '.rt-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}' +
    '.rt-chip{all:unset;cursor:pointer;box-sizing:border-box;padding:4px 10px;border:1px solid var(--line);border-radius:10px;background:var(--panel);' +
      'font-family:"Kaiti SC","STKaiti",KaiTi,serif;font-size:22px;}' +
    '.rt-chip small{font-family:system-ui,sans-serif;font-size:12px;color:var(--ink-soft);margin-left:4px;}' +
    '.rt-chip:hover,.rt-chip:focus-visible{border-color:var(--jade);}' +
    '.rt-empty{padding:18px;color:var(--ink-soft);}' +
    '.rt-group-head{grid-column:1/-1;margin:10px 0 0;font-size:16px;font-weight:700;color:var(--ink);' +
      'border-bottom:1px solid var(--line);padding-bottom:4px;}' +
    '.rt-group-head small{font-weight:400;color:var(--ink-soft);margin-left:8px;}' +
    '#rt-section .rg-radical{letter-spacing:6px;}' +
    '.rt-section-ex{margin:2px 0 10px;font-size:15px;color:var(--ink-soft);line-height:1.6;}' +
    '.rt-section-ex .rt-ex{font-size:22px;color:var(--ink);}' +
    '#rt-next{margin-left:auto;}' +
    '.rt-editor{grid-column:1/-1;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px;}' +
    '.rt-editor h3{margin:0 0 6px;}' +
    '.rt-editor textarea{width:100%;box-sizing:border-box;min-height:150px;padding:10px;border-radius:10px;border:1px solid var(--line);' +
      'font-size:14px;line-height:1.6;background:var(--panel);color:var(--ink);}' +
    '.rt-paste{margin:10px 0 14px;padding:10px 12px;border:1px dashed var(--line);border-radius:12px;}' +
    '.rt-paste summary{cursor:pointer;font-weight:700;}' +
    '.rt-preview{margin:8px 0;font-size:14px;line-height:1.7;}' +
    '.rt-preview .err{color:#c0392b;}' +
    '.rt-rows{width:100%;border-collapse:collapse;font-size:14px;}' +
    '.rt-rows th{text-align:left;font-weight:600;color:var(--ink-soft);padding:4px 6px;border-bottom:1px solid var(--line);}' +
    '.rt-rows td{padding:4px 6px;border-bottom:1px solid var(--line);vertical-align:middle;}' +
    '.rt-rows input{width:100%;box-sizing:border-box;padding:6px 8px;border-radius:8px;border:1px solid var(--line);font-size:14px;' +
      'background:var(--panel);color:var(--ink);}' +
    '.rt-rows .rt-f input{font-family:"Kaiti SC","STKaiti",KaiTi,serif;font-size:20px;}' +
    '.rt-rows tr.rt-focus td{background:rgba(46,139,87,0.10);}' +
    '.rt-rows .rt-act{white-space:nowrap;}' +
    '.rt-rows .rt-act button{padding:4px 8px;}' +
    '.rt-editor-foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;}';
  document.head.appendChild(style);

  /* ---- the overview ------------------------------------------------------------ */
  var editing = null;   // the editor's rows while it is open: [{id, category, forms, name, examples}] as text
  var focusId = '';

  function cardHtml(r, lib) {
    var n = charsFor(r.forms, lib).length;
    var ex = (r.examples || []).map(function (c) {
      return hasCard(c) ? esc(c) : '<span class="rt-missing" title="字库里还没有">' + esc(c) + '</span>';
    }).join('');
    return '<button type="button" class="rg-card rt-card" data-radical="' + esc(PREFIX + r.id) + '">' +
      '<span class="rt-forms">' + esc(r.forms.join(' ')) + '</span>' +
      (r.name ? '<span class="rg-name">' + esc(r.name) + '</span>' : '') +
      '<span class="rg-count">字库里 ' + n + ' 个字</span>' +
      (ex ? '<span class="rt-ex">' + ex + '</span>' : '') + '</button>';
  }

  function categories() {
    var order = [], by = {};
    table().forEach(function (r) {
      var c = r.category || '其他';
      if (!by[c]) { by[c] = []; order.push(c); }
      by[c].push(r);
    });
    return order.map(function (c) { return { name: c, rows: by[c] }; });
  }

  function overviewHtml() {
    if (editing && W.teacherMode) return editorHtml();
    editing = null;
    var lib = libraryChars();
    var html = '<div class="rt-intro"><h3>偏旁的位置</h3><div class="rt-structs">' +
      '<span><b>请</b>左右结构：偏旁在左边或右边</span>' +
      '<span><b>安</b>上下结构：偏旁在上面或下面</span>' +
      '<span><b>园</b>包围结构：偏旁围在外面</span>' +
      '<span><b>人</b>独体字：不能再分开</span>' +
      '</div></div>';
    var cats = categories();
    if (!cats.length) html += '<div class="rt-empty">老师还没有写偏旁表。' + (W.teacherMode ? '点上面的“✏️ 编辑偏旁表”开始写。' : '') + '</div>';
    cats.forEach(function (c) {
      html += '<h3 class="rt-cat">' + esc(c.name) + '<small>' + c.rows.length + ' 个偏旁</small></h3>' +
        '<div class="rg-cards">' + c.rows.map(function (r) { return cardHtml(r, lib); }).join('') + '</div>';
    });
    var rest = others(lib);
    if (rest.length) {
      html += '<details class="rt-others" id="rt-others"><summary>字库里的其他偏旁（' + rest.length + ' 个）</summary>' +
        '<p class="t-hint">这些偏旁上面的表里没有，数字是字库里有几个这样的字。点一个看看这些字。</p><div class="rt-chips">' +
        rest.map(function (o) {
          return '<button type="button" class="rt-chip" data-radical="' + esc(PREFIX + '=' + o.form) + '">' + esc(o.form) +
            '<small>' + (SPECIAL_NAME[o.form] ? esc(SPECIAL_NAME[o.form]) + ' · ' : '') + o.count + '</small></button>';
        }).join('') + '</div></details>';
    }
    return html;
  }
  function headButtonsHtml() {
    return W.teacherMode && !editing ? '<button class="btn" type="button" id="rt-edit-open">✏️ 编辑偏旁表</button>' : '';
  }

  /* ---- the editor (teachers) --------------------------------------------------- */
  function toEditRow(r) {
    return { id: r.id || '', category: r.category || '', forms: (r.forms || []).join(' '), name: r.name || '', examples: (r.examples || []).join('') };
  }
  /* `id`: the row to highlight; `addForm`: a 偏旁 to add as a new row (from one of the other 偏旁). */
  function startEditing(id, addForm) {
    editing = table().map(toEditRow);
    focusId = id || '';
    if (addForm) {
      focusId = newId();
      editing.push({ id: focusId, category: '', forms: addForm, name: SPECIAL_NAME[addForm] || '', examples: '' });
    }
    pasteState = { text: '', parsed: null };
    W.TagTools.open(RADICALS, 'table');
    var row = document.querySelector('#rt-editor tr.rt-focus');
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'center' });
  }
  var pasteState = { text: '', parsed: null };

  function editorHtml() {
    var p = pasteState.parsed, preview = '';
    if (p) {
      var cats = uniq(p.rows.map(function (r) { return r.category; }));
      preview = '<div class="rt-preview" id="rt-paste-preview">认出 ' + cats.length + ' 类、' + p.rows.length + ' 个偏旁：' +
        cats.map(function (c) {
          return '<br><b>' + esc(c) + '</b>：' + p.rows.filter(function (r) { return r.category === c; })
            .map(function (r) { return esc(r.forms.join('') + (r.name ? '（' + r.name + '）' : '')); }).join('、');
        }).join('') +
        (p.ignored.length ? '<br><span class="err">没认出来、不会放进去的行：' + p.ignored.map(esc).join(' ／ ') + '</span>' : '') +
        (p.rows.length ? '<div class="rt-editor-foot"><button class="btn" type="button" id="rt-paste-replace">用这些替换下面整张表</button>' +
          '<button class="btn" type="button" id="rt-paste-append">加到下面的表后面</button></div>' : '') + '</div>';
    }
    var rows = editing.map(function (r, i) {
      return '<tr data-i="' + i + '"' + (r.id && r.id === focusId ? ' class="rt-focus"' : '') + '>' +
        '<td><input type="text" data-f="category" value="' + esc(r.category) + '" placeholder="例如：与人、身体有关"></td>' +
        '<td class="rt-f"><input type="text" data-f="forms" value="' + esc(r.forms) + '" placeholder="手 扌"></td>' +
        '<td><input type="text" data-f="name" value="' + esc(r.name) + '" placeholder="可不填"></td>' +
        '<td class="rt-f"><input type="text" data-f="examples" value="' + esc(r.examples) + '" placeholder="打找拿推"></td>' +
        '<td class="rt-act"><button class="btn tiny" type="button" data-rt-up="' + i + '" title="上移"' + (i ? '' : ' disabled') + '>↑</button>' +
          '<button class="btn tiny" type="button" data-rt-down="' + i + '" title="下移"' + (i < editing.length - 1 ? '' : ' disabled') + '>↓</button>' +
          '<button class="btn tiny danger" type="button" data-rt-del="' + i + '" title="删除这一行">🗑</button></td></tr>';
    }).join('');
    return '<div class="rt-editor" id="rt-editor"><h3>编辑偏旁表</h3>' +
      '<p class="t-hint">一行一个偏旁。“偏旁”一格可以写几种写法，例如“手 扌”：字库里偏旁是其中任何一个的字都算。分类相同的偏旁排在一起。点“保存”才会存下来。</p>' +
      '<details class="rt-paste"' + (p || !editing.length ? ' open' : '') + '><summary>整段粘贴</summary>' +
        '<p class="t-hint">格式：一行分类名，下面每行一个偏旁，例如<br>与人、身体有关<br>* 亻（人字旁）：他、们、你、住<br>* 手（扌，提手旁）：打、找、拿、推</p>' +
        '<textarea id="rt-paste-text" placeholder="把偏旁表粘贴在这里">' + esc(pasteState.text) + '</textarea>' +
        '<div class="rt-editor-foot"><button class="btn" type="button" id="rt-paste-read">认一认</button></div>' + preview +
      '</details>' +
      '<table class="rt-rows"><thead><tr><th style="width:24%">分类</th><th style="width:13%">偏旁</th><th style="width:18%">名称</th><th>例字</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<div class="rt-editor-foot"><button class="btn" type="button" id="rt-row-add">➕ 加一个偏旁</button></div>' +
      '<div class="rt-editor-foot"><button class="btn primary" type="button" id="rt-save">保存</button>' +
        '<button class="btn" type="button" id="rt-cancel">取消</button><span class="t-status" id="rt-status"></span></div></div>';
  }
  function rerender() { W.renderLearnGrid(); }
  function setStatus(text, err) { var s = el('rt-status'); if (s) { s.textContent = text; s.className = 't-status' + (err ? ' err' : ''); } }

  function saveEditing() {
    var rows = [], problems = [], seen = {};
    editing.forEach(function (r, i) {
      var forms = uniq(hanChars(r.forms));
      var blank = !forms.length && !r.name.trim() && !hanChars(r.examples).length && !r.category.trim();
      if (blank) return;
      if (!forms.length) { problems.push('第 ' + (i + 1) + ' 行没有写偏旁'); return; }
      forms.forEach(function (f) {
        if (seen[f]) problems.push('“' + f + '”写了两次（第 ' + seen[f] + ' 行和第 ' + (i + 1) + ' 行）');
        else seen[f] = i + 1;
      });
      rows.push({ id: r.id || newId(), category: r.category.trim() || '其他', forms: forms, name: r.name.trim(), examples: uniq(hanChars(r.examples)) });
    });
    if (problems.length) { setStatus(problems.join('；'), true); return false; }
    O().radicalTable = rows;
    editing = null;
    W.queueSave();
    rerender();
    return true;
  }

  function onEditorClick(e) {
    var t = e.target;
    if (t.id === 'rt-paste-read') {
      pasteState.text = el('rt-paste-text').value;
      pasteState.parsed = parseText(pasteState.text);
      rerender();
    } else if (t.id === 'rt-paste-replace' || t.id === 'rt-paste-append') {
      var add = pasteState.parsed.rows.map(function (r) { return toEditRow({ category: r.category, forms: r.forms, name: r.name, examples: r.examples }); });
      editing = t.id === 'rt-paste-replace' ? add : editing.concat(add);
      pasteState = { text: '', parsed: null };
      rerender();
      setStatus('已经放进表里，检查一下再点“保存”');
    } else if (t.id === 'rt-row-add') {
      var last = editing[editing.length - 1];
      editing.push({ id: '', category: last ? last.category : '', forms: '', name: '', examples: '' });
      rerender();
      var inputs = document.querySelectorAll('#rt-editor tr:last-child input[data-f="forms"]');
      if (inputs[0]) inputs[0].focus();
    } else if (t.dataset.rtUp !== undefined || t.dataset.rtDown !== undefined) {
      var i = Number(t.dataset.rtUp !== undefined ? t.dataset.rtUp : t.dataset.rtDown);
      var j = t.dataset.rtUp !== undefined ? i - 1 : i + 1;
      if (j < 0 || j >= editing.length) return;
      var x = editing[i]; editing[i] = editing[j]; editing[j] = x;
      rerender();
    } else if (t.dataset.rtDel !== undefined) {
      editing.splice(Number(t.dataset.rtDel), 1);
      rerender();
    } else if (t.id === 'rt-save') {
      saveEditing();
    } else if (t.id === 'rt-cancel') {
      editing = null;
      rerender();
    } else {
      return false;
    }
    return true;
  }

  /* ---- one 偏旁's page ---------------------------------------------------------- */
  var pageFindGroup = W.findGroup;
  W.findGroup = function (key) {
    var p = pageFor(key);
    if (p) return { key: key, label: titleOf(p), chars: pageChars(p) };
    return pageFindGroup.apply(this, arguments);
  };

  function build() {
    if (el('rt-section')) return;
    var grid = el('char-grid');
    if (!grid) return;
    var box = document.createElement('div');
    box.className = 'tag-section';
    box.id = 'rt-section';
    box.hidden = true;
    box.innerHTML =
      '<button class="btn tiny" id="rt-back" type="button">← 返回偏旁总表</button>' +
      '<div class="tag-section-title"><span class="rg-radical" id="rt-sec-forms"></span><h2 id="rt-sec-name"></h2><span class="count-pill" id="rt-sec-count"></span></div>' +
      '<p class="tag-section-note" id="rt-sec-cat"></p>' +
      '<p class="rt-section-ex" id="rt-sec-ex"></p>' +
      '<div class="tag-section-actions">' +
        '<button class="btn" id="rt-tracing" type="button">📝 生成描红练习</button>' +
        '<button class="btn" id="rt-edit-btn" type="button">✏️ 修改偏旁表</button>' +
      '</div>';
    grid.insertAdjacentElement('beforebegin', box);
    var foot = document.createElement('div');
    foot.className = 'tag-section-foot';
    foot.id = 'rt-foot';
    foot.hidden = true;
    foot.innerHTML = '<button class="btn" id="rt-prev" type="button"></button><button class="btn" id="rt-next" type="button"></button>';
    grid.insertAdjacentElement('afterend', foot);

    el('rt-back').addEventListener('click', function () { W.TagTools.open(RADICALS, 'table'); });
    el('rt-tracing').addEventListener('click', openTracing);
    el('rt-edit-btn').addEventListener('click', function () {
      var p = current();
      if (p) startEditing(p.entry ? p.entry.id : '', p.entry ? '' : p.forms[0]);
    });
    ['rt-prev', 'rt-next'].forEach(function (id) {
      el(id).addEventListener('click', function () { if (el(id).dataset.key) W.TagTools.open(el(id).dataset.key); });
    });
    grid.addEventListener('click', function (e) {
      if (editing && e.target.closest('#rt-editor')) { onEditorClick(e); return; }
      var r = e.target.closest('[data-radical]');
      if (r) W.TagTools.open(r.dataset.radical);
    });
    grid.addEventListener('input', function (e) {
      var t = e.target;
      if (!editing) return;
      if (t.id === 'rt-paste-text') { pasteState.text = t.value; return; }
      var tr = t.closest('tr[data-i]');
      if (tr && t.dataset.f) editing[Number(tr.dataset.i)][t.dataset.f] = t.value;
    });
    // the overview head's own button lives in tag-tools' head
    document.addEventListener('click', function (e) {
      if (e.target.id === 'rt-edit-open') startEditing('');
    });
  }

  function current() { return pageFor(W.learnState && W.learnState.group); }

  function update() {
    var box = el('rt-section'), foot = el('rt-foot');
    if (!box) return;
    var p = current();
    box.hidden = !p;
    foot.hidden = !p || !!W.learnState.query;
    if (!p) return;
    var chars = pageChars(p);
    el('rt-sec-forms').textContent = p.forms.join(' ');
    el('rt-sec-name').textContent = p.name || (p.entry ? '' : '偏旁“' + p.forms[0] + '”');
    el('rt-sec-count').textContent = '字库里 ' + chars.length + ' 个字';
    el('rt-sec-cat').textContent = p.category ? '分类：' + p.category : (p.entry ? '' : '这个偏旁不在老师的偏旁表里');
    el('rt-sec-cat').hidden = !el('rt-sec-cat').textContent;
    var missing = p.examples.filter(function (c) { return !hasCard(c); });
    el('rt-sec-ex').innerHTML = p.examples.length ? '例字：<span class="rt-ex">' + esc(p.examples.join(' ')) + '</span>' +
      (missing.length ? '（字库里还没有：' + esc(missing.join('、')) + '）' : '') : '';
    el('rt-sec-ex').hidden = !p.examples.length;
    var filtered = !!W.learnState.query;
    el('rt-tracing').hidden = filtered;
    el('rt-tracing').disabled = !chars.length;
    el('rt-edit-btn').hidden = filtered || !W.teacherMode;
    el('rt-edit-btn').textContent = p.entry ? '✏️ 修改偏旁表' : '➕ 加进偏旁表';
    var keys = pageKeys(), i = keys.indexOf(p.key);
    var prev = i > 0 ? pageFor(keys[i - 1]) : null, next = i >= 0 && i < keys.length - 1 ? pageFor(keys[i + 1]) : null;
    el('rt-prev').hidden = !prev;
    el('rt-next').hidden = !next;
    el('rt-prev').dataset.key = prev ? prev.key : '';
    el('rt-next').dataset.key = next ? next.key : '';
    el('rt-prev').textContent = prev ? '◀ 上一个：' + shortTitle(prev) : '';
    el('rt-next').textContent = next ? '下一个：' + shortTitle(next) + ' ▶' : '';
  }

  // headings between the structure groups (only when not filtered by a search)
  function addGroupHeads(p) {
    if (W.learnState.query) return;
    var grid = el('char-grid');
    layout(p).forEach(function (part) {
      var first = grid.querySelector('.char-card[data-char="' + part.chars[0] + '"]');
      if (!first) return;
      var h = document.createElement('div');
      h.className = 'rt-group-head';
      h.innerHTML = esc(part.title) + '<small>' + part.chars.length + ' 个字</small>';
      grid.insertBefore(h, first);
    });
  }

  var pageRenderLearnGrid = W.renderLearnGrid;
  W.renderLearnGrid = function () {
    var r = pageRenderLearnGrid.apply(this, arguments);
    var p = current();
    if (p) addGroupHeads(p);
    update();
    return r;
  };
  var pageApplyTeacherUI = W.applyTeacherUI;
  W.applyTeacherUI = function () {
    var r = pageApplyTeacherUI.apply(this, arguments);
    if (!W.teacherMode && editing) { editing = null; if (W.learnState.group === RADICALS) W.renderLearnGrid(); }
    update();
    return r;
  };

  function openTracing() {
    var p = current();
    if (!p) return;
    var chars = pageChars(p);
    if (chars.length) W.TracingUI.open({ chars: chars, heading: titleOf(p) + '的字', note: '', extra: {} });
  }

  build();
  document.addEventListener('DOMContentLoaded', build);

  W.RadicalTable = {
    isPage: function (key) { return !!pageFor(key); },
    hasAny: hasAny,
    count: function () { return table().length; },
    overviewHtml: overviewHtml,
    headButtonsHtml: headButtonsHtml,
    isEditing: function () { return !!editing; },
    parse: parseText,
    current: function () { var p = current(); return p ? { key: p.key, title: titleOf(p), chars: pageChars(p), parts: layout(p) } : null; },
    charsFor: function (forms) { return charsFor(forms); },
    others: function () { return others(); },
    edit: startEditing,
  };
})();
