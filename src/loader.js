'use strict';
/*
 * loader.js — starts the app on the iPad.
 *
 * It owns: reading the teacher data from the iPad's storage, putting it into
 * the app page (app.html) and showing that page; registering the offline
 * cache (sw.js).
 * It must not: change anything inside the app page apart from filling in
 * the empty teacher-data tag.
 *
 * Why this step exists: the app's own script reads the teacher data from the
 * tag <script id="overlay-data"> while the page is loading, at once. The
 * iPad's storage can only be read with a short wait. So this small page
 * waits for the data first, writes it into the app page's text, and then
 * replaces itself with that page (document.write). From then on the app
 * starts exactly as it does on the Mac, with its data already there.
 */
(function () {
  var EMPTY_TAG = '<script id="overlay-data" type="application/json">{}</script>';
  var OPEN = '<script id="overlay-data" type="application/json">';

  function show(text) {
    var el = document.getElementById('msg');
    if (el) el.textContent = text;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('offline cache not registered', e); });
  }
  // Ask the iPad to keep this app's data even when space runs low.
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* not available */ }

  function usable(text) {
    if (!text) return false;
    try { var o = JSON.parse(text); return !!o && typeof o === 'object' && !Array.isArray(o); } catch (e) { return false; }
  }

  async function start() {
    var text = null, note = '';
    try {
      text = await window.HanziStore.load();
      if (text && !usable(text)) {
        var b = await window.HanziStore.newestGoodBackup();
        note = b ? '老师数据读取失败，已用备份（' + b.key.replace(/^backup:\w+:/, '') + '）恢复。'
                 : '老师数据读取失败，也没有可用的备份。';
        text = b ? b.text : null;
        if (b) await window.HanziStore.save(b.text);
      }
    } catch (e) {
      note = '读取 iPad 上的数据失败：' + (e && e.message ? e.message : e);
      text = null;
    }

    var resp = await fetch('app.html');
    if (!resp.ok) throw new Error('app.html ' + resp.status);
    var html = await resp.text();
    if (html.split(EMPTY_TAG).length !== 2) throw new Error('app.html 里找不到空的老师数据标签');
    if (usable(text)) {
      // Same escape as the page's own export: a "</script>" in a lesson can never end the tag early.
      var safe = text.replace(/</g, '\\u003c');
      html = html.replace(EMPTY_TAG, function () { return OPEN + safe + '</script>'; });
    }
    if (note) {
      // ipad-ui.js shows this once the app is up.
      html = html.replace('</head>', function () {
        return '<script>window.IPAD_START_NOTE=' + JSON.stringify(note).replace(/</g, '\\u003c') + ';</script></head>';
      });
    }
    document.open();
    document.write(html);
    document.close();
  }

  start().catch(function (e) {
    console.error(e);
    show('打不开汉字乐园：' + (e && e.message ? e.message : e) + '。请连上网络后再试一次。');
  });
})();
