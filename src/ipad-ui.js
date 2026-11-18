'use strict';
/*
 * ipad-ui.js — what is different on the iPad, on top of the desktop patches.
 *
 * It owns:
 *   1. the 导出 / 导入 / 修改密码 buttons: on the Mac they are in the menu
 *      bar (desktop-ui.js hides the buttons); the iPad has no menu bar, so
 *      they are shown again in the teacher tools, with iPad wording
 *   2. the first start: with no teacher data yet, a card at the top explains
 *      how to bring the data over from the Mac and has the import button
 *   3. saving when the app is left: an iPad app is usually closed by
 *      swiping it away, without warning, so a change still waiting to be
 *      saved is saved as soon as the app goes to the background
 *   4. "已保存到这台 iPad" instead of "已保存到这台电脑"
 *   5. recordings made on the Mac (webm format): if Safari cannot play
 *      them directly, they are decoded and played another way
 *   6. touch: no double-tap zoom on buttons, room for the iPad's rounded corners
 *   7. 描红练习: one button "打印或存成 PDF" (the iPad's print window does both)
 *   8. a message from the start-up (loader.js), e.g. data restored from a backup
 * It must not: change what any feature does.
 */
(function () {
  if (!window.desktopApp || !window.desktopApp.isIpad) return;

  function el(id) { return document.getElementById(id); }

  /* ---- styles for 1, 2, 6, 7 -------------------------------------------- */
  var style = document.createElement('style');
  style.textContent =
    // 1. stronger than desktop-ui.js's "display:none !important"
    '#teacher-panel #btn-export-file,#teacher-panel #btn-import-file,#teacher-panel #btn-toggle-pin-settings{display:inline-flex !important;}' +
    // 2.
    '.ipad-welcome{margin:12px 0;padding:16px 18px;border-radius:14px;background:#fff;border:2px solid #f0c987;line-height:1.7;font-size:16px;}' +
    '.ipad-welcome h3{margin:0 0 6px;font-size:19px;}' +
    '.ipad-welcome ol{margin:6px 0 12px;padding-left:1.4em;}' +
    // 6.
    'button,.btn,.chip,.char-card,a{touch-action:manipulation;-webkit-tap-highlight-color:rgba(0,0,0,0.06);}' +
    'body{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);}' +
    // 7.
    '#tracing-save{display:none !important;}';
  document.head.appendChild(style);

  /* ---- 4. ----------------------------------------------------------------- */
  var pageSetSaveState = window.setSaveState;
  window.setSaveState = function (text) {
    return pageSetSaveState(String(text).replace('已保存到这台电脑', '已保存到这台 iPad'));
  };

  /* ---- 3. ----------------------------------------------------------------- */
  function saveNowIfWaiting() {
    if (window.saveTimer) {
      clearTimeout(window.saveTimer);
      window.saveTimer = null;
      window.triggerSave();
    }
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveNowIfWaiting(); });
  window.addEventListener('pagehide', saveNowIfWaiting);

  /* ---- 5. recordings in webm format -----------------------------------------
     The Mac's recordings are webm (Opus). Newer Safari plays them; if this
     one does not, the recording is decoded with Web Audio (which can read it
     in more Safari versions) and played from there, or, for the lesson
     player, turned into a WAV file the player can use. */
  var WEBM = /^data:audio\/webm/i;
  var probe = document.createElement('audio');
  var webmNative = !!(probe.canPlayType && probe.canPlayType('audio/webm; codecs="opus"'));
  var audioCtx = null;
  function ctx() {
    if (!audioCtx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      audioCtx = new C();
    }
    return audioCtx;
  }
  // Called during a tap: Safari only lets Web Audio make sound after one.
  function wakeAudio() { var c = ctx(); if (c && c.state === 'suspended') c.resume().catch(function () {}); }

  var decoded = {}; // first 200 characters + length of the data URL -> AudioBuffer
  function keyOf(url) { return url.length + ':' + url.slice(0, 200) + url.slice(-60); }
  function decode(url) {
    var k = keyOf(url);
    if (decoded[k]) return Promise.resolve(decoded[k]);
    return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      return new Promise(function (resolve, reject) { ctx().decodeAudioData(buf, resolve, reject); });
    }).then(function (b) { decoded[k] = b; return b; });
  }

  var currentSource = null;
  function playBuffer(buffer) {
    var c = ctx();
    if (currentSource) { try { currentSource.stop(); } catch (e) { /* already ended */ } }
    var src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    src.start();
    currentSource = src;
  }

  function wavUrl(buffer) {
    var n = buffer.length, rate = buffer.sampleRate, ch = buffer.numberOfChannels;
    var data = new DataView(new ArrayBuffer(44 + n * 2));
    function str(o, s) { for (var i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); data.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true);
    data.setUint32(24, rate, true); data.setUint32(28, rate * 2, true); data.setUint16(32, 2, true);
    data.setUint16(34, 16, true); str(36, 'data'); data.setUint32(40, n * 2, true);
    var chans = [];
    for (var c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
    for (var i = 0; i < n; i++) {
      var v = 0;
      for (var j = 0; j < ch; j++) v += chans[j][i];
      v = Math.max(-1, Math.min(1, v / ch));
      data.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    }
    return URL.createObjectURL(new Blob([data], { type: 'audio/wav' }));
  }

  // The card's 🔊 button and the quiz: the page's own playCustomAudio().
  var pagePlayCustomAudio = window.playCustomAudio;
  window.playCustomAudio = function (dataUrl) {
    if (!WEBM.test(dataUrl || '') || !ctx()) return pagePlayCustomAudio(dataUrl);
    wakeAudio();
    function viaWebAudio() {
      decode(dataUrl).then(playBuffer).catch(function (e) { console.warn('recording could not be played', e); });
    }
    if (!webmNative) { viaWebAudio(); return; }
    pagePlayCustomAudio(dataUrl);
    var a = window.currentCustomAudio;
    if (a && a.addEventListener) a.addEventListener('error', viaWebAudio, { once: true });
  };

  // The lesson player (<audio controls>): on an error, swap in a WAV version.
  document.addEventListener('error', function (e) {
    var a = e.target;
    if (!a || a.tagName !== 'AUDIO' || a.dataset.ipadConverted || !WEBM.test(a.currentSrc || a.src || '') || !ctx()) return;
    a.dataset.ipadConverted = '1';
    decode(a.src).then(function (buffer) {
      a.src = wavUrl(buffer);
      a.load();
    }).catch(function (err) { console.warn('lesson recording could not be played', err); });
  }, true);

  /* ---- 2. first start ------------------------------------------------------ */
  function hasTeacherData() {
    var o = window.OVERLAY || {};
    return !!((o.lessons || []).length || (o.writingUnits || []).length || Object.keys(o.customAudio || {}).length ||
      (o.storyLinks || []).length || Object.keys(o.charEdits || {}).length);
  }
  function showWelcome() {
    var card = document.createElement('div');
    card.className = 'ipad-welcome';
    card.id = 'ipad-welcome';
    card.innerHTML =
      '<h3>👋 欢迎使用汉字乐园 iPad 版</h3>' +
      '<div>生字、拼音和笔顺已经都在了。老师录的课文、写字单元和录音要从 Mac 上的汉字乐园拿过来：</div>' +
      '<ol>' +
        '<li>在 Mac 上打开汉字乐园，进入教师模式，选菜单 <b>文件 → 导出网页版文件</b>。</li>' +
        '<li>用<b>隔空投送</b>把这个文件发到这台 iPad（它会存到“文件”App 的“下载”里）。</li>' +
        '<li>回到这里，点下面的按钮，选这个文件。</li>' +
      '</ol>' +
      '<button class="btn primary" id="ipad-welcome-import" type="button">📥 导入老师数据</button>';
    var banner = el('sync-banner');
    if (banner) banner.insertAdjacentElement('afterend', card);
    else document.body.insertBefore(card, document.body.firstChild);
    el('ipad-welcome-import').addEventListener('click', function () {
      var btn = el('btn-import-file');
      if (btn) btn.click(); // desktop.js's import: picks the file, confirms, reloads
    });
  }

  /* ---- 7. the tracing window is built on first use; relabel its print button then */
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('#btn-tracing')) return;
    var p = el('tracing-print');
    if (p) p.textContent = '🖨 打印或存成 PDF';
  });

  document.addEventListener('DOMContentLoaded', function () {
    // The page's own start-up and the desktop patches have already run.
    var exp = el('btn-export-file');
    if (exp) exp.textContent = '📤 导出数据文件';
    var imp = el('btn-import-file');
    if (imp) imp.textContent = '📥 导入数据文件';
    if (!hasTeacherData()) showWelcome();
    // 8.
    if (window.IPAD_START_NOTE) window.setSyncBanner(window.IPAD_START_NOTE, true);
  });
})();
