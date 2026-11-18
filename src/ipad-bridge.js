'use strict';
/*
 * ipad-bridge.js — the iPad's version of `window.desktopApp`.
 *
 * On the Mac, the desktop app gives the page `window.desktopApp` (see
 * desktop_version/preload.js): save the teacher data, export and import the
 * web-version file, save or print the tracing pages. The desktop patches
 * (desktop.js, desktop-ui.js, tracing-ui.js) only ever call those functions.
 * This file gives them the same functions on the iPad, so those three files
 * are used here unchanged, copied from desktop_version/app by tools/build.js.
 *
 * It owns: how each of those jobs is done in Safari on the iPad.
 *   save       -> the iPad's storage (store.js)
 *   export     -> the iPad's share sheet (AirDrop to the Mac, Save to Files, …),
 *                 or a normal download where sharing a file is not possible
 *   import     -> pick a file, confirm, back up, replace
 *   tracing    -> the iPad's print window, which can also save a PDF
 * It must not: change what any feature does.
 *
 * Loaded before desktop.js (see tools/build.js).
 */
(function () {
  var Store = window.HanziStore;
  var OVERLAY_TAG = /<script id="overlay-data" type="application\/json">([\s\S]*?)<\/script>/;
  var OVERLAY_OPEN = '<script id="overlay-data" type="application/json">';

  function errText(e) { return String(e && e.message ? e.message : e); }

  /* ---- export: web template + teacher data -> a web-version file -------------
     The template is fetched once, early, so that pressing the button can open
     the share sheet at once (Safari only allows that straight after a tap). */
  var templateText = null;
  function loadTemplate() {
    if (templateText) return Promise.resolve(templateText);
    return fetch('web-template.html').then(function (r) {
      if (!r.ok) throw new Error('web-template.html ' + r.status);
      return r.text();
    }).then(function (t) { templateText = t; return t; });
  }
  window.addEventListener('load', function () { setTimeout(function () { loadTemplate().catch(function () {}); }, 1500); });

  function buildWebHtml(template, overlayText) {
    JSON.parse(overlayText);
    if (!OVERLAY_TAG.test(template)) throw new Error('网页模板里找不到老师数据标签。');
    var safe = overlayText.replace(/</g, '\\u003c');
    return template.replace(OVERLAY_TAG, function () { return OVERLAY_OPEN + safe + '</script>'; });
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function shareOrDownload(html, filename) {
    var blob = new Blob([html], { type: 'text/html' });
    var file = null;
    try { file = new File([blob], filename, { type: 'text/html' }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: filename }).then(
        function () { return { ok: true }; },
        function (e) {
          if (e && e.name === 'AbortError') return { ok: false, canceled: true };
          download(blob, filename);
          return { ok: true };
        });
    }
    download(blob, filename);
    return Promise.resolve({ ok: true });
  }

  function exportWebFile(overlayText, filename) {
    try {
      if (templateText) return shareOrDownload(buildWebHtml(templateText, overlayText), filename);
      // Not fetched yet (only right after opening): fetch now; the share sheet may then need a second tap.
      return loadTemplate().then(function (t) { return shareOrDownload(buildWebHtml(t, overlayText), filename); })
        .catch(function (e) { return { ok: false, error: errText(e) }; });
    } catch (e) {
      return Promise.resolve({ ok: false, error: errText(e) });
    }
  }

  /* ---- import ------------------------------------------------------------- */
  function summarize(o) {
    return (o.lessons || []).length + ' 篇课文，' + Object.keys(o.customAudio || {}).length + ' 段录音，' +
      (o.writingUnits || []).length + ' 个写字单元，' + (o.storyLinks || []).length + ' 个成语故事链接';
  }

  function extractOverlay(html) {
    var m = html.match(OVERLAY_TAG);
    if (!m) throw new Error('这个文件里找不到老师数据，它可能不是“汉字乐园”的网页版文件。');
    var text = m[1].trim();
    var o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('文件里的老师数据坏了：' + e.message); }
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('文件里的老师数据格式不对。');
    if (!Object.keys(o).length) throw new Error('这个文件里的老师数据是空的。');
    return { text: text, overlay: o };
  }

  function pickFile() {
    return new Promise(function (resolve) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.html,.htm,text/html';
      input.style.display = 'none';
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        input.remove();
        resolve(f || null);
      });
      // Closing the file picker without choosing fires "cancel" (newer Safari) or nothing at all.
      input.addEventListener('cancel', function () { input.remove(); resolve(null); });
      document.body.appendChild(input);
      input.click();
    });
  }

  function confirmReplace(fileName, summary) {
    return new Promise(function (resolve) {
      window.openConfirmModal(
        '用这个文件里的数据替换当前数据？',
        '文件：' + fileName + '\n里面有：' + summary + '。\n\n这台 iPad 上现在的老师数据会被整体替换（不是合并）。替换前会自动留一份备份。',
        '替换当前数据',
        function (ok) { resolve(!!ok); });
    });
  }

  /* Must be called straight from a tap: it opens the file picker at once. */
  function importWebFile() {
    var picking = pickFile();
    return picking.then(function (file) {
      if (!file) return { ok: false, canceled: true };
      return file.text().then(function (html) {
        var found = extractOverlay(html);
        return confirmReplace(file.name, summarize(found.overlay)).then(function (yes) {
          if (!yes) return { ok: false, canceled: true };
          return Store.replaceFromImport(found.text).then(function () { return { ok: true }; });
        });
      });
    }).catch(function (e) { return { ok: false, error: errText(e) }; });
  }

  /* ---- tracing pages: the iPad's print window --------------------------------
     The pages are put into a container at the end of the page; while it is
     printed, everything else is hidden and the paper is 185 × 260 mm (16开).
     In the print window the teacher can print (AirPrint) or save a PDF:
     the share button at the top, then "存储到文件". */
  var PRINT_CSS =
    '@page{size:185mm 260mm;margin:0;}' +
    '@media print{' +
      'html.ipad-printing body > :not(#ipad-print-area){display:none !important;}' +
      'html.ipad-printing #ipad-print-area, html.ipad-printing #ipad-print-area *{visibility:visible !important;}' +
      'html.ipad-printing, html.ipad-printing body{margin:0 !important;padding:0 !important;background:#fff !important;}' +
      'html.ipad-printing #ipad-print-area{display:block !important;}' +
      '#ipad-print-area .pg{width:185mm;height:259mm;display:flex;align-items:center;justify-content:center;overflow:hidden;break-after:page;page-break-after:always;}' +
      '#ipad-print-area .pg:last-child{break-after:auto;page-break-after:auto;}' +
      '#ipad-print-area .pg svg{flex:none;width:auto;height:259mm;}' +
    '}';
  var printStyle = null;

  function endPrinting() {
    document.documentElement.classList.remove('ipad-printing');
    // The paper size applies to the whole page; take it away again so the
    // page's own "🖨 打印本页生字" keeps its normal paper.
    if (printStyle) { printStyle.remove(); printStyle = null; }
    var area = document.getElementById('ipad-print-area');
    if (area) area.innerHTML = '';
  }
  window.addEventListener('afterprint', endPrinting);
  // If Safari sends no "afterprint", the next tap on the page ends it.
  document.addEventListener('pointerdown', function () {
    if (document.documentElement.classList.contains('ipad-printing')) endPrinting();
  }, true);

  function printPages(pagesHtml) {
    var area = document.getElementById('ipad-print-area');
    if (!area) {
      area = document.createElement('div');
      area.id = 'ipad-print-area';
      area.style.display = 'none';
      document.body.appendChild(area);
    }
    // The pages draw each character and pinyin once and reuse it by id (<use href="#…">).
    // The preview on screen holds the same ids, and an id points to the first one in the
    // page — the hidden preview — so the printed copy gets ids of its own.
    area.innerHTML = String(pagesHtml)
      .replace(/ id="([^"]+)"/g, ' id="print-$1"')
      .replace(/ href="#([^"]+)"/g, ' href="#print-$1"');
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.textContent = PRINT_CSS;
      document.head.appendChild(printStyle);
    }
    document.documentElement.classList.add('ipad-printing');
    function go() {
      window.print();
      // There is no way to know whether it was printed or saved; the window says it itself.
      return { ok: false, canceled: true };
    }
    // The pinyin font is normally loaded already (tracing-ui waits for it).
    var font = '10px "Didact Gothic"';
    if (document.fonts && !document.fonts.check(font)) {
      return document.fonts.load(font).then(function () { return document.fonts.ready; }).then(go);
    }
    return Promise.resolve(go());
  }

  /* ---- the bridge --------------------------------------------------------- */
  window.desktopApp = {
    isIpad: true,
    // The loader has already put the data into the page; nothing to read here.
    loadOverlayText: function () { return ''; },
    saveOverlay: function (text) {
      return Store.save(text).then(function () { return { ok: true }; }, function (e) { return { ok: false, error: errText(e) }; });
    },
    // The iPad's storage cannot finish a save before returning. The save is
    // started anyway; the answer "not saved yet" is the truthful one.
    saveOverlaySync: function (text) {
      Store.save(text).catch(function (e) { console.error('save failed', e); });
      return { ok: false, error: '正在保存' };
    },
    exportWebFile: exportWebFile,
    importWebFile: importWebFile,
    saveTracingPdf: function (pagesHtml) { return printPages(pagesHtml); },
    printTracing: function (pagesHtml) { return printPages(pagesHtml); },
  };
})();
