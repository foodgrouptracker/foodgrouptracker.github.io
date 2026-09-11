/* Food Group Tracker — printable sheets.
   Renders the four paper layouts from a configured plan, entirely in the browser.
   Works in Node too (for tests): pass the jsPDF constructor in.

   view = {
     rows: [{id,label,unit,swap,solid,dashed}],   // rows with 0 boxes already removed
     kcalText: "2,000 calories",                  // badge
     legend: "…" | null,                          // shown when dashed boxes exist
     notes: "…" | "",
     interchange: true|false,
     planLabel: "Standard"                        // for file names
   }
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FGTSheets = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const C = {
    accent: [47, 125, 109], accentDeep: [34, 89, 78], tint: [228, 239, 235], rowTint: [243, 247, 245],
    text: [43, 47, 51], muted: [107, 115, 120], line: [197, 206, 202], box: [85, 98, 94], faint: [213, 219, 216], white: [255, 255, 255],
  };
  const M = 32;
  const TAGLINE = "Track food groups, not calories.  Check one box for each serving you eat — use your food lists for serving sizes.  Aim to complete every row by the end of the day.";
  const FOOT_R = "Serving sizes: Choose Your Foods — Food Lists for Weight Management (ADA / AND)";
  const FOOT_L = "* Starch, Fruit, and Milk/Yogurt servings may be interchanged with one another.";
  const DASH = [2.2, 1.6];

  // ---- primitives --------------------------------------------------------
  const fill = (d, c) => d.setFillColor(c[0], c[1], c[2]);
  const stroke = (d, c) => d.setDrawColor(c[0], c[1], c[2]);
  const ink = (d, c) => d.setTextColor(c[0], c[1], c[2]);
  function text(d, x, y, s, { size = 8, bold = false, italic = false, color = C.text, align = "left" } = {}) {
    d.setFont("helvetica", bold ? "bold" : italic ? "italic" : "normal");
    d.setFontSize(size);
    ink(d, color);
    d.text(String(s), x, y, { align });
  }
  const tw = (d, s, size, bold) => {
    d.setFont("helvetica", bold ? "bold" : "normal");
    d.setFontSize(size);
    return d.getTextWidth(String(s));
  };
  const vc = (yc, size) => yc + size * 0.35; // baseline for vertically centred text

  function boxes(d, x, yc, n, size, gap, dashedFrom = null) {
    for (let i = 0; i < n; i++) {
      const bx = x + i * (size + gap);
      const dashed = dashedFrom !== null && i >= dashedFrom;
      d.setLineWidth(0.8);
      fill(d, C.white);
      stroke(d, dashed ? C.accent : C.box);
      d.setLineDashPattern(dashed ? DASH : [], 0);
      d.roundedRect(bx, yc - size / 2, size, size, 1.6, 1.6, "FD");
    }
    d.setLineDashPattern([], 0);
  }

  function header(d, pw, title, subtitle, view) {
    const top = M;
    text(d, M, top + 17, title, { size: 19, bold: true, color: C.accentDeep });
    text(d, M, top + 30, subtitle, { size: 8.5, color: C.muted });
    const bw = tw(d, view.kcalText, 8.5, true) + 26;
    fill(d, C.accent);
    d.roundedRect(pw - M - bw, top + 2, bw, 20, 10, 10, "F");
    text(d, pw - M - bw / 2, top + 15.5, view.kcalText, { size: 8.5, bold: true, color: C.white, align: "center" });
    text(d, M, top + 47, TAGLINE, { size: 7.6 });
    if (view.legend) {
      boxes(d, M + 1, top + 55.5, 1, 8, 0, 0);
      text(d, M + 13, top + 58.3, view.legend, { size: 7.6 });
    } else {
      const y = top + 58.3;
      stroke(d, C.box);
      d.setLineWidth(0.5);
      text(d, M, y, "Client", { size: 7.6, bold: true, color: C.muted });
      d.line(M + 30, y + 1.5, M + 210, y + 1.5);
      text(d, M + 228, y, "Start date", { size: 7.6, bold: true, color: C.muted });
      d.line(M + 272, y + 1.5, M + 380, y + 1.5);
    }
    let ruleY = top + 66;
    if (view.notes) {
      text(d, M, ruleY + 8, "Notes: " + view.notes, { size: 7.4, color: C.muted });
      ruleY += 12;
    }
    stroke(d, C.line);
    d.setLineWidth(0.6);
    d.line(M, ruleY, pw - M, ruleY);
    return ruleY;
  }

  function footer(d, pw, ph, view) {
    stroke(d, C.line);
    d.setLineWidth(0.6);
    d.line(M, ph - M - 16, pw - M, ph - M - 16);
    if (view.interchange) text(d, M, ph - M - 5, FOOT_L, { size: 6.8, color: C.muted });
    text(d, pw - M, ph - M - 5, FOOT_R, { size: 6.8, italic: true, color: C.muted, align: "right" });
  }

  function cardFrame(d, x, ytop, w, h, bandH, title, rightLabel) {
    fill(d, C.white);
    d.roundedRect(x, ytop, w, h, 4, 4, "F");
    fill(d, C.tint);
    d.roundedRect(x, ytop, w, bandH, 4, 4, "F");
    d.rect(x, ytop + bandH - 4, w, 4, "F");
    fill(d, C.accent);
    d.rect(x, ytop, 3, bandH, "F");
    const ts = bandH * 0.5;
    text(d, x + 9, vc(ytop + bandH / 2, ts), title, { size: ts, bold: true, color: C.accentDeep });
    if (rightLabel) text(d, x + w - 8, vc(ytop + bandH / 2, bandH * 0.38), rightLabel, { size: bandH * 0.38, color: C.muted, align: "right" });
    return ytop + bandH;
  }
  function cardOutline(d, x, ytop, w, h) {
    stroke(d, C.line);
    d.setLineWidth(0.75);
    d.roundedRect(x, ytop, w, h, 4, 4, "S");
  }
  const rowLabel = (r) => r.label + (r.unit ? ` (${r.unit})` : "") + (r.swap ? "*" : "");
  const maxBoxes = (view) => Math.max(1, ...view.rows.map((r) => r.solid + r.dashed));

  // rows inside a card; tint width can be limited (for the notes panel)
  function groupRows(d, x, ytop, w, rowH, labelSize, labelW, box, gap, view, tintW) {
    view.rows.forEach((r, i) => {
      const ry = ytop + i * rowH;
      const yc = ry + rowH / 2;
      if (i % 2 === 1) {
        fill(d, C.rowTint);
        d.rect(x + 0.5, ry, (tintW || w) - 1, rowH, "F");
      }
      text(d, x + 9, vc(yc, labelSize), rowLabel(r), { size: labelSize });
      boxes(d, x + labelW, yc, r.solid + r.dashed, box, gap, r.dashed ? r.solid : null);
    });
    return ytop + view.rows.length * rowH;
  }

  function notesPanel(d, x, ytop, w, h, title, lines) {
    stroke(d, C.line);
    d.setLineWidth(0.6);
    d.line(x, ytop, x, ytop + h);
    text(d, x + 10, ytop + 11, title, { size: 7.2, bold: true, color: C.muted });
    stroke(d, C.faint);
    d.setLineWidth(0.5);
    const step = (h - 20) / lines;
    for (let k = 1; k <= lines; k++) d.line(x + 10, ytop + 14 + k * step - 2, x + w - 10, ytop + 14 + k * step - 2);
  }

  // ---- Version 0: original layout, divided cells, 10 days / 1 page --------
  function build0(J, view) {
    const d = new J({ unit: "pt", format: "letter" });
    const pw = 612, ph = 792;
    const ruleY = header(d, pw, "Food Group Tracker", "10-day tracking sheet  ·  original layout", view);
    const gridTop = ruleY + 12, gridBot = ph - M - 26, gutter = 14, vgap = 9;
    const cw = (pw - 2 * M - gutter) / 2, ch = (gridBot - gridTop - 4 * vgap) / 5, band = 17, rowH = (ch - band) / 7, labelW = 100;
    const short = view.kcalText.split("·")[0].trim();
    for (let day = 0; day < 10; day++) {
      const x = M + (day % 2) * (cw + gutter), yt = gridTop + Math.floor(day / 2) * (ch + vgap);
      const yb = cardFrame(d, x, yt, cw, ch, band, `DAY ${day + 1}`, short);
      view.rows.forEach((r, i) => {
        const ry = yb + i * rowH, yc = ry + rowH / 2, n = r.solid + r.dashed;
        if (i % 2 === 1) { fill(d, C.rowTint); d.rect(x + 0.5, ry, cw - 1, rowH, "F"); }
        text(d, x + 9, vc(yc, 7.1), rowLabel(r), { size: 7.1 });
        stroke(d, C.faint); d.setLineWidth(0.5); d.line(x + 0.5, ry + rowH, x + cw - 0.5, ry + rowH);
        const cx0 = x + labelW, cellW = (x + cw - 0.5 - cx0) / n;
        d.setLineWidth(0.6);
        for (let k = 0; k <= n; k++) {
          const dashed = r.dashed && k > r.solid; // dividers inside the dashed region
          stroke(d, dashed ? C.accent : C.box);
          d.setLineDashPattern(dashed ? DASH : [], 0);
          d.line(cx0 + k * cellW, ry, cx0 + k * cellW, ry + rowH);
        }
        d.setLineDashPattern([], 0);
      });
      cardOutline(d, x, yt, cw, ch);
    }
    footer(d, pw, ph, view);
    return d;
  }

  // ---- Version A: 10 days / 1 page, uniform boxes ---------------------------
  function buildA(J, view) {
    const d = new J({ unit: "pt", format: "letter" });
    const pw = 612, ph = 792;
    const ruleY = header(d, pw, "Food Group Tracker", "10-day tracking sheet", view);
    const gridTop = ruleY + 12, gridBot = ph - M - 26, gutter = 14, vgap = 9;
    const cw = (pw - 2 * M - gutter) / 2, ch = (gridBot - gridTop - 4 * vgap) / 5, band = 17, rowH = (ch - band) / 7;
    const labelW = 96, gap = 3.2, n = maxBoxes(view);
    const box = Math.max(6, Math.min(rowH - 3.6, 12, (cw - labelW - 10 - (n - 1) * gap) / n));
    for (let day = 0; day < 10; day++) {
      const x = M + (day % 2) * (cw + gutter), yt = gridTop + Math.floor(day / 2) * (ch + vgap);
      const yb = cardFrame(d, x, yt, cw, ch, band, `DAY ${day + 1}`, "Date ____________");
      groupRows(d, x, yb, cw, rowH, 7.1, labelW, box, gap, view);
      cardOutline(d, x, yt, cw, ch);
    }
    footer(d, pw, ph, view);
    return d;
  }

  // ---- Version B: 7 days / 2 pages, notes panel, week in review -------------
  function buildB(J, view) {
    const d = new J({ unit: "pt", format: "letter" });
    const pw = 612, ph = 792, perPage = 4;
    for (let page = 0; page < 2; page++) {
      if (page) d.addPage();
      const ruleY = header(d, pw, "Food Group Tracker", `7-day tracking packet  ·  Page ${page + 1} of 2`, view);
      const gridTop = ruleY + 12, gridBot = ph - M - 26, vgap = 12, cw = pw - 2 * M;
      const ch = (gridBot - gridTop - (perPage - 1) * vgap) / perPage, band = 21, rowH = (ch - band) / 7;
      const labelW = 122, gap = 4.6, n = maxBoxes(view);
      const box = Math.max(8, Math.min(14, rowH - 4, (cw * 0.55 - labelW - (n - 1) * gap) / n));
      const splitX = M + labelW + n * box + (n - 1) * gap + 22;
      for (let slot = 0; slot < perPage; slot++) {
        const day = page * perPage + slot, yt = gridTop + slot * (ch + vgap);
        if (day < 7) {
          const yb = cardFrame(d, M, yt, cw, ch, band, `DAY ${day + 1}`, "Date ________________");
          groupRows(d, M, yb, cw, rowH, 8.6, labelW, box, gap, view, splitX - M);
          notesPanel(d, splitX, yb + 2, M + cw - splitX, ch - band - 4, "Meals / notes", 6);
          cardOutline(d, M, yt, cw, ch);
        } else {
          const yb = cardFrame(d, M, yt, cw, ch, band, "WEEK IN REVIEW", null);
          const it = yb + 14;
          text(d, M + 9, it, "Days with every row completed", { size: 8.6, bold: true });
          const by = it + 24;
          for (let k = 0; k < 7; k++) {
            boxes(d, M + 9 + k * 26, by, 1, 18, 0);
            text(d, M + 9 + k * 26 + 9, by + 16, String(k + 1), { size: 6.8, color: C.muted, align: "center" });
          }
          text(d, M + 9, by + 34, "Most consistent row", { size: 8.6, bold: true });
          stroke(d, C.faint); d.setLineWidth(0.5); d.line(M + 9, by + 50, splitX - 22, by + 50);
          text(d, M + 9, by + 62, "Hardest row to complete", { size: 8.6, bold: true });
          d.line(M + 9, by + 78, splitX - 22, by + 78);
          notesPanel(d, splitX, yb + 2, M + cw - splitX, ch - band - 4, "What worked  ·  What to adjust  ·  Questions for next visit", 6);
          cardOutline(d, M, yt, cw, ch);
        }
      }
      footer(d, pw, ph, view);
    }
    return d;
  }

  // ---- Version C: 10-day dashboard, landscape --------------------------------
  function buildC(J, view) {
    const d = new J({ unit: "pt", format: "letter", orientation: "landscape" });
    const pw = 792, ph = 612, ndays = 10;
    const ruleY = header(d, pw, "Food Group Tracker", "10-day dashboard  ·  one row per food group, one column per day", view);
    const tabTop = ruleY + 12, tabBot = ph - M - 26, x0 = M, tw_ = pw - 2 * M, labelW = 112;
    const dw = (tw_ - labelW) / ndays, hdrH = 32, doneH = 26;
    const grow = (tabBot - tabTop - hdrH - doneH) / 7; // sized for seven rows, always
    fill(d, C.tint);
    d.roundedRect(x0, tabTop, tw_, hdrH, 4, 4, "F");
    d.rect(x0, tabTop + hdrH - 4, tw_, 4, "F");
    text(d, x0 + 9, vc(tabTop + hdrH / 2, 8), "FOOD GROUP", { size: 8, bold: true, color: C.accentDeep });
    for (let k = 0; k < ndays; k++) {
      const cx = x0 + labelW + k * dw + dw / 2;
      text(d, cx, tabTop + 12, `DAY ${k + 1}`, { size: 8.2, bold: true, color: C.accentDeep, align: "center" });
      stroke(d, C.box); d.setLineWidth(0.5); d.line(cx - 20, tabTop + 25, cx + 20, tabTop + 25);
    }
    const gap = 2.6;
    view.rows.forEach((r, i) => {
      const n = r.solid + r.dashed, ryTop = tabTop + hdrH + i * grow, yc = ryTop + grow / 2;
      if (i % 2 === 1) { fill(d, C.rowTint); d.rect(x0, ryTop, tw_, grow, "F"); }
      text(d, x0 + 9, yc - 1.5, r.label + (r.unit ? ` (${r.unit})` : "") + (r.swap ? "*" : ""), { size: 8.2, bold: true });
      const unit = r.unit ? "cups" : "servings";
      text(d, x0 + 9, yc + 8.5, `${r.solid} ${unit}` + (r.dashed ? `  ·  +${r.dashed} ${view.dashedName || ""}`.trimEnd() : ""), { size: 6.8, color: C.muted });
      const perRow = n <= 3 ? n : n <= 8 ? 4 : 5, rowsN = Math.ceil(n / perRow);
      const box = Math.max(5, Math.min(11, (dw - 8 - (perRow - 1) * gap) / perRow, (grow - 6 - (rowsN - 1) * (gap + 1)) / rowsN));
      const blkW = perRow * box + (perRow - 1) * gap, blkH = rowsN * box + (rowsN - 1) * (gap + 1);
      for (let day = 0; day < ndays; day++) {
        const bx = x0 + labelW + day * dw + (dw - blkW) / 2;
        for (let rr = 0; rr < rowsN; rr++) {
          const first = rr * perRow, cnt = Math.min(perRow, n - first);
          const byc = yc - blkH / 2 + box / 2 + rr * (box + gap + 1);
          const df = r.dashed && first + cnt > r.solid ? Math.max(0, r.solid - first) : null;
          boxes(d, bx, byc, cnt, box, gap, df);
        }
      }
    });
    const ryTop = tabTop + hdrH + 7 * grow, ry = ryTop + doneH;
    stroke(d, C.accent); d.setLineWidth(0.8); d.line(x0, ryTop, x0 + tw_, ryTop);
    text(d, x0 + 9, vc(ryTop + doneH / 2, 8), "All rows complete", { size: 8, bold: true, color: C.accentDeep });
    for (let k = 0; k < ndays; k++) boxes(d, x0 + labelW + k * dw + dw / 2 - 7, ryTop + doneH / 2, 1, 14, 0);
    stroke(d, C.faint); d.setLineWidth(0.5);
    for (let k = 0; k <= ndays; k++) d.line(x0 + labelW + k * dw, tabTop + hdrH, x0 + labelW + k * dw, ry);
    stroke(d, C.line); d.setLineWidth(0.75); d.roundedRect(x0, tabTop, tw_, ry - tabTop, 4, 4, "S");
    footer(d, pw, ph, view);
    return d;
  }

  const LAYOUTS = {
    original: { name: "Original layout (10 days, 1 page)", build: build0 },
    a: { name: "10 days on 1 page", build: buildA },
    b: { name: "7-day packet (2 pages)", build: buildB },
    c: { name: "10-day dashboard (landscape)", build: buildC },
  };

  function build(J, layout, view) {
    return LAYOUTS[layout].build(J, view);
  }
  function fileName(layout, view) {
    const clean = (s) => String(s).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `Food-Group-Tracker_${clean(LAYOUTS[layout].name.split("(")[0])}_${clean(view.planLabel)}.pdf`;
  }
  return { build, fileName, LAYOUTS };
});
