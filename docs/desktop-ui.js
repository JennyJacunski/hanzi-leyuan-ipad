'use strict';
/*
 * desktop-ui.js — makes the page simpler to use in the desktop app.
 *
 * It owns these changes to the page's interface, all decided on 2026-11-17:
 *   1. the teacher tools (教师工具) start folded up; clicking the bar opens
 *      them at the tab that fits the page you are on
 *   2. no second copy of the 课文 / 学写字 catalogues inside the teacher
 *      tools — the 课文 and 学写字 pages already have ✏️ / 🗑 / ➕
 *   3. no "补充组词" tab — a card's own edit window has "再加一个词"
 *   4. no search box on the 学习 page — the 🔍 搜索 page searches everything
 *   5. the app always opens in student mode; teacher mode needs the PIN
 *      again after the app was closed (a reload inside one session keeps it)
 *   6. the note "电脑朗读的声音暂时无法下载…请老师…" in a lesson shows in
 *      teacher mode only
 *   7. the name on the page is 汉字乐园
 *   8. 导出 / 导入 / 修改密码 live in the 文件 menu of the menu bar, not as
 *      buttons at the top of the teacher tools
 * It must not: change what any feature does. It only hides, folds and moves
 * parts of the page, and calls the page's own functions and buttons.
 *
 * Opened in a normal browser (no window.desktopApp), this file does nothing.
 */
(function () {
  var desktop = window.desktopApp;
  if (!desktop) return;

  var APP_TITLE = '汉字乐园';

  /* ---- 5. always start in student mode ---------------------------------
     The page remembers teacher mode in localStorage, so it survived closing
     the app. This runs before the page's start-up reads it. sessionStorage
     lasts while the app is open (also over a reload, e.g. after an import)
     and is empty in every new start. */
  try {
    if (sessionStorage.getItem('hanzi_teacher_session') !== '1') localStorage.setItem('hanzi_teacher_ui', '0');
  } catch (e) { /* storage unavailable: the page then starts in student mode anyway */ }

  /* ---- styles for 1, 2, 3, 4, 6, 8 --------------------------------------- */
  var style = document.createElement('style');
  style.textContent =
    // 1: folded teacher tools show only their title bar
    '#teacher-panel .teacher-panel-head{cursor:pointer;user-select:none;}' +
    '#teacher-panel.folded .teacher-panel-head{margin-bottom:0;}' +
    '#teacher-panel.folded > :not(.teacher-panel-head){display:none !important;}' +
    // margin-right:auto keeps the button beside the title, the save state on the right
    '.teacher-fold-btn{margin-left:10px;margin-right:auto;}' +
    // 2: the second catalogue copies in the teacher tools
    '#lesson-manage-grade-seg,#lesson-manage-toc,#write-manage-grade-seg,#write-manage-toc,.desk-hidden{display:none !important;}' +
    // 3: the 补充组词 tab
    '.t-tab[data-ttab="words"]{display:none !important;}' +
    // 4: the 学习 page search box
    '#view-learn .search-box{display:none !important;}' +
    // 6: the note meant for teachers
    'body:not(.teacher-active) .lesson-audio-note{display:none !important;}' +
    // 8: these three are in the 文件 menu now
    '#btn-export-file,#btn-import-file,#btn-toggle-pin-settings{display:none !important;}';
  document.head.appendChild(style);

  function el(id) { return document.getElementById(id); }

  /* ---- 1. folding the teacher tools ---------------------------------------- */
  // Which teacher tab fits which page.
  var TAB_FOR_VIEW = { learn: 'edit', test: 'quizvoice', stories: 'stories', lessons: 'lessons', write: 'addchars', search: 'edit' };
  // The view on screen, not the top-bar button: since 1.2.4 the 学习 button
  // can show #view-write (每周生字, see learn-page.js).
  function currentView() {
    var v = document.querySelector('.view.active');
    return v ? v.id.replace(/^view-/, '') : 'learn';
  }
  function panel() { return el('teacher-panel'); }
  function isFolded() { return panel().classList.contains('folded'); }
  function setFolded(folded) {
    var p = panel();
    p.classList.toggle('folded', folded);
    var btn = el('teacher-fold-btn');
    if (btn) btn.textContent = folded ? '展开 ▾' : '收起 ▴';
  }
  // The page's own function for "show this teacher tab". Several page
  // actions call it (✏️ on a lesson or a writing unit, ➕ 添加 on a missing
  // lesson) and then scroll to the teacher tools, so it also unfolds them.
  var pageSwitchToTeacherTab = window.switchToTeacherTab;
  window.switchToTeacherTab = function (name) {
    setFolded(false);
    return pageSwitchToTeacherTab(name);
  };
  function unfoldForCurrentPage() {
    setFolded(false);
    pageSwitchToTeacherTab(TAB_FOR_VIEW[currentView()] || 'edit');
  }

  // Entering or leaving teacher mode: fold the tools again, and remember the
  // mode for this session only (see 5).
  var pageApplyTeacherUI = window.applyTeacherUI;
  window.applyTeacherUI = function () {
    pageApplyTeacherUI();
    try {
      var on = window.teacherMode ? '1' : '0';
      sessionStorage.setItem('hanzi_teacher_session', on);
      localStorage.setItem('hanzi_teacher_ui', on); // the page's own record, kept in step
    } catch (e) { /* ignore */ }
    if (panel()) setFolded(true);
  };

  /* ---- 8. commands from the 文件 menu ---------------------------------------- */
  function needTeacher() {
    if (window.teacherMode) return true;
    window.openConfirmModal('这是老师的功能', '请先把左上角的开关切换到“教师模式”（需要输入老师密码），再使用这个功能。', '知道了', function () {});
    return false;
  }
  var MENU_COMMANDS = {
    'export': function () { if (needTeacher()) el('btn-export-file').click(); },
    'import': function () { if (needTeacher()) el('btn-import-file').click(); },
    'pin': function () {
      if (!needTeacher()) return;
      setFolded(false);
      var row = el('pin-settings-row');
      if (row.hidden) row.hidden = false;
      panel().scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(function () { el('new-teacher-pin').focus(); }, 300);
    },
  };
  if (desktop.onMenuCommand) {
    desktop.onMenuCommand(function (name) { if (MENU_COMMANDS[name]) MENU_COMMANDS[name](); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // The page's own start-up has already run (its listener was added first).

    /* 7. the name */
    document.title = APP_TITLE;
    var h1 = document.querySelector('.app-title h1');
    if (h1) h1.textContent = APP_TITLE;

    /* 1. the fold button on the teacher tools' title bar */
    var head = document.querySelector('#teacher-panel .teacher-panel-head');
    if (head && !el('teacher-fold-btn')) {
      var fold = document.createElement('button');
      fold.className = 'btn tiny teacher-fold-btn';
      fold.id = 'teacher-fold-btn';
      fold.type = 'button';
      head.querySelector('h3').insertAdjacentElement('afterend', fold);
      head.addEventListener('click', function (e) {
        // the buttons inside the title bar keep their own job
        if (e.target.closest('button') && e.target.closest('button') !== fold) return;
        if (isFolded()) unfoldForCurrentPage(); else setFolded(true);
      });
    }
    setFolded(true);

    /* 2. the dividers above the hidden catalogue copies */
    document.querySelectorAll('#teacher-panel .t-divider').forEach(function (d) {
      if (/^(课文目录|学写字目录)/.test(d.textContent.trim())) d.classList.add('desk-hidden');
    });

    /* 3. if the hidden 补充组词 tab is the one open, open the next one */
    var wordsTab = document.querySelector('.t-tab[data-ttab="words"]');
    if (wordsTab && wordsTab.classList.contains('active')) pageSwitchToTeacherTab('edit');

    /* 4. Without its search box, the 学习 page is only ever filtered by a
       jump from the 🔍 搜索 page. Going to the 学习 page any other way, or
       picking a grade, shows the whole grade again. */
    function clearLearnFilter() {
      if (!window.learnState || !window.learnState.query) return;
      window.learnState.query = '';
      var input = el('learn-search');
      if (input) input.value = '';
      var back = el('btn-learn-back');
      if (back) back.style.display = 'none';
      window.renderLearnGrid();
    }
    var learnTab = document.querySelector('.tabbar button[data-tab="learn"]');
    if (learnTab) learnTab.addEventListener('click', clearLearnFilter);
    var gradeSeg = el('learn-grade-seg');
    if (gradeSeg) gradeSeg.addEventListener('click', function (e) { if (e.target.closest('button')) clearLearnFilter(); }, true);
  });
})();
