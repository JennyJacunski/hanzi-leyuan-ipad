'use strict';
/*
 * tracing-ui.js — the "生成描红练习" button and its window in 学写字.
 *
 * It owns: the button on an opened writing unit, the window where the
 * characters are ticked, the preview, and handing the finished pages to the
 * main program to save as PDF or print. It also collects what each
 * character's sheet needs from the app's own data: pinyin and words from the
 * character's card, stroke outlines from the stroke data, radical and
 * structure from char-info.js.
 * It must not: draw. All drawing is in tracing-sheet.js.
 *
 * Available to students and teachers alike. A character with more than one
 * reading (多音字) appears once, with its first reading.
 *
 * Opened in a normal browser (no window.desktopApp), this file does nothing.
 */
(function () {
  var desktop = window.desktopApp;
  var Sheet = window.TracingSheet;
  if (!desktop || !Sheet) return;

  var MAX_WORDS = 3;          // word examples printed after 组词
  var currentUnitIdx = null;  // the writing unit that is open
  var chars = [];             // the unit's characters, each once
  var chosen = {};            // char -> true when ticked
  var refreshTimer = null;

  /* Remember which unit is open: the page's own function is called by name,
     so replacing it lets us note the unit and then run the original. */
  var pageOpenWriteUnit = window.openWriteUnit;
  window.openWriteUnit = function (idx) {
    currentUnitIdx = idx;
    return pageOpenWriteUnit(idx);
  };

  function uniqueChars(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (ch) { if (!seen[ch]) { seen[ch] = true; out.push(ch); } });
    return out;
  }

  /* Everything the sheet shows for one character, from the app's data. */
  function entryFor(ch) {
    var cards = window.getCardsForChar(ch);
    var card = cards.length ? cards[0] : null; // 多音字: the first reading
    var strokeData = window.getStrokeData(ch);
    var info = (window.CHAR_INFO || {})[ch];
    return {
      char: ch,
      pinyin: card ? card.pinyin : '',
      words: card ? (card.words || []).slice(0, MAX_WORDS).map(function (w) { return w[0]; }) : [],
      strokes: strokeData && strokeData.strokes ? strokeData.strokes : [],
      radical: info ? info[0] : '',
      structure: info ? (window.CHAR_INFO_STRUCTURES || [])[info[1]] || '' : '',
    };
  }
  function entriesFor(list) { return uniqueChars(list).map(entryFor); }

  function chosenChars() { return chars.filter(function (ch) { return chosen[ch]; }); }

  /* ---- the window --------------------------------------------------------- */
  var overlay = null;
  function el(id) { return document.getElementById(id); }

  function build() {
    var style = document.createElement('style');
    // `.modal.tracing-modal`: two class names, so these rules win over the page's own `.modal`.
    style.textContent =
      // the pinyin font of the practice pages (tracing-sheet.js); the print window has its own copy
      '@font-face{font-family:"Didact Gothic";src:url("fonts/DidactGothic-Regular.ttf") format("truetype");}' +
      '.modal.tracing-modal{max-width:880px;max-height:94vh;display:flex;flex-direction:column;overflow:hidden;}' +
      '.modal.tracing-modal > *{flex:none;}' +
      '.tracing-modal h3 small{font-size:13px;color:var(--ink-soft);font-weight:700;font-family:var(--font-ui);margin-left:8px;}' +
      '.tracing-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;}' +
      '#tracing-chars{max-height:128px;overflow:auto;padding:2px;}' +
      '#tracing-chars .chip{cursor:pointer;padding:5px 12px;font-size:17px;}' +
      '#tracing-status{display:block;min-height:18px;margin-top:8px;white-space:pre-line;word-break:break-all;}' +
      '.tracing-modal .modal-actions{margin-top:8px;}' +
      '.modal.tracing-modal > .tracing-preview{flex:1 1 auto;min-height:160px;overflow:auto;margin-top:12px;padding:14px;border-radius:12px;background:#dfe7f1;}' +
      '.tracing-preview svg{display:block;width:100%;max-width:640px;height:auto;margin:0 auto 14px;box-shadow:0 2px 10px rgba(30,42,68,.25);}' +
      '.tracing-preview svg:last-child{margin-bottom:0;}';
    document.head.appendChild(style);

    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'tracing-overlay';
    overlay.innerHTML =
      '<div class="modal tracing-modal">' +
        '<button class="modal-close" id="tracing-close" type="button">✕</button>' +
        '<h3>📝 描红练习<small id="tracing-unit-name"></small></h3>' +
        '<p class="t-hint">点一下字可以选上或取消。每页 3 个字；多音字只出一次。生成后可以保存成 PDF 或直接打印。</p>' +
        '<div class="tracing-tools">' +
          '<button class="btn tiny" id="tracing-all" type="button">全选</button>' +
          '<button class="btn tiny" id="tracing-none" type="button">全不选</button>' +
          '<span class="count-pill" id="tracing-count"></span>' +
        '</div>' +
        '<div class="chip-row" id="tracing-chars"></div>' +
        '<span class="t-status" id="tracing-status"></span>' +
        '<div class="modal-actions">' +
          '<button class="btn primary" id="tracing-save" type="button">💾 保存 PDF</button>' +
          '<button class="btn" id="tracing-print" type="button">🖨 打印</button>' +
        '</div>' +
        '<div class="tracing-preview" id="tracing-preview"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    el('tracing-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    el('tracing-all').addEventListener('click', function () { setAll(true); });
    el('tracing-none').addEventListener('click', function () { setAll(false); });
    el('tracing-chars').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var ch = chip.dataset.char;
      chosen[ch] = !chosen[ch];
      chip.classList.toggle('selected', !!chosen[ch]);
      scheduleRefresh();
    });
    el('tracing-save').addEventListener('click', savePdf);
    el('tracing-print').addEventListener('click', printPages);
  }

  function setAll(on) {
    chars.forEach(function (ch) { chosen[ch] = on; });
    renderChips();
    refresh();
  }
  function renderChips() {
    el('tracing-chars').innerHTML = chars.map(function (ch) {
      return '<span class="chip' + (chosen[ch] ? ' selected' : '') + '" data-char="' + window.escAttr(ch) + '">' + window.escAttr(ch) + '</span>';
    }).join('');
  }
  function setStatus(text, isError) {
    var s = el('tracing-status');
    s.textContent = text || '';
    s.className = 't-status' + (isError ? ' err' : '');
  }
  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 120);
  }

  var lastResult = null; // the pages of the preview on screen
  function refresh() {
    refreshTimer = null;
    var picked = chosenChars();
    var fill = Sheet.pageFill(picked.length);
    el('tracing-count').textContent = picked.length
      ? '已选 ' + picked.length + ' 个字，共 ' + fill[0] + ' 页' + (fill[1] ? '（再选 ' + fill[1] + ' 个字正好排满）' : '')
      : '还没有选字';
    el('tracing-save').disabled = !picked.length;
    el('tracing-print').disabled = !picked.length;
    if (!picked.length) {
      lastResult = null;
      el('tracing-preview').innerHTML = '';
      setStatus('');
      return;
    }
    // The unit's name, e.g. "二年级 第二单元 第一周", heads every page with the page number.
    var unit = (window.OVERLAY.writingUnits || [])[currentUnitIdx] || {};
    lastResult = Sheet.buildPages(picked.map(entryFor), { heading: unitLabel(unit, currentUnitIdx) });
    el('tracing-preview').innerHTML = lastResult.pages.join('');
    setStatus(lastResult.notes.join('\n'), lastResult.notes.length > 0);
  }

  function unitLabel(unit, idx) {
    var parts = window.writeUnitIndexParts(unit, idx);
    return ((parts && parts.label ? parts.label + ' ' : '') + (unit.title || '')).trim();
  }

  function open(idx) {
    var units = window.OVERLAY.writingUnits || [];
    var unit = units[idx];
    if (!unit) return;
    if (!overlay) build();
    currentUnitIdx = idx;
    chars = uniqueChars(unit.chars);
    chosen = {};
    chars.forEach(function (ch) { chosen[ch] = true; });
    el('tracing-unit-name').textContent = unitLabel(unit, idx);
    renderChips();
    refresh();
    overlay.classList.add('active');
    // The pinyin font loads the first time; draw again once it can be measured.
    Sheet.ready().then(function () { if (overlay.classList.contains('active')) refresh(); });
    // A character the teacher added may not have stroke outlines yet. The
    // page already knows how to fetch them (once, from the internet); when
    // they arrive, draw the preview again.
    chars.forEach(function (ch) {
      if (window.getStrokeData(ch)) return;
      window.ensureStrokeData(ch, function (data, state) {
        if (state === 'ok' && overlay.classList.contains('active')) refresh();
      });
    });
  }
  function close() { if (overlay) overlay.classList.remove('active'); }

  function pagesHtml() {
    return lastResult.pages.map(function (svg) { return '<div class="pg">' + svg + '</div>'; }).join('');
  }
  function fileName() {
    var unit = (window.OVERLAY.writingUnits || [])[currentUnitIdx] || {};
    var label = unitLabel(unit, currentUnitIdx).replace(/[\\/:*?"<>|\s]+/g, '_');
    return '描红练习' + (label ? '_' + label : '') + '.pdf';
  }
  async function savePdf() {
    if (!lastResult) return;
    setStatus('正在生成 PDF…');
    var res;
    try { res = await desktop.saveTracingPdf(pagesHtml(), fileName()); }
    catch (e) { res = { ok: false, error: String(e && e.message ? e.message : e) }; }
    if (res && res.ok) setStatus('已保存：' + res.path);
    else if (res && res.error) setStatus('保存失败：' + res.error, true);
    else setStatus(lastResult.notes.join('\n'), lastResult.notes.length > 0);
  }
  async function printPages() {
    if (!lastResult) return;
    setStatus('正在准备打印…');
    var res;
    try { res = await desktop.printTracing(pagesHtml()); }
    catch (e) { res = { ok: false, error: String(e && e.message ? e.message : e) }; }
    if (res && res.ok) setStatus('已发送到打印机。');
    else if (res && res.error) setStatus('打印失败：' + res.error, true);
    else setStatus(lastResult.notes.join('\n'), lastResult.notes.length > 0);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var back = el('btn-write-back');
    if (!back || el('btn-tracing')) return;
    var btn = document.createElement('button');
    btn.className = 'btn tiny';
    btn.id = 'btn-tracing';
    btn.type = 'button';
    btn.textContent = '📝 生成描红练习';
    btn.style.marginLeft = '8px';
    btn.addEventListener('click', function () { if (currentUnitIdx !== null) open(currentUnitIdx); });
    back.insertAdjacentElement('afterend', btn);
  });

  // For the automatic check and for trying things out in the console.
  window.TracingUI = { open: open, close: close, entriesFor: entriesFor };
})();
