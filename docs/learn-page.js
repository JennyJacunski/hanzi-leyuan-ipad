'use strict';
/*
 * learn-page.js — one 学习 page with two ways to look at the characters
 * (decided 2026-11-23):
 *
 *   📅 每周生字   the teacher's writing units (the old 学写字 page): grade →
 *                 unit → week; the characters taught that week, in teaching
 *                 order. A character can come back in a later grade.
 *   📚 全部生字   the whole character list (the old 学习 page), each
 *                 character under the grade it first appears in.
 *
 * The two lists are not the same thing ("四年级" means different characters
 * in each), so both are kept; they only share one place and the top-bar
 * button. The old 学写字 button is hidden.
 *
 * How it works: the page still has its two views, #view-learn (全部生字) and
 * #view-write (每周生字), and all their own code. This file hides the 学写字
 * button, puts the switch at the top of both views, shows the right view
 * when 学习 is clicked, and carries the chosen grade from one view to the
 * other.
 *
 * It owns: the switch, which view 学习 shows, and keeping the grade in step.
 * It must not: change what either view does or how it draws its characters.
 *
 * Opened in a normal browser (no window.desktopApp), this file does nothing.
 */
(function () {
  if (!window.desktopApp) return;

  var MODE_KEY = 'hanzi_learn_mode';
  var GROUP_FOR_GRADE = { '一年级': 'g1', '二年级': 'g2', '三年级': 'g3', '四年级': 'g4' };
  var HINT = {
    weekly: '老师按教学进度整理的每周生字',
    all: '全部生字，每个字放在它第一次出现的年级',
  };

  var mode = 'weekly';
  try { if (localStorage.getItem(MODE_KEY) === 'all') mode = 'all'; } catch (e) { /* storage unavailable */ }

  function el(id) { return document.getElementById(id); }

  var style = document.createElement('style');
  style.textContent =
    '.tabbar button[data-tab="write"]{display:none !important;}' +
    // the old 学写字 heading is replaced by the switch
    '#view-write > .controls > div:not(.learn-mode){display:none !important;}' +
    '.learn-mode{display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%;}' +
    '.learn-mode .seg button{font-size:15px;}' +
    '.learn-mode .learn-mode-hint{font-size:13px;color:var(--ink-soft);}' +
    '#view-learn > .controls{flex-wrap:wrap;}';
  document.head.appendChild(style);

  function switchHtml() {
    return '<div class="seg learn-mode-seg">' +
        '<button type="button" data-mode="weekly">📅 每周生字</button>' +
        '<button type="button" data-mode="all">📚 全部生字</button>' +
      '</div><span class="learn-mode-hint"></span>';
  }
  function updateSwitches() {
    document.querySelectorAll('.learn-mode').forEach(function (bar) {
      bar.querySelectorAll('button[data-mode]').forEach(function (b) { b.classList.toggle('active', b.dataset.mode === mode); });
      bar.querySelector('.learn-mode-hint').textContent = HINT[mode];
    });
  }
  function remember() {
    try { localStorage.setItem(MODE_KEY, mode); } catch (e) { /* ignore */ }
  }

  /* The grade each view is on, as a grade name ('二年级'), or null. */
  function learnGrade() {
    var key = window.learnState && window.learnState.group;
    for (var g in GROUP_FOR_GRADE) if (GROUP_FOR_GRADE[g] === key) return g;
    var group = window.findGroup ? window.findGroup(key) : null;
    return group ? window.detectGradeFromText(group.label) : null; // e.g. "二年级老师增字"
  }

  function showView(id) {
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === 'learn'); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    el(id).classList.add('active');
  }

  /* Show the chosen view, carrying the grade over from the other one. */
  function show(newMode) {
    var from = mode;
    mode = newMode;
    remember();
    updateSwitches();
    if (mode === 'weekly') {
      var g = from === 'all' ? learnGrade() : null;
      if (g) window.writeGradeState.grade = g;
      showView('view-write');
      window.renderWriteView();
    } else {
      var key = from === 'weekly' ? GROUP_FOR_GRADE[window.writeGradeState.grade] : null;
      if (key && window.learnState.group !== key && !window.learnState.query) {
        window.learnState.group = key;
        window.populateGradeSeg();
        window.renderLearnGrid();
      }
      showView('view-learn');
    }
  }

  // Search → "在学习里看这个字" always means the whole list.
  var pageGoToLearnChar = window.goToLearnChar;
  window.goToLearnChar = function (ch) {
    mode = 'all';
    updateSwitches();
    return pageGoToLearnChar(ch);
  };

  // Entering or leaving teacher mode: the page redraws the 学写字 catalogue
  // only when its own (now hidden) button is the active one, so do it here.
  var pageApplyTeacherUI = window.applyTeacherUI;
  window.applyTeacherUI = function () {
    pageApplyTeacherUI();
    var w = el('view-write');
    if (w && w.classList.contains('active') && !el('write-toc').hidden) window.renderWriteView();
  };

  window.LearnPage = {
    mode: function () { return mode; },
    show: show,
  };

  document.addEventListener('DOMContentLoaded', function () {
    // The page's own start-up has already run (its listener was added first).
    ['view-learn', 'view-write'].forEach(function (id) {
      var controls = document.querySelector('#' + id + ' > .controls');
      if (!controls || controls.querySelector('.learn-mode')) return;
      var bar = document.createElement('div');
      bar.className = 'learn-mode';
      bar.innerHTML = switchHtml();
      controls.insertBefore(bar, controls.firstChild);
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-mode]');
        if (b && b.dataset.mode !== mode) show(b.dataset.mode);
      });
    });
    updateSwitches();

    // The 学习 button: the page shows 全部生字; switch to 每周生字 when that is the choice.
    var learnBtn = document.querySelector('.tabbar button[data-tab="learn"]');
    if (learnBtn) learnBtn.addEventListener('click', function () { if (mode === 'weekly') show('weekly'); });

    // The app opens on the 学习 page: show the chosen view straight away.
    var active = document.querySelector('.tabbar button.active');
    if (mode === 'weekly' && (!active || active.dataset.tab === 'learn' || active.dataset.tab === 'write')) show('weekly');
  });
})();
