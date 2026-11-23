'use strict';
/*
 * tracing-sheet.js — draws 描红 (tracing) practice pages as SVG pictures.
 *
 * It owns: the page layout and all the drawing of a practice sheet. It began
 * as a JavaScript version of the 汉字描红练习页 app's layout.py and
 * pdf_export.py and keeps its page: a 16-开 page (185 × 260 mm), three
 * characters per page; per character a left column (pinyin, the big
 * character, 笔画 / 结构 / 部首), a 田字格 grid (red stroke-by-stroke rows,
 * grey copies, a blank practice row, each with a 四线三格 pinyin band above
 * it) and a 组词 / 造句 strip; the page number ("1 / 3") is centred in the
 * bottom margin. With a heading (the writing unit's name) the page number
 * moves up into a heading line in the top margin instead:
 * "二年级 第二单元 第一周   1 / 5".
 *
 * Since 1.2.3 this sheet differs from the other app on purpose (only this app
 * was changed): the pinyin bands are taller (two thirds of a cell) so the
 * pinyin is larger; each row has as many cells as fit across the block (10
 * for most characters), so the grid always fills the width and a character
 * with up to 20 strokes keeps the normal cell size; and the pinyin is set in
 * Didact Gothic (school-book ɑ and g), black in the left column and dark
 * grey in the grid, slightly emboldened so it prints clearly.
 *
 * It must not: look anything up or know about the app. The caller hands in
 * each character's pinyin, words, stroke outlines, radical and structure;
 * missing values are drawn as blanks or "—", never guessed.
 *
 * All sizes are millimetres: one SVG unit is one millimetre.
 *
 * Use:
 *   var result = TracingSheet.buildPages(entries, { heading: '二年级 第二单元 第一周' });
 *   (leave out the options for the page number at the bottom and no heading)
 *   options.note: a teacher's note (自选描红练习), printed on every page under
 *   日期 / 姓名; the character blocks get a little lower to make room
 *   result.pages   -> one SVG string per page
 *   result.notes   -> what was missing, e.g. "「拔」缺少：笔顺（对应处留空）"
 * where each entry is
 *   { char, pinyin, words: [..], strokes: [SVG path strings, writing order],
 *     radical, structure }
 */
(function (root) {
  /* ---- page geometry (layout.py) ---------------------------------------- */
  var PAGE_W = 185, PAGE_H = 260;
  var MARGIN = 10;
  var HEADER = 14;            // the 日期 / 姓名 line at the top
  var NOTE_SIZE = 3.6;        // the teacher's note under it (自选描红练习), font size …
  var NOTE_MIN_SIZE = 3.0;    // … made smaller down to this before it takes a second line
  var NOTE_LINE = 5.2;        // height of one note line
  var NOTE_MAX_LINES = 2;
  var STRIP = 9;              // the 组词 / 造句 strip at the bottom of each block
  var LEFT_COL_MIN = 30;      // pinyin, big character, 笔画 / 结构 / 部首; it also takes
                              // the few millimetres the grid's whole cells leave over
  var ROWS_PER_CHAR = 3;      // red tracing, grey copies, blank practice
  var PER_PAGE = 3;
  var MAX_CELL = 15;
  var PINYIN_BAND_RATIO = 0.65; // height of the 四线三格 band, as a share of a cell
  var WRITING_LINES = 4;      // four lines make three writing spaces
  var GLYPH_FILL = 0.78;      // a character's ink fills this share of its cell
  var LEFT_CHAR = 30;         // the box for the big character
  var LEFT_INFO_ROWS = 3;     // 笔画, 结构, 部首

  /* ---- colours and line widths (pdf_export.py) --------------------------- */
  var RED = 'rgb(214,40,50)';
  var GRID_RED = 'rgb(200,45,85)';          // the ruled lines
  var GRID_RED_LIGHT = 'rgb(225,130,150)';  // the dashed centre cross
  var LINE = 0.25;                          // ruled line width
  var BLOCK_FRAME = 0.5;                    // the frame around each character block
  var GREY = 'rgb(90,90,90)', GREY_OPACITY = 70 / 255;
  var INK = 'rgb(20,20,20)';
  var PINYIN_LEFT = INK;              // the reading in the left column
  var PINYIN_GRID = 'rgb(75,75,75)';  // the pinyin over the grid: dark, but lighter than the reading
  var PINYIN_BOLD = 0.045;            // outline added round each letter, as a share of the font size
  var PINYIN_X_FILL = 0.92;           // a letter's x-height fills this share of the middle space
  var PINYIN_MAX_WIDTH = 0.82;        // a syllable is at most this share of a cell wide

  /* 楷体 for labels: the Mac's Kaiti SC first, then the Windows 楷体, then
     whatever serif font the system has. */
  var FONT_FAMILY = '"Kaiti SC","STKaiti","KaiTi","楷体","LXGW WenKai",serif';
  /* Pinyin: Didact Gothic (SIL OFL, app/fonts/), a font made for teaching
     children their letters: single-storey ɑ and g, and every tone letter.
     Its @font-face is in tracing-ui.js (the app page) and tracing-print.html. */
  var PINYIN_FONT_NAME = 'Didact Gothic';
  var PINYIN_FONT = '"' + PINYIN_FONT_NAME + '",sans-serif';

  /* ---- small helpers ----------------------------------------------------- */
  function n(v) { return String(Math.round(v * 1000) / 1000); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function line(x1, y1, x2, y2, color, width, dash) {
    return '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) +
      '" stroke="' + color + '" stroke-width="' + width + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
  }
  function box(r, color, width) {
    return '<rect x="' + n(r.x) + '" y="' + n(r.y) + '" width="' + n(r.w) + '" height="' + n(r.h) +
      '" fill="none" stroke="' + color + '" stroke-width="' + width + '"/>';
  }

  function chunkPages(items) {
    var pages = [];
    for (var i = 0; i < items.length; i += PER_PAGE) pages.push(items.slice(i, i + PER_PAGE));
    return pages;
  }
  /* For `count` chosen characters: [pages, how many more would fill the last page]. */
  function pageFill(count) {
    if (count <= 0) return [0, 0];
    var pages = Math.ceil(count / PER_PAGE);
    return [pages, pages * PER_PAGE - count];
  }
  /* The three character blocks; `noteH` is the room taken by a teacher's note (0 without one). */
  function blockRects(noteH) {
    noteH = noteH || 0;
    var h = (PAGE_H - 2 * MARGIN - HEADER - noteH) / PER_PAGE;
    var top = MARGIN + HEADER + noteH, out = [];
    for (var i = 0; i < PER_PAGE; i++) out.push({ x: MARGIN, y: top + i * h, w: PAGE_W - 2 * MARGIN, h: h });
    return out;
  }
  /* The grid of one character block, for `strokeCount` strokes:
       rows    — three (red, grey, blank practice), or more when the strokes
                 do not fit in the rows above the blank practice row;
       cell    — the 田字格 size: the rows and their pinyin bands fill the
                 height above the 组词 strip (at most MAX_CELL);
       cols    — as many whole cells as fit next to the left column, so the
                 grid fills the width (10 for three rows);
       band    — the 四线三格 band height above each row;
       leftCol — the left column's width: the minimum plus what the whole
                 cells leave over, so the block is always filled edge to edge.
     More rows make the cells smaller, but also give each row more cells. */
  function blockGrid(block, strokeCount) {
    for (var rows = ROWS_PER_CHAR; ; rows++) {
      var cell = Math.min(MAX_CELL, (block.h - STRIP) / (rows * (1 + PINYIN_BAND_RATIO)));
      var cols = Math.floor((block.w - LEFT_COL_MIN) / cell + 1e-9);
      if (strokeCount <= (rows - 1) * cols) {
        return { rows: rows, cols: cols, cell: cell, band: cell * PINYIN_BAND_RATIO, leftCol: block.w - cols * cell };
      }
    }
  }

  /* ---- stroke outlines: parsing and the exact box around the ink --------- */
  var ARITY = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };
  /* Extreme values of one curve along one axis (p = that axis' coordinates). */
  function quadExtrema(p0, p1, p2) {
    var d = p0 - 2 * p1 + p2, out = [];
    if (d !== 0) { var t = (p0 - p1) / d; if (t > 0 && t < 1) out.push((1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2); }
    return out;
  }
  function cubicExtrema(p0, p1, p2, p3) {
    var a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0, ts = [], out = [];
    if (Math.abs(a) < 1e-12) { if (b !== 0) ts.push(-c / b); }
    else {
      var disc = b * b - 4 * a * c;
      if (disc >= 0) { var s = Math.sqrt(disc); ts.push((-b + s) / (2 * a), (-b - s) / (2 * a)); }
    }
    ts.forEach(function (t) {
      if (t > 0 && t < 1) { var u = 1 - t; out.push(u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3); }
    });
    return out;
  }
  /* The box around all strokes of one character, in the data's own units
     (1024 wide, y pointing up). Curves are measured exactly, not by their
     control points, as the other app does. */
  function inkBox(strokes) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function add(x, y) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    strokes.forEach(function (d) {
      var tokens = d.match(/[MLQCZ]|-?\d+(?:\.\d+)?/g) || [];
      var cmd = null, i = 0, cx = 0, cy = 0;
      while (i < tokens.length) {
        var t = tokens[i];
        if (ARITY[t] !== undefined) { cmd = t; i++; continue; }
        if (cmd === null || cmd === 'Z') throw new Error('bad stroke path: ' + d.slice(0, 40));
        var k = ARITY[cmd], v = tokens.slice(i, i + k).map(Number);
        if (v.length < k) throw new Error('bad stroke path: ' + d.slice(0, 40));
        i += k;
        if (cmd === 'M' || cmd === 'L') { add(v[0], v[1]); cx = v[0]; cy = v[1]; if (cmd === 'M') cmd = 'L'; }
        else if (cmd === 'Q') {
          quadExtrema(cx, v[0], v[2]).forEach(function (x) { add(x, cy); });
          quadExtrema(cy, v[1], v[3]).forEach(function (y) { add(cx, y); });
          add(v[2], v[3]); cx = v[2]; cy = v[3];
        } else if (cmd === 'C') {
          cubicExtrema(cx, v[0], v[2], v[4]).forEach(function (x) { add(x, cy); });
          cubicExtrema(cy, v[1], v[3], v[5]).forEach(function (y) { add(cx, y); });
          add(v[4], v[5]); cx = v[4]; cy = v[5];
        }
      }
    });
    if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  /* Map the data's units into one cell, y flipped to the page. The ink box is
     scaled to `fill` of the cell and its centre is put on the cell's centre.
     Every cell of one character uses the same mapping, so the partial
     strokes line up with the full character. */
  function glyphMatrix(x, y, cell, ink, fill) {
    var size = Math.max(ink.w, ink.h, 1);
    var scale = cell * fill / size;
    var gcx = ink.x + ink.w / 2, gcy = ink.y + ink.h / 2;
    var e = x + cell / 2 - gcx * scale, f = y + cell / 2 + gcy * scale;
    return 'matrix(' + scale.toFixed(6) + ',0,0,' + (-scale).toFixed(6) + ',' + e.toFixed(4) + ',' + f.toFixed(4) + ')';
  }

  /* ---- measuring text ----------------------------------------------------
     Widths and letter boxes come from the real font, measured once at a
     large size and expressed per 1 mm of font size. */
  var metricsCache = null;
  function getMetrics() {
    if (metricsCache) return metricsCache;
    var REF = 400;
    var ctx = root.document.createElement('canvas').getContext('2d');
    ctx.font = REF + 'px ' + FONT_FAMILY;
    var widths = {};
    var han = ctx.measureText('字');
    metricsCache = {
      advance: function (text) {
        var total = 0;
        for (var i = 0; i < text.length; i++) {
          var ch = text[i];
          if (widths[ch] === undefined) widths[ch] = ctx.measureText(ch).width / REF;
          total += widths[ch];
        }
        return total;
      },
      ascent: han.fontBoundingBoxAscent / REF,
      descent: han.fontBoundingBoxDescent / REF,
    };
    return metricsCache;
  }

  /* The pinyin font's x-height and widths, per 1 mm of font size. They are
     kept only once the font has loaded (see ready()); before that the
     browser would measure a stand-in font. */
  var pinyinCache = null;
  function pinyinMetrics() {
    if (pinyinCache) return pinyinCache;
    var REF = 400;
    var ctx = root.document.createElement('canvas').getContext('2d');
    ctx.font = REF + 'px ' + PINYIN_FONT;
    var m = {
      xHeight: ctx.measureText('x').actualBoundingBoxAscent / REF,
      advance: function (text) { return ctx.measureText(text).width / REF; },
    };
    if (root.document.fonts && root.document.fonts.check(REF + 'px "' + PINYIN_FONT_NAME + '"')) pinyinCache = m;
    return m;
  }
  /* Resolves once the pinyin font can be used. Call before buildPages. */
  function ready() {
    var fonts = root.document && root.document.fonts;
    if (!fonts) return Promise.resolve();
    return fonts.load('10px "' + PINYIN_FONT_NAME + '"').then(function () { pinyinCache = null; });
  }

  /* One line of text. `align`: 'left' | 'center' | 'right' inside (x, w);
     vertically the font's line box is centred in (y, h), or put on the
     bottom edge when `bottom` is set. */
  function text(str, r, size, color, align, bottom) {
    var m = getMetrics();
    var baseline = bottom ? r.y + r.h - m.descent * size
                          : r.y + (r.h - (m.ascent + m.descent) * size) / 2 + m.ascent * size;
    var x = r.x, anchor = 'start';
    if (align === 'center') { x = r.x + r.w / 2; anchor = 'middle'; }
    else if (align === 'right') { x = r.x + r.w; anchor = 'end'; }
    return '<text x="' + n(x) + '" y="' + n(baseline) + '" font-size="' + n(size) + '" fill="' + color +
      // No-break spaces: SVG merges ordinary spaces, and the word examples are two spaces apart.
      '" text-anchor="' + anchor + '">' + esc(str).replace(/ /g, '\u00a0') + '</text>';
  }
  /* Shrink the font until the text fits. The text is never cut. */
  function fitSize(str, maxW, start) {
    var m = getMetrics(), size = start;
    while (m.advance(str) * size > maxW && size >= 1.0) size *= 0.95;
    return size;
  }

  /* ---- pinyin --------------------------------------------------------------
     The syllable is written once, at pen position 0 on baseline 0, and then
     placed in every box. The font's own letters are already the school-book
     ones (ɑ, g). Its x-height fills the middle space of the band, and a thin
     outline in the same colour makes the letters a little bolder. */
  function pinyinSizeFor(band) {
    return band / (WRITING_LINES - 1) * PINYIN_X_FILL / pinyinMetrics().xHeight;
  }
  function pinyinGroup(id, pinyin, size, color) {
    return {
      id: id,
      def: '<g id="' + id + '"><text x="0" y="0" font-family=\'' + PINYIN_FONT + '\' font-size="' + n(size) +
        '" fill="' + color + '" stroke="' + color + '" stroke-width="' + n(size * PINYIN_BOLD) +
        '" stroke-linejoin="round">' + esc(pinyin) + '</text></g>',
      width: pinyinMetrics().advance(pinyin) * size,
    };
  }

  /* A 四线三格 band: four lines and `boxes` boxes of width `cell`. `py` is the
     prepared syllable to print in every box, or null for a blank band. */
  function writingBand(x, y, cell, band, boxes, py) {
    var out = [], right = x + boxes * cell, space = band / (WRITING_LINES - 1), i;
    for (i = 0; i < WRITING_LINES; i++) out.push(line(x, y + i * space, right, y + i * space, GRID_RED, LINE));
    for (i = 0; i <= boxes; i++) out.push(line(x + i * cell, y, x + i * cell, y + band, GRID_RED, LINE));
    if (py) {
      // All letters share one baseline: the bottom line of the middle space.
      var baseline = y + 2 * space;
      for (i = 0; i < boxes; i++) {
        out.push('<use href="#' + py.id + '" x="' + n(x + i * cell + cell / 2 - py.width / 2) + '" y="' + n(baseline) + '"/>');
      }
    }
    return out.join('');
  }

  /* ---- one character block ----------------------------------------------- */
  function drawBlock(entry, rect, id) {
    var out = [], defs = [];
    var strokes = entry.strokes || [];
    var count = strokes.length;
    var pinyin = entry.pinyin || '';
    var i;

    // The strokes are written once and reused in every cell. `<id>u3` is
    // strokes 1 to 4 together; `<id>all` is the whole character.
    for (i = 0; i < count; i++) {
      defs.push('<g id="' + id + 'u' + i + '">' + (i ? '<use href="#' + id + 'u' + (i - 1) + '"/>' : '') +
        '<path d="' + esc(strokes[i]) + '"/></g>');
    }
    if (count) defs.push('<g id="' + id + 'all"><use href="#' + id + 'u' + (count - 1) + '"/></g>');
    var ink = count ? inkBox(strokes) : null;
    var g = blockGrid(rect, count);
    var leftCol = g.leftCol, cell = g.cell, cols = g.cols, rows = g.rows, bandH = g.band;

    // One slightly heavier frame round the block: the left column and the grid
    // fill it edge to edge.
    out.push(box(rect, GRID_RED, BLOCK_FRAME));

    // The pinyin, the same size in the left column and over the grid.
    var pyLeft = null, pyGrid = null;
    if (pinyin) {
      // Long syllables (zhuàng, chuáng) are made a little smaller so they stay inside one cell.
      var pySize = Math.min(pinyinSizeFor(bandH), cell * PINYIN_MAX_WIDTH / pinyinMetrics().advance(pinyin));
      pyLeft = pinyinGroup(id + 'pl', pinyin, pySize, PINYIN_LEFT);
      pyGrid = pinyinGroup(id + 'pg', pinyin, pySize, PINYIN_GRID);
      defs.push(pyLeft.def, pyGrid.def);
    }

    /* left column: pinyin band (as tall as the grid's, sharing its lines),
       big character, then 笔画 / 结构 / 部首 */
    var band = { x: rect.x, y: rect.y, w: leftCol, h: bandH };
    var charBox = { x: rect.x, y: band.y + band.h, w: leftCol, h: LEFT_CHAR };
    var infoTop = charBox.y + charBox.h;
    var infoH = (rect.y + rect.h - infoTop) / LEFT_INFO_ROWS;
    out.push(writingBand(band.x, band.y, band.w, band.h, 1, pyLeft));
    out.push(box(charBox, GRID_RED, LINE));
    if (count) {
      var big = Math.min(charBox.w, charBox.h);
      out.push('<use href="#' + id + 'all" fill="' + INK + '" transform="' +
        glyphMatrix(charBox.x + (charBox.w - big) / 2, charBox.y + (charBox.h - big) / 2, big, ink, 0.8) + '"/>');
    } else {
      out.push(text(entry.char, charBox, 22, INK, 'center'));
    }
    var labels = [
      '笔画：' + (count ? count : '—'),
      '结构：' + (entry.structure || '—'),
      '部首：' + (entry.radical || '—'),
    ];
    for (i = 0; i < LEFT_INFO_ROWS; i++) {
      var row = { x: rect.x, y: infoTop + i * infoH, w: leftCol, h: infoH };
      out.push(box(row, GRID_RED, LINE));
      out.push(text(labels[i], { x: row.x + 1.5, y: row.y, w: row.w - 1.5, h: row.h }, 3.4, INK, 'left'));
    }

    /* the grid */
    var gridX = rect.x + leftCol;
    var y = rect.y;
    for (var r = 0; r < rows; r++) {
      // The last row is blank practice: its band is for writing pinyin by hand.
      var tracing = r < rows - 1;
      out.push(writingBand(gridX, y, cell, bandH, cols, tracing ? pyGrid : null));
      y += bandH;
      for (var c = 0; c < cols; c++) {
        var x = gridX + c * cell;
        // one 田字格: a square with a dashed centre cross
        out.push(box({ x: x, y: y, w: cell, h: cell }, GRID_RED, LINE));
        out.push(line(x + cell / 2, y, x + cell / 2, y + cell, GRID_RED_LIGHT, 0.15, '0.6 0.3'));
        out.push(line(x, y + cell / 2, x + cell, y + cell / 2, GRID_RED_LIGHT, 0.15, '0.6 0.3'));
        if (!tracing) continue;
        var cellRect = { x: x, y: y, w: cell, h: cell };
        if (!count) {
          // No stroke data: the whole character in red in every cell.
          out.push(text(entry.char, cellRect, cell * 0.8, RED, 'center'));
          continue;
        }
        var index = r * cols + c;
        var matrix = glyphMatrix(x, y, cell, ink, GLYPH_FILL);
        if (index < count) {
          // strokes 1 .. index+1 in red, with the stroke number
          out.push('<use href="#' + id + 'u' + index + '" fill="' + RED + '" transform="' + matrix + '"/>');
          out.push(text(String(index + 1), cellRect, 2.0, RED, 'right', true));
        } else {
          out.push('<use href="#' + id + 'all" fill="' + GREY + '" fill-opacity="' + n(GREY_OPACITY) + '" transform="' + matrix + '"/>');
        }
      }
      y += cell;
    }

    /* bottom strip, as wide as the grid: 组词 on the left, 造句 on the right */
    var strip = { x: gridX, y: rect.y + rect.h - STRIP, w: cols * cell, h: STRIP };
    out.push(box(strip, GRID_RED, LINE));
    var half = strip.w / 2;
    var wordsText = '组词：' + (entry.words || []).join('  ');
    out.push(text(wordsText, { x: strip.x + 1.5, y: strip.y, w: half - 2, h: strip.h }, fitSize(wordsText, half - 2, 3.4), INK, 'left'));
    var label = '造句：', labelW = getMetrics().advance(label) * 3.4;
    out.push(text(label, { x: strip.x + half, y: strip.y, w: labelW, h: strip.h }, 3.4, INK, 'left'));
    out.push(line(strip.x + half + labelW + 0.3, strip.y + strip.h - 1.5, strip.x + strip.w, strip.y + strip.h - 1.5, INK, 0.25));

    return { defs: defs.join(''), body: out.join('') };
  }

  /* 日期 and 姓名: blank fields with an underline, filled in by hand. */
  function drawHeader() {
    var head = { x: MARGIN, y: MARGIN, w: PAGE_W - 2 * MARGIN, h: HEADER };
    var baseY = head.y + head.h - 3, out = [];
    [['日期：', head.x], ['姓名：', head.x + 90]].forEach(function (f) {
      var labelW = getMetrics().advance(f[0]) * 4.5;
      out.push(text(f[0], { x: f[1], y: head.y, w: labelW, h: head.h }, 4.5, INK, 'left'));
      out.push(line(f[1] + labelW + 0.3, baseY, f[1] + labelW + 0.3 + 60, baseY, INK, 0.25));
    });
    return out.join('');
  }

  /* The teacher's note: one line, made a little smaller if needed, or else
     broken into two lines; text that still does not fit ends with "…". */
  function layoutNote(textIn) {
    var str = textIn.replace(/\s+/g, ' ').trim();
    if (!str) return null;
    var m = getMetrics(), maxW = PAGE_W - 2 * MARGIN;
    var size = NOTE_SIZE;
    while (m.advance(str) * size > maxW && size > NOTE_MIN_SIZE) size = Math.max(NOTE_MIN_SIZE, size * 0.95);
    var lines = [], cur = '';
    Array.from(str).forEach(function (ch) {
      if (m.advance(cur + ch) * size > maxW && cur) { lines.push(cur); cur = ch.trim() ? ch : ''; }
      else cur += ch;
    });
    if (cur) lines.push(cur);
    if (lines.length > NOTE_MAX_LINES) {
      lines = lines.slice(0, NOTE_MAX_LINES);
      var last = lines[NOTE_MAX_LINES - 1];
      while (last && m.advance(last + '…') * size > maxW) last = last.slice(0, -1);
      lines[NOTE_MAX_LINES - 1] = last + '…';
    }
    return { lines: lines, size: size, height: lines.length * NOTE_LINE + 1 };
  }
  function drawNote(note) {
    return note.lines.map(function (l, i) {
      return text(l, { x: MARGIN, y: MARGIN + HEADER + i * NOTE_LINE, w: PAGE_W - 2 * MARGIN, h: NOTE_LINE }, note.size, INK, 'left');
    }).join('');
  }

  function pageNumberText(pageNo, total) { return pageNo + ' / ' + total; }

  /* The page number, e.g. "1 / 3", centred in the bottom margin under the
     last block (layout.py footer_rect and page_number_text). */
  function drawPageNumber(pageNo, total) {
    return text(pageNumberText(pageNo, total), { x: MARGIN, y: PAGE_H - MARGIN, w: PAGE_W - 2 * MARGIN, h: MARGIN }, 3.4, INK, 'center');
  }

  /* A heading line centred in the top margin, above 日期 / 姓名, ending with
     the page number, e.g. "二年级 第二单元 第一周   1 / 5". The text sits in
     the lower part of the margin, clear of the paper's unprintable edge. */
  function drawHeading(heading, pageNo, total) {
    var line = (heading ? heading + '   ' : '') + pageNumberText(pageNo, total);
    return text(line, { x: MARGIN, y: 3, w: PAGE_W - 2 * MARGIN, h: MARGIN - 3 }, 4.0, INK, 'center');
  }

  var renderCount = 0;
  /* One page (up to three entries) as a complete SVG picture. With a
     heading (even an empty one) the page number goes into the heading line
     at the top; without one it is printed at the bottom. */
  function drawPage(entries, pageNo, total, heading, note) {
    var key = 'ts' + (++renderCount) + 'b';
    var rects = blockRects(note ? note.height : 0), defs = [], body = [drawHeader()];
    if (note) body.push(drawNote(note));
    entries.forEach(function (entry, i) {
      var b = drawBlock(entry, rects[i], key + i);
      defs.push(b.defs);
      body.push(b.body);
    });
    body.push(heading === undefined || heading === null ? drawPageNumber(pageNo, total) : drawHeading(heading, pageNo, total));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + PAGE_W + ' ' + PAGE_H + '" width="' + PAGE_W +
      'mm" height="' + PAGE_H + 'mm" font-family=\'' + FONT_FAMILY + '\'>' +
      '<rect width="' + PAGE_W + '" height="' + PAGE_H + '" fill="#fff"/>' +
      '<defs>' + defs.join('') + '</defs>' + body.join('') + '</svg>';
  }

  /* All pages for a list of entries, three per page, plus notes about
     anything that was missing and so left blank. `options.heading`, when
     given, is printed at the top of every page with the page number. */
  function buildPages(entries, options) {
    var heading = options ? options.heading : undefined;
    var note = options && options.note ? layoutNote(String(options.note)) : null;
    var notes = [];
    entries.forEach(function (e) {
      var missing = [];
      if (!e.strokes || !e.strokes.length) missing.push('笔顺');
      if (!e.pinyin) missing.push('拼音');
      if (missing.length) notes.push('「' + e.char + '」缺少：' + missing.join('、') + '（对应处留空）');
    });
    var chunks = chunkPages(entries);
    return {
      pages: chunks.map(function (page, i) { return drawPage(page, i + 1, chunks.length, heading, note); }),
      notes: notes,
    };
  }

  root.TracingSheet = {
    PAGE_W: PAGE_W, PAGE_H: PAGE_H, PER_PAGE: PER_PAGE,
    buildPages: buildPages,
    pageFill: pageFill,
    ready: ready,
    // exposed so the geometry can be checked on its own
    blockGrid: function (strokeCount) { return blockGrid(blockRects()[0], strokeCount); },
    inkBox: inkBox,
  };
})(typeof window !== 'undefined' ? window : globalThis);
