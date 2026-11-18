'use strict';
/*
 * desktop.js — the desktop patch. Loaded after the page's own script.
 *
 * It owns: the few places where the desktop app must behave differently
 * from the web page — where teacher data is saved, how the web-version file
 * is exported and imported, and hiding what does not work here.
 * It must not: change learning features. Those stay in the page's own
 * script (generated into index.html, never edited by hand).
 *
 * How it works: the page's functions are ordinary global functions, so
 * assigning a new function to the same name replaces them. The page calls
 * them by name, so it picks up the replacement without being edited.
 *
 * Opened in a normal browser (no window.desktopApp), this file does nothing.
 */
(function () {
  var desktop = window.desktopApp;
  if (!desktop) return;

  var SAVED_TEXT = '已保存到这台电脑';

  function overlayText() { return JSON.stringify(window.OVERLAY); }

  /* ---- 1. saving: to the data file instead of the browser's storage ----- */
  window.doSave = async function () {
    var res;
    try {
      res = await desktop.saveOverlay(overlayText());
    } catch (e) {
      res = { ok: false, error: String(e && e.message ? e.message : e) };
    }
    window.setSaveState(res && res.ok ? SAVED_TEXT : '保存失败：' + ((res && res.error) || '未知错误'));
  };

  /* The page asks this when the window is about to close; "yes" blocks the
     close. Here a pending change is written out on the spot (a save that
     finishes before it returns), so closing right after an edit loses
     nothing and nobody has to be asked. */
  var pageHasUnsaved = window.hasUnsavedTeacherWork;
  window.hasUnsavedTeacherWork = function () {
    if (!pageHasUnsaved()) return false;
    var res = null;
    try { res = desktop.saveOverlaySync(overlayText()); } catch (e) { res = null; }
    if (!res || !res.ok) return true;
    if (window.saveTimer) { clearTimeout(window.saveTimer); window.saveTimer = null; }
    window.savePending = false;
    return false;
  };

  /* ---- 2. "下载当前文件": a clean web-version file with today's data ----- */
  window.exportCurrentFile = async function () {
    var d = new Date();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    var stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes());
    var res;
    try {
      res = await desktop.exportWebFile(overlayText(), '汉字乐园_' + stamp + '.html');
    } catch (e) {
      res = { ok: false, error: String(e && e.message ? e.message : e) };
    }
    if (res && res.ok) window.setSaveState('已导出网页版文件');
    else if (res && res.error) alert('导出失败：' + res.error);
  };

  /* ---- 3. "从网页版文件导入数据" ------------------------------------------ */
  async function importFromWebFile() {
    // Anything still waiting to be saved goes to disk first, so the backup
    // made before the import really is the latest state.
    window.hasUnsavedTeacherWork();
    var res;
    try {
      res = await desktop.importWebFile();
    } catch (e) {
      res = { ok: false, error: String(e && e.message ? e.message : e) };
    }
    if (res && res.ok) {
      location.reload();
    } else if (res && res.error) {
      alert('导入失败：' + res.error);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // The page's own start-up has already run (its listener was added first).

    var exportBtn = document.getElementById('btn-export-file');
    if (exportBtn && !document.getElementById('btn-import-file')) {
      var importBtn = document.createElement('button');
      importBtn.className = 'btn tiny';
      importBtn.id = 'btn-import-file';
      importBtn.type = 'button';
      importBtn.textContent = '📥 从网页版文件导入数据';
      importBtn.addEventListener('click', importFromWebFile);
      exportBtn.insertAdjacentElement('afterend', importBtn);
    }

    /* ---- 4. hide the read-aloud test (跟读测试) --------------------------
       It needs the speech recognition service built into the Chrome
       browser, which an Electron window does not have. */
    var voiceBox = document.getElementById('t-voice');
    if (voiceBox) {
      voiceBox.checked = false;
      voiceBox.disabled = true;
      if (window.testConfig && window.testConfig.types) window.testConfig.types.voice = false;
      var row = voiceBox.closest('.type-check');
      if (row) row.style.display = 'none';
    }

    /* ---- 5. wording that only made sense for the web page ---------------- */
    window.setSyncBanner('');       // "本地文件模式…不会分享给学生" does not apply here
    window.setSaveState(SAVED_TEXT);
  });
})();
