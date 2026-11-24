'use strict';
/*
 * tag-tools.js — two buttons on 学习 → 📚 全部生字 when a teacher's 标签
 * (or “未分类”) is the one shown (decided 2026-11-23):
 *
 *   📝 生成描红练习   everyone: opens the tracing window (tracing-ui.js) with
 *                     the tag's characters — pick all or some, then save a
 *                     PDF or print. Each page is headed with the tag's name.
 *   🗑 删除这个标签    teachers, real tags only: deletes the tag. Characters
 *                     from the app's own list (一到四年级) only leave the tag.
 *                     Characters the teacher added are deleted with it (their
 *                     pinyin, 组词, recordings, stroke data), unless another
 *                     tag, a week or a 自选描红练习 still uses them. A confirm
 *                     window says exactly what will happen first.
 *
 * Not shown for 一年级…四年级: those are the app's own list, and their
 * tracing pages come from 每周生字.
 * It must not: change how the 全部生字 grid draws, or delete anything from
 * the app's own character list.
 *
 * Opened in a normal browser (no window.desktopApp), this file does nothing.
 */
(function () {
  if (!window.desktopApp || !window.TracingUI) return;
  var W = window;
  var UNSORTED = '__unsorted__';

  function el(id) { return document.getElementById(id); }
  function O() { return W.OVERLAY; }

  var style = document.createElement('style');
  style.textContent =
    '.tag-tools{display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap;}' +
    '.tag-tools[hidden],.tag-tools [hidden]{display:none !important;}';
  document.head.appendChild(style);

  /* The tag shown now: {key, label, chars, real} or null. */
  function currentTag() {
    var key = W.learnState && W.learnState.group;
    if (key === UNSORTED) {
      var g = W.findGroup(UNSORTED);
      return g ? { key: key, label: g.label, chars: g.chars, real: false } : null;
    }
    var tag = (O().groups || []).filter(function (x) { return x.key === key; })[0];
    return tag ? { key: key, label: tag.label, chars: O().groupChars[key] || [], real: true } : null;
  }

  function build() {
    if (el('tag-tools')) return;
    var anchor = el('learn-count');
    if (!anchor) return;
    var box = document.createElement('span');
    box.className = 'tag-tools';
    box.id = 'tag-tools';
    box.hidden = true;
    box.innerHTML =
      '<button class="btn" id="tag-tracing" type="button">📝 生成描红练习</button>' +
      '<button class="btn danger" id="tag-delete" type="button">🗑 删除这个标签</button>';
    anchor.insertAdjacentElement('afterend', box);
    el('tag-tracing').addEventListener('click', openTracing);
    el('tag-delete').addEventListener('click', askDelete);
  }

  function update() {
    var box = el('tag-tools');
    if (!box) return;
    var tag = currentTag();
    var usable = !!tag && W.learnState.query === '';
    box.hidden = !usable;
    if (!usable) return;
    el('tag-tracing').disabled = !tag.chars.some(function (ch) { return W.getCardsForChar(ch).length; });
    el('tag-delete').hidden = !(tag.real && W.teacherMode);
  }

  /* ---- 📝 生成描红练习 ------------------------------------------------------ */
  function openTracing() {
    var tag = currentTag();
    if (!tag) return;
    var chars = tag.chars.filter(function (ch) { return W.getCardsForChar(ch).length; });
    if (!chars.length) return;
    W.TracingUI.open({ chars: chars, heading: tag.label, note: '', extra: {} });
  }

  /* ---- 🗑 删除这个标签 ------------------------------------------------------- */
  // Is this character still used outside the tag being deleted?
  function usedElsewhere(ch, key) {
    var o = O();
    if ((o.groups || []).some(function (g) { return g.key !== key && (o.groupChars[g.key] || []).indexOf(ch) >= 0; })) return true;
    if ((o.writingUnits || []).some(function (u) { return (u.chars || []).indexOf(ch) >= 0; })) return true;
    if ((o.tracingSets || []).some(function (s) { return (s.chars || []).indexOf(ch) >= 0; })) return true;
    return false;
  }

  /* What deleting this tag would do: {own, kept, removed}. */
  function planDelete(tag) {
    var own = [], kept = [], removed = [];
    tag.chars.forEach(function (ch) {
      if (W.BASE_CHAR_SET[ch] || !O().newCharBase[ch]) own.push(ch);
      else if (usedElsewhere(ch, tag.key)) kept.push(ch);
      else removed.push(ch);
    });
    return { own: own, kept: kept, removed: removed };
  }

  // A character's own keys in the per-card maps: the character itself, its
  // other readings ('都@dū') and its word recordings ('都::w::首都').
  function belongsTo(key, ch) { return key === ch || key.indexOf(ch + '@') === 0 || key.indexOf(ch + '::') === 0; }
  function dropKeys(map, ch) {
    if (!map) return;
    Object.keys(map).forEach(function (k) { if (belongsTo(k, ch)) delete map[k]; });
  }

  function deleteTag(tag, plan) {
    var o = O();
    plan.removed.forEach(function (ch) {
      delete o.newCharBase[ch];
      delete o.extraReadings[ch];
      delete o.customStrokeData[ch];
      [o.customAudio, o.charEdits, o.extraWords, o.deletedCards].forEach(function (m) { dropKeys(m, ch); });
    });
    o.groups = o.groups.filter(function (g) { return g.key !== tag.key; });
    delete o.groupChars[tag.key];
    if (W.testConfig && W.testConfig.customGroups) delete W.testConfig.customGroups[tag.key];

    W.learnState.group = W.allGroups()[0].key;
    W.populateGradeSeg();
    W.renderLearnGrid();
    W.renderCustomGroupChips();
    if (typeof W.updatePoolCount === 'function') W.updatePoolCount();
    if (W.AddChars) W.AddChars.refresh();
    W.queueSave();
  }

  function askDelete() {
    var tag = currentTag();
    if (!tag || !tag.real || !W.teacherMode) return;
    var plan = planDelete(tag);
    var parts = ['删除标签“' + tag.label + '”。'];
    if (plan.removed.length) parts.push(plan.removed.length + ' 个老师加的新字会从字库删除（连同拼音、组词、录音）：' + plan.removed.join('、') + '。');
    if (plan.kept.length) parts.push(plan.kept.length + ' 个老师加的字还在别的标签、每周生字或自选描红练习里用着，保留：' + plan.kept.join('、') + '。');
    if (plan.own.length) parts.push(plan.own.length + ' 个字库原有的字只移出这个标签，字本身不删。');
    if (!tag.chars.length) parts.push('这个标签里没有字。');
    parts.push('删除后不能撤销。');
    W.openConfirmModal('删除这个标签？', parts.join(''), '删除', function (ok) {
      if (ok) deleteTag(tag, plan);
    });
  }

  /* ---- keep the buttons in step with the page ------------------------------- */
  var pageRenderLearnGrid = W.renderLearnGrid;
  W.renderLearnGrid = function () {
    var r = pageRenderLearnGrid.apply(this, arguments);
    update();
    return r;
  };
  var pageApplyTeacherUI = W.applyTeacherUI;
  W.applyTeacherUI = function () {
    var r = pageApplyTeacherUI.apply(this, arguments);
    update();
    return r;
  };

  build();
  document.addEventListener('DOMContentLoaded', function () { build(); update(); });

  W.TagTools = { current: currentTag, plan: function () { var t = currentTag(); return t && t.real ? planDelete(t) : null; } };
})();
