'use strict';
/*
 * store.js — the teacher data on the iPad (in the browser's IndexedDB).
 *
 * It owns: reading and writing the teacher data text, the daily backups and
 * the backup made before an import.
 * It must not: know about the page. Both the start-up page (loader.js) and
 * the app (ipad-bridge.js) use it.
 *
 * Why IndexedDB: the teacher data is about 5 MB (269 recordings). The
 * browser's simpler localStorage holds only about 5 MB in all, so it would
 * not fit; IndexedDB holds far more.
 *
 * Keys in the one table "kv":
 *   overlay                      the current teacher data (JSON text)
 *   backup:day:YYYY-MM-DD        the data as it was before the first save of that day, newest 7 kept
 *   backup:import:YYYY-MM-DD_hhmmss  the data as it was before an import, newest 5 kept
 */
(function () {
  var DB_NAME = 'hanzi-leyuan';
  var TABLE = 'kv';
  var DAILY_KEPT = 7;
  var IMPORT_KEPT = 5;

  var dbPromise = null;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(TABLE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('无法打开 iPad 上的数据库')); };
    });
    return dbPromise;
  }

  /* One transaction; `work(table)` queues requests, the promise settles when it is committed. */
  function run(mode, work) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(TABLE, mode);
        var result;
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error || new Error('数据库出错')); };
        tx.onabort = function () { reject(tx.error || new Error('数据库操作被中断（空间可能不够）')); };
        result = work(tx.objectStore(TABLE), function (v) { result = v; });
      });
    });
  }

  function get(key) {
    return run('readonly', function (t, done) {
      var r = t.get(key);
      r.onsuccess = function () { done(r.result === undefined ? null : r.result); };
    });
  }
  function keys() {
    return run('readonly', function (t, done) {
      var r = t.getAllKeys();
      r.onsuccess = function () { done(r.result || []); };
    });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function day(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function stamp(d) { return day(d) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()); }

  /* Oldest first; everything beyond the newest `keep` with this prefix is removed. */
  function prune(prefix, keep) {
    return keys().then(function (all) {
      var old = all.filter(function (k) { return String(k).indexOf(prefix) === 0; }).sort();
      old = old.slice(0, Math.max(0, old.length - keep));
      if (!old.length) return;
      return run('readwrite', function (t) { old.forEach(function (k) { t.delete(k); }); });
    });
  }

  /* Save the teacher data. The first save of a day first keeps yesterday's state as that day's backup. */
  function save(text) {
    var backupKey = 'backup:day:' + day(new Date());
    return get(backupKey).then(function (existing) {
      return run('readwrite', function (t) {
        if (existing === null) {
          var cur = t.get('overlay');
          cur.onsuccess = function () {
            if (cur.result) t.put(cur.result, backupKey);
            t.put(text, 'overlay');
          };
        } else {
          t.put(text, 'overlay');
        }
      });
    }).then(function () { return prune('backup:day:', DAILY_KEPT); });
  }

  /* Replace the teacher data with imported data, keeping the old data as a backup first. */
  function replaceFromImport(text) {
    return run('readwrite', function (t) {
      var cur = t.get('overlay');
      cur.onsuccess = function () {
        if (cur.result) t.put(cur.result, 'backup:import:' + stamp(new Date()));
        t.put(text, 'overlay');
      };
    }).then(function () { return prune('backup:import:', IMPORT_KEPT); });
  }

  /* The newest backup that is valid JSON, for when the current data cannot be read. */
  function newestGoodBackup() {
    return keys().then(function (all) {
      var list = all.filter(function (k) { return /^backup:/.test(k); })
        .sort(function (a, b) { return a.replace(/^backup:\w+:/, '') < b.replace(/^backup:\w+:/, '') ? 1 : -1; });
      function next(i) {
        if (i >= list.length) return null;
        return get(list[i]).then(function (text) {
          try { JSON.parse(text); return { key: list[i], text: text }; } catch (e) { return next(i + 1); }
        });
      }
      return next(0);
    });
  }

  window.HanziStore = {
    load: function () { return get('overlay'); },
    save: save,
    replaceFromImport: replaceFromImport,
    newestGoodBackup: newestGoodBackup,
    keys: keys,
  };
})();
