#!/usr/bin/env node
'use strict';
/*
 * check.js — automatic check of the iPad app in WebKit (the engine of
 * Safari on the iPad), with an iPad's screen size and touch.
 *
 * It owns: serving docs/ on this Mac, opening it like an iPad, and checking
 * the iPad-specific parts: first start, import, saving, export, offline,
 * 描红 printing, recordings, touch. Screenshots go to dev-data/check/.
 * It must not: check the learning features themselves; the desktop app's
 * smoke test does that, and those parts are the same code.
 *
 * The test data file is made from the desktop app's teacher data and stays
 * in dev-data/ (not published, not in git).
 *
 * Usage:  npm run check     (after npm run build)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { webkit, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const DESKTOP_APP = path.join(ROOT, '..', 'desktop_version', 'app');
const OUT = path.join(ROOT, 'dev-data', 'check');
fs.mkdirSync(OUT, { recursive: true });

/* ---- the test data file: what the Mac's 导出网页版文件 makes ---------------- */
const seed = fs.readFileSync(path.join(DESKTOP_APP, 'seed-overlay.json'), 'utf8');
const seedObj = JSON.parse(seed);
const EXPECT = {
  lessons: seedObj.lessons.length,
  audio: Object.keys(seedObj.customAudio).length,
  units: seedObj.writingUnits.length,
};
const TEST_FILE = path.join(ROOT, 'dev-data', '汉字乐园_测试数据.html');
fs.writeFileSync(TEST_FILE, fs.readFileSync(path.join(DESKTOP_APP, 'web-template.html'), 'utf8')
  .replace('<script id="overlay-data" type="application/json">{}</script>',
    function () { return '<script id="overlay-data" type="application/json">' + seed.replace(/</g, '\\u003c') + '</script>'; }));

/* ---- a small web server for docs/ ----------------------------------------------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png',
  '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(function (req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DOCS, p);
  if (!file.startsWith(DOCS) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

/* ---- reporting ------------------------------------------------------------------ */
let failed = 0, passed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined ? '  →  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
}
function info(name, detail) { console.log('INFO  ' + name + '  →  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))); }

async function waitForApp(page) {
  await page.waitForFunction(function () { return window.desktopApp && window.desktopApp.isIpad && document.readyState === 'complete' && window.OVERLAY; }, null, { timeout: 30000 });
}
function summary(page) {
  return page.evaluate(function () {
    var o = window.OVERLAY;
    return { lessons: o.lessons.length, audio: Object.keys(o.customAudio).length, units: o.writingUnits.length,
      welcome: !!document.getElementById('ipad-welcome'), save: document.getElementById('teacher-save-state').textContent };
  });
}

async function run() {
  await new Promise(function (r) { server.listen(0, '127.0.0.1', r); });
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await webkit.launch();
  const context = await browser.newContext(Object.assign({}, devices['iPad Pro 11 landscape'], { acceptDownloads: true }));
  const errors = [];
  function watch(page) {
    page.on('pageerror', function (e) { errors.push(e.message); });
    page.on('console', function (m) { if (m.type() === 'error') errors.push(m.text()); });
  }
  let page = await context.newPage();
  watch(page);

  /* 1. first start */
  await page.goto(base);
  await waitForApp(page);
  let s = await summary(page);
  check('第一次打开：没有老师数据，显示欢迎卡片', s.welcome && s.lessons === 0, s);
  check('保存状态写的是 iPad', s.save === '已保存到这台 iPad', s.save);
  const engine = await page.evaluate(function () { return navigator.userAgent; });
  info('浏览器', engine);
  await page.screenshot({ path: path.join(OUT, '1-first-start.png') });

  /* 2. import from the welcome card */
  const chooserP = page.waitForEvent('filechooser');
  await page.tap('#ipad-welcome-import');
  const chooser = await chooserP;
  await chooser.setFiles(TEST_FILE);
  await page.waitForSelector('#confirm-modal-overlay.active');
  const msg = await page.textContent('#confirm-modal-msg');
  check('导入前确认：说明文件里有什么', msg.indexOf(EXPECT.lessons + ' 篇课文') >= 0 && msg.indexOf(EXPECT.audio + ' 段录音') >= 0, msg.split('\n')[1]);
  await Promise.all([page.waitForEvent('load'), page.tap('#confirm-modal-ok')]);
  await waitForApp(page);
  s = await summary(page);
  check('导入后数据都在，欢迎卡片不见了', s.lessons === EXPECT.lessons && s.audio === EXPECT.audio && s.units === EXPECT.units && !s.welcome, s);

  /* 3. still there after closing and opening again */
  await page.close();
  page = await context.newPage();
  watch(page);
  await page.goto(base);
  await waitForApp(page);
  s = await summary(page);
  check('重新打开后数据还在', s.lessons === EXPECT.lessons && s.audio === EXPECT.audio, s);

  /* 4. a teacher's change is saved */
  await page.evaluate(function () { window.OVERLAY.quizPrompts.__ipad_check = 'ok'; window.queueSave(); });
  await page.waitForFunction(function () { return document.getElementById('teacher-save-state').textContent === '已保存到这台 iPad'; }, null, { timeout: 10000 });
  await page.reload();
  await waitForApp(page);
  const kept = await page.evaluate(function () { return window.OVERLAY.quizPrompts.__ipad_check; });
  check('老师的修改保存了，重新打开还在', kept === 'ok', kept);
  await page.evaluate(function () { delete window.OVERLAY.quizPrompts.__ipad_check; window.queueSave(); });
  await page.waitForTimeout(1500);

  /* 5. export: the iPad's share sheet (AirDrop, 存储到文件), or a download where there is none */
  const exportBtnVisible = await page.evaluate(function () {
    return ['btn-export-file', 'btn-import-file', 'btn-toggle-pin-settings'].map(function (id) {
      var b = document.getElementById(id); return b ? b.textContent + ':' + getComputedStyle(b).display : id + ':missing';
    });
  });
  check('教师工具里有 导出 / 导入 / 修改密码 按钮', exportBtnVisible.every(function (t) { return !/none|missing/.test(t); }), exportBtnVisible);
  function exportedOk(html) {
    const m = html.match(/<script id="overlay-data" type="application\/json">([\s\S]*?)<\/script>/);
    const o = m ? JSON.parse(m[1]) : {};
    return !!m && (o.lessons || []).length === EXPECT.lessons && Object.keys(o.customAudio || {}).length === EXPECT.audio;
  }
  await page.waitForFunction(function () { return true; }, null, { timeout: 3000 }); // template fetched after load
  const shared = await page.evaluate(async function () {
    var got = null;
    navigator.share = function (d) { got = d; return Promise.resolve(); };
    navigator.canShare = function () { return true; };
    document.getElementById('btn-export-file').click();
    for (var i = 0; i < 50 && !got; i++) await new Promise(function (r) { setTimeout(r, 100); });
    return got ? { name: got.files[0].name, text: await got.files[0].text() } : null;
  });
  check('导出：打开 iPad 的分享窗口，文件是网页版格式，数据完整', !!shared && exportedOk(shared.text),
    shared ? shared.name + '，' + (shared.text.length / 1024 / 1024).toFixed(1) + ' MB' : '没有打开分享');
  const dlP = page.waitForEvent('download', { timeout: 15000 });
  await page.evaluate(function () { navigator.canShare = undefined; document.getElementById('btn-export-file').click(); });
  const dl = await dlP;
  const dlPath = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(dlPath);
  check('导出：不能分享时改成下载', exportedOk(fs.readFileSync(dlPath, 'utf8')), dl.suggestedFilename());
  fs.unlinkSync(dlPath); // it holds the teacher data

  /* 5b. importing again (from the teacher tools) keeps the data it replaces */
  const chooser2P = page.waitForEvent('filechooser');
  await page.evaluate(function () { document.getElementById('btn-import-file').click(); });
  await (await chooser2P).setFiles(TEST_FILE);
  await page.waitForSelector('#confirm-modal-overlay.active');
  await Promise.all([page.waitForEvent('load'), page.tap('#confirm-modal-ok')]);
  await waitForApp(page);
  const backups = await page.evaluate(function () { return window.HanziStore.keys(); });
  check('再次导入：替换前留了备份', backups.some(function (k) { return /^backup:import:/.test(k); }), backups);

  /* 6. recordings from the Mac (webm) */
  const audio = await page.evaluate(async function () {
    var a = document.createElement('audio');
    var key = Object.keys(window.OVERLAY.customAudio)[0];
    var url = window.OVERLAY.customAudio[key];
    var native = a.canPlayType('audio/webm; codecs="opus"');
    var decoded = 'n/a';
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      var buf = await (await fetch(url)).arrayBuffer();
      var b = await new Promise(function (res, rej) { new C().decodeAudioData(buf, res, rej); });
      decoded = b.duration.toFixed(2) + ' 秒';
    } catch (e) { decoded = '失败：' + e; }
    return { native: native || '(空)', decoded: decoded };
  });
  info('Mac 录的 webm 录音：直接播放 / 解码', audio);

  /* 7. touch: 学习 opens 每周生字 (the writing units); switch to 全部生字 and back; open the first unit */
  await page.tap('.tabbar button[data-tab="test"]');
  await page.tap('.tabbar button[data-tab="learn"]');
  const weeklyShown = await page.evaluate(function () { var v = document.getElementById('view-write'); return !!v && getComputedStyle(v).display !== 'none'; });
  await page.tap('#view-write .learn-mode button[data-mode="all"]');
  const allShown = await page.evaluate(function () { return getComputedStyle(document.getElementById('view-learn')).display !== 'none'; });
  await page.tap('#view-learn .learn-mode button[data-mode="weekly"]');
  check('用手指点“学习”打开每周生字，能切换到全部生字再切回来', weeklyShown && allShown);
  await page.evaluate(function () { window.openWriteUnit(0); });
  await page.waitForSelector('#btn-tracing');
  await page.tap('#btn-tracing');
  await page.waitForSelector('#tracing-overlay.active');
  await page.waitForFunction(function () { return document.querySelectorAll('#tracing-preview svg').length > 0; });
  const tr = await page.evaluate(function () {
    return { pages: document.querySelectorAll('#tracing-preview svg').length, print: document.getElementById('tracing-print').textContent,
      saveHidden: getComputedStyle(document.getElementById('tracing-save')).display === 'none',
      didact: document.fonts.check('10px "Didact Gothic"') };
  });
  check('描红窗口：一个“打印或存成 PDF”按钮，拼音字体已加载', tr.pages > 0 && tr.print === '🖨 打印或存成 PDF' && tr.saveHidden && tr.didact, tr);
  await page.screenshot({ path: path.join(OUT, '2-tracing-window.png') });

  /* 8. printing: only the pages, at 16开 */
  await page.evaluate(function () { window.__printed = 0; window.print = function () { window.__printed++; }; });
  await page.tap('#tracing-print');
  await page.waitForFunction(function () { return window.__printed > 0; });
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(function () {
    var area = document.getElementById('ipad-print-area');
    var app = document.querySelector('.app');
    var pg = area.querySelector('.pg');
    // every reused drawing in the printed copy points to one inside the printed copy
    var uses = Array.from(area.querySelectorAll('use'));
    var broken = uses.filter(function (u) { var t = document.getElementById(u.getAttribute('href').slice(1)); return !t || !area.contains(t); }).length;
    return { uses: uses.length, broken: broken, pages: area.querySelectorAll('.pg').length, areaShown: getComputedStyle(area).display, appHidden: getComputedStyle(app).display === 'none',
      pageW: pg && pg.getBoundingClientRect().width.toFixed(0), pageH: pg && pg.getBoundingClientRect().height.toFixed(0),
      paper: Array.from(document.styleSheets).some(function (s) { try { return Array.from(s.cssRules).some(function (r) { return /size: ?185mm 260mm/.test(r.cssText); }); } catch (e) { return false; } }) };
  });
  check('打印时只有描红页，纸张 185 × 260 毫米，字和拼音都在', pr.uses > 0 && pr.broken === 0 && pr.pages === tr.pages && pr.areaShown === 'block' && pr.appHidden && pr.paper, pr);
  await page.screenshot({ path: path.join(OUT, '3-print-view.png') });
  await page.emulateMedia({ media: 'screen' });
  await page.dispatchEvent('body', 'pointerdown');
  const cleaned = await page.evaluate(function () {
    return !document.documentElement.classList.contains('ipad-printing') && !Array.from(document.querySelectorAll('style')).some(function (s) { return /185mm 260mm/.test(s.textContent) && /@page/.test(s.textContent); });
  });
  check('打印后恢复正常（“打印本页生字”的纸张不受影响）', cleaned);

  /* 9. portrait */
  await page.evaluate(function () { document.getElementById('tracing-close').click(); });
  await page.setViewportSize(devices['iPad Pro 11'].viewport);
  await page.tap('.tabbar button[data-tab="learn"]');
  await page.screenshot({ path: path.join(OUT, '4-portrait-learn.png') });
  const overflow = await page.evaluate(function () { return document.documentElement.scrollWidth - document.documentElement.clientWidth; });
  check('竖着拿 iPad 时页面不会左右滚动', overflow <= 1, overflow + ' px');

  /* 10. offline */
  const sw = await page.evaluate(function () { return !!(navigator.serviceWorker && navigator.serviceWorker.controller); });
  if (sw) {
    // Offline = the web server is gone, as when the iPad has no internet.
    await new Promise(function (r) { server.close(r); server.closeAllConnections && server.closeAllConnections(); });
    const off = await context.newPage();
    watch(off);
    try {
      await off.goto(base);
      await waitForApp(off);
      s = await summary(off);
      check('没有网络也能打开，数据还在', s.lessons === EXPECT.lessons, s);
    } catch (e) {
      check('没有网络也能打开', false, e.message.split('\n')[0]);
    }
  } else {
    info('离线缓存', '这个测试用的 WebKit 没有启用离线缓存，离线打开要在真 iPad 上试');
  }

  check('页面没有报错', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close();
  if (server.listening) server.close();
  console.log('\n' + passed + ' / ' + (passed + failed) + ' 项通过。截图在 ' + OUT);
  process.exit(failed ? 1 : 0);
}

run().catch(function (e) { console.error(e); server.close(); process.exit(1); });
