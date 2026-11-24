'use strict';
/*
 * sw.js — the offline cache (a "service worker": a small script Safari keeps
 * for this site and asks before fetching anything from it).
 *
 * It owns: keeping a copy of every file of the app on the iPad, so the app
 * also opens without internet; replacing that copy when a new version is
 * published; keeping stroke data fetched for characters a teacher added.
 * It must not: cache anything else from the internet (YouTube links etc.).
 *
 * tools/build.js fills in VERSION and FILES. A new VERSION makes Safari
 * install the new files the next time the app is opened with internet; the
 * time after that, the new version is what opens.
 */
var VERSION = "99a803c65e05";
var FILES = ["./","add-chars.js","app.html","char-info.js","desktop-ui.js","desktop.js","fonts/DidactGothic-Regular.ttf","fonts/OFL-DidactGothic.txt","fonts/OFL.txt","fonts/ZCOOLKuaiLe-Regular.ttf","icon-180.png","icon-192.png","icon-512.png","index.html","ipad-bridge.js","ipad-ui.js","learn-page.js","loader.js","manifest.webmanifest","store.js","tracing-sets.js","tracing-sheet.js","tracing-ui.js","web-template.html"];
var APP_CACHE = 'hanzi-app-' + VERSION;
var STROKE_CACHE = 'hanzi-strokes';
var STROKE_HOST = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(APP_CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n.indexOf('hanzi-app-') === 0 && n !== APP_CACHE; })
        .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Stroke data for a character the teacher added: fetched once, then kept.
  if (req.url.indexOf(STROKE_HOST) === 0) {
    event.respondWith(caches.open(STROKE_CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (resp) { if (resp.ok) c.put(req, resp.clone()); return resp; });
      });
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;
  // The app's own files: from the copy on the iPad; the internet only for anything not in it.
  event.respondWith(caches.open(APP_CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      // Opening the site's address without a file name means the start page.
      if (req.mode === 'navigate') {
        return c.match('index.html').then(function (start) { return start || fetch(req); });
      }
      return fetch(req);
    });
  }));
});
