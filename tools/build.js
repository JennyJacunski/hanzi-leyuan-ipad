#!/usr/bin/env node
'use strict';
/*
 * build.js — makes the iPad app (a web app) in docs/ from the desktop app.
 *
 * It owns: putting together the files the iPad loads, and refusing to build
 * if any teacher data would end up in them.
 * It must not: change the desktop app. Everything is read from
 * ../desktop_version and only written into docs/ here.
 *
 * Reused from ../desktop_version (unchanged):
 *   app/web-template.html   the page itself, with EMPTY teacher data
 *                           (made by the desktop's tools/prepare-web.js)
 *   app/desktop.js, app/desktop-ui.js, app/learn-page.js   the desktop patches
 *   app/char-info.js, app/tracing-sheet.js, app/tracing-ui.js, app/tracing-sets.js   描红练习
 *   app/fonts/*             title font and pinyin font
 *   build/icon.png          the app icon (1024 px)
 * Added from src/: the start-up page, the iPad bridge and interface changes,
 * the offline cache, the home-screen manifest.
 *
 * docs/ is the folder GitHub Pages publishes (it only accepts that name or
 * the top folder). It is public, so the teacher data must never be in it:
 * the teacher imports it on the iPad from a file instead.
 *
 * Usage:  node tools/build.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DESKTOP = path.join(ROOT, '..', 'desktop_version');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'docs');

const EMPTY_TAG = '<script id="overlay-data" type="application/json">{}</script>';

function fail(msg) { console.error('错误：' + msg); process.exit(1); }
function count(h, n) { return h.split(n).length - 1; }
function replaceOnce(html, needle, replacement, what) {
  const n = typeof needle === 'string' ? count(html, needle) : (html.match(new RegExp(needle.source, 'g')) || []).length;
  if (n !== 1) fail(what + '：应该正好出现 1 次，实际出现 ' + n + ' 次。');
  return html.replace(needle, function () { return replacement; });
}
function read(p) { return fs.readFileSync(p, 'utf8'); }

/* ---- 1. the page --------------------------------------------------------- */
const template = read(path.join(DESKTOP, 'app', 'web-template.html'));
if (count(template, EMPTY_TAG) !== 1) fail('网页模板里的老师数据不是空的，不能放到公开的网站上。请先在桌面版运行 npm run prepare-web。');

let app = template;
// 1a. Google Fonts -> the local title font (same as the desktop app)
app = replaceOnce(
  app,
  /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">[\s\S]*?<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/,
  '<style>@font-face{font-family:"ZCOOL KuaiLe";src:url("fonts/ZCOOLKuaiLe-Regular.ttf") format("truetype");font-display:swap;}</style>',
  '谷歌字体链接'
);
if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(app)) fail('页面里还有谷歌字体的地址。');
// 1b. the home-screen settings in <head>
app = replaceOnce(
  app,
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<title>汉字乐园</title>' +
    '<link rel="manifest" href="manifest.webmanifest">' +
    '<link rel="apple-touch-icon" href="icon-180.png">' +
    '<meta name="apple-mobile-web-app-capable" content="yes">' +
    '<meta name="mobile-web-app-capable" content="yes">' +
    '<meta name="apple-mobile-web-app-title" content="汉字乐园">' +
    '<meta name="theme-color" content="#faf9f5">',
  'viewport 设置'
);
// 1c. the scripts after the page's own script. The bridge first: the desktop patches look for it.
app = replaceOnce(
  app,
  '</body></html>',
  ['store.js', 'ipad-bridge.js', 'desktop.js', 'desktop-ui.js', 'learn-page.js', 'char-info.js', 'tracing-sheet.js', 'tracing-ui.js', 'tracing-sets.js', 'ipad-ui.js']
    .map(function (f) { return '<script src="' + f + '"></script>\n'; }).join('') + '</body></html>',
  '</body></html>'
);

/* ---- 2. write docs/ ------------------------------------------------------ */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });

fs.writeFileSync(path.join(OUT, 'app.html'), app);
fs.writeFileSync(path.join(OUT, 'web-template.html'), template); // for 导出数据文件
['desktop.js', 'desktop-ui.js', 'learn-page.js', 'char-info.js', 'tracing-sheet.js', 'tracing-ui.js', 'tracing-sets.js'].forEach(function (f) {
  fs.copyFileSync(path.join(DESKTOP, 'app', f), path.join(OUT, f));
});
fs.readdirSync(path.join(DESKTOP, 'app', 'fonts')).forEach(function (f) {
  fs.copyFileSync(path.join(DESKTOP, 'app', 'fonts', f), path.join(OUT, 'fonts', f));
});
['index.html', 'loader.js', 'store.js', 'ipad-bridge.js', 'ipad-ui.js', 'manifest.webmanifest'].forEach(function (f) {
  fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
});
// Home-screen icons, scaled with the Mac's own image tool.
[180, 192, 512].forEach(function (size) {
  execFileSync('sips', ['-z', String(size), String(size), path.join(DESKTOP, 'build', 'icon.png'), '--out', path.join(OUT, 'icon-' + size + '.png')], { stdio: 'ignore' });
});
// GitHub Pages: publish the files as they are.
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

/* ---- 3. the offline cache: every file, and a version from their contents --- */
function listFiles(dir, base) {
  return fs.readdirSync(dir).flatMap(function (name) {
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (fs.statSync(full).isDirectory()) return listFiles(full, rel);
    return name.startsWith('.') ? [] : [rel];
  });
}
const files = listFiles(OUT, '').sort();
const hash = crypto.createHash('sha256');
files.concat(['sw.js']).forEach(function (f) {
  hash.update(f);
  hash.update(f === 'sw.js' ? read(path.join(SRC, 'sw.js')) : fs.readFileSync(path.join(OUT, f)));
});
const version = hash.digest('hex').slice(0, 12);
const sw = read(path.join(SRC, 'sw.js'))
  .replace("'__VERSION__'", JSON.stringify(version))
  .replace('__FILES__', JSON.stringify(['./'].concat(files)));
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);

/* ---- 4. privacy check on what will be public ------------------------------ */
listFiles(OUT, '').forEach(function (f) {
  if (!/\.(html|js|json|webmanifest)$/.test(f)) return;
  const text = read(path.join(OUT, f));
  if (/data:audio\//.test(text)) fail(f + ' 里有录音数据，不能公开。');
  // (the scripts mention the tag's opening text themselves, so only pages are checked for it)
  if (/\.html$/.test(f) && /<script id="overlay-data" type="application\/json">(?!\{\}<\/script>)/.test(text)) fail(f + ' 里有老师数据，不能公开。');
});

let total = 0;
listFiles(OUT, '').forEach(function (f) { total += fs.statSync(path.join(OUT, f)).size; });
console.log('已生成 docs/：' + (files.length + 1) + ' 个文件，共 ' + (total / 1024 / 1024).toFixed(1) + ' MB，版本 ' + version);
