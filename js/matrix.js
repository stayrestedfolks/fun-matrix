// The 2×2 matrix. layout() is pure geometry (shared with the PNG export); renderMatrix() draws it as SVG
// at the container's real pixel size, so text stays readable from a phone up to a 1080p recording.
const NS = "http://www.w3.org/2000/svg";
export const ICON_BASE = "https://render.worldofwarcraft.com/us/icons/56/";

// Ratings are 1–5 and sit in the centre of five cells, so a 3 lands on the dividing line ("on the fence").
export function layout(w, h, { compact = w < 520, font: fontSize } = {}) {
  const font = fontSize || Math.max(12, Math.min(16, Math.round(Math.min(w / 62, h / 26))));
  const pad = { left: font * 2.6, right: 6, top: 6, bottom: font * 2.3 };
  const plot = { x: pad.left, y: pad.top, w: w - pad.left - pad.right, h: h - pad.top - pad.bottom };
  const cellW = plot.w / 5, cellH = plot.h / 5;
  const r = Math.max(13, Math.min(24, Math.min(cellW, cellH) * 0.34));
  return {
    w, h, font, plot, r, compact, cellW, cellH,
    cx: (v) => plot.x + (v - 0.5) * cellW,
    cy: (v) => plot.y + plot.h - (v - 0.5) * cellH,
    midX: plot.x + plot.w / 2, midY: plot.y + plot.h / 2,
  };
}

// Dots that share a cell fan out sideways so none hide; returns [{item, x, y, labelBelow}].
export function placeDots(items, g) {
  const cells = new Map();
  for (const it of items) {
    const key = `${it.x},${it.y}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(it);
  }
  const out = [];
  for (const group of cells.values()) {
    group.forEach((it, i) => {
      const step = Math.min(g.r * 2.15, (g.cellW * 0.9) / Math.max(1, group.length - 1));
      const off = (i - (group.length - 1) / 2) * step;
      const below = it.y > 1 ? i % 2 === 0 : false;   // bottom row labels go above, so they never hit the axis
      out.push({ item: it, x: g.cx(it.x) + off, y: g.cy(it.y), labelBelow: below });
    });
  }
  return out;
}

// Rough text widths, good enough to decide what fits: Cinzel capitals run wide, Alegreya Sans narrow.
export const textWidth = (text, size, kind = "body") => text.length * size * (kind === "caps" ? 0.8 : 0.5);

function el(name, attrs = {}, text) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === "font-size") n.style.fontSize = `${v}px`;   // inline style, so stylesheet rules can't override it
    else n.setAttribute(k, v);
  }
  if (text !== undefined) n.textContent = text;
  return n;
}

/**
 * @param {SVGSVGElement} svg
 * @param {{axes:{x:{name:string,lo:string,hi:string},y:{name:string,lo:string,hi:string}},
 *          quadrants:{tr:string,tl:string,br:string,bl:string},
 *          items:{id:string,label:string,short?:string,icon?:string,x:number,y:number,score:number}[],
 *          topIds?:Set<string>, activeId?:string, chosenId?:string, landIds?:Set<string>, ghost?:string,
 *          onPick?:(id:string)=>void, onHover?:(id:string|null)=>void}} m
 */
export function renderMatrix(svg, m) {
  const w = Math.max(200, svg.clientWidth || svg.parentNode.clientWidth);
  const h = Math.max(160, svg.clientHeight || svg.parentNode.clientHeight);
  const g = layout(w, h);
  const { plot, font } = g;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.replaceChildren();
  const uid = svg.id || "mx";

  const defs = el("defs");
  const clip = el("clipPath", { id: `${uid}-clip` });
  clip.append(el("circle", { r: g.r - 2.5 }));
  defs.append(clip);
  svg.append(defs);

  // Paper, the hopeful top-right quadrant, the grid, the dashed centre lines.
  svg.append(el("rect", { class: "mx-bg", x: plot.x, y: plot.y, width: plot.w, height: plot.h, rx: 6 }));
  svg.append(el("rect", { class: "mx-q tr", x: g.midX, y: plot.y, width: plot.w / 2, height: plot.h / 2 }));
  for (let i = 1; i < 5; i++) {
    svg.append(el("line", { class: "mx-grid", x1: plot.x + (plot.w / 5) * i, x2: plot.x + (plot.w / 5) * i, y1: plot.y, y2: plot.y + plot.h }));
    svg.append(el("line", { class: "mx-grid", y1: plot.y + (plot.h / 5) * i, y2: plot.y + (plot.h / 5) * i, x1: plot.x, x2: plot.x + plot.w }));
  }
  svg.append(el("line", { class: "mx-mid", x1: g.midX, x2: g.midX, y1: plot.y, y2: plot.y + plot.h }));
  svg.append(el("line", { class: "mx-mid", y1: g.midY, y2: g.midY, x1: plot.x, x2: plot.x + plot.w }));
  svg.append(el("rect", { class: "mx-frame", x: plot.x, y: plot.y, width: plot.w, height: plot.h, rx: 6 }));

  // Quadrant names: big, faint, centred in each quarter, behind the dots.
  const qx = { l: plot.x + plot.w / 4, r: plot.x + (plot.w * 3) / 4 };
  const qy = { t: plot.y + plot.h / 4, b: plot.y + (plot.h * 3) / 4 };
  for (const [k, x, y] of [["tl", qx.l, qy.t], ["tr", qx.r, qy.t], ["bl", qx.l, qy.b], ["br", qx.r, qy.b]]) {
    const label = m.quadrants[k].toUpperCase();
    // Shrink to fit its quarter; hide it rather than let it spill into the next one.
    const qsize = Math.min(font * (g.compact ? 1.05 : 1.35), (plot.w / 2 - 10) / (label.length * 0.8));
    if (qsize >= 8) svg.append(el("text", { class: `mx-qlabel ${k}`, x, y, "text-anchor": "middle", "dominant-baseline": "middle", "font-size": qsize.toFixed(1) }, label));
  }

  // Axes: names in the middle, the two ends at the corners.
  const ax = m.axes;
  const by = plot.y + plot.h + font * 1.45;
  svg.append(el("text", { class: "mx-end", x: plot.x, y: by, "font-size": font }, ax.x.lo));
  const xName = `${ax.x.name.toUpperCase()} →`, yName = `${ax.y.name.toUpperCase()} →`;
  // The axis name sits between the two ends; drop it when the ends need the room.
  const fits = (lo, hi, name, len) => textWidth(lo, font) + textWidth(hi, font) + textWidth(name, font * 0.9, "caps") + 24 <= len;
  if (fits(ax.x.lo, ax.x.hi, xName, plot.w)) svg.append(el("text", { class: "mx-axis", x: g.midX, y: by, "text-anchor": "middle", "font-size": font * 0.9 }, xName));
  svg.append(el("text", { class: "mx-end hi", x: plot.x + plot.w, y: by, "text-anchor": "end", "font-size": font }, ax.x.hi));
  const lx = font * 1.15;
  svg.append(el("text", { class: "mx-end", transform: `translate(${lx} ${plot.y + plot.h}) rotate(-90)`, "font-size": font }, ax.y.lo));
  if (fits(ax.y.lo, ax.y.hi, yName, plot.h)) svg.append(el("text", { class: "mx-axis", transform: `translate(${lx} ${g.midY}) rotate(-90)`, "text-anchor": "middle", "font-size": font * 0.9 }, yName));
  svg.append(el("text", { class: "mx-end hi", transform: `translate(${lx} ${plot.y}) rotate(-90)`, "text-anchor": "end", "font-size": font }, ax.y.hi));

  if (!m.items.length && m.ghost) {
    svg.append(el("text", { class: "mx-ghost", x: g.midX, y: g.midY - font * 1.6, "text-anchor": "middle", "font-size": font * 1.1 }, m.ghost));
  }

  // Dots: the top score and the active item draw last so they sit on top.
  const placed = placeDots(m.items, g);
  const rank = (p) => (p.item.id === m.activeId ? 2 : 0) + (m.topIds?.has(p.item.id) ? 1 : 0);
  placed.sort((a, b) => rank(a) - rank(b));
  for (const p of placed) {
    const it = p.item;
    const top = m.topIds?.has(it.id), active = it.id === m.activeId, chosen = it.id === m.chosenId;
    const cls = ["dot", top && "top", active && "active", chosen && "chosen"].filter(Boolean).join(" ");
    const outer = el("g", { class: cls, transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`, tabindex: 0, role: "button",
      "aria-label": `${it.label}: ${it.x} and ${it.y}, score ${it.score}`, "data-id": it.id });
    const inner = el("g", { class: m.landIds?.has(it.id) ? "land" : "" });
    if (top || chosen) inner.append(el("circle", { class: "glow", r: g.r + 6 }));
    inner.append(el("circle", { class: "ring", r: g.r }));
    if (it.icon) {
      const img = el("image", { href: ICON_BASE + it.icon + ".jpg", x: -(g.r - 2.5), y: -(g.r - 2.5), width: (g.r - 2.5) * 2, height: (g.r - 2.5) * 2, "clip-path": `url(#${uid}-clip)`, preserveAspectRatio: "xMidYMid slice" });
      inner.append(img);
    } else {
      inner.append(el("text", { class: "score", "text-anchor": "middle", "dominant-baseline": "central", "font-size": g.r * 0.8 }, it.label[0]));
    }
    const br = Math.max(8, g.r * 0.46);
    inner.append(el("circle", { class: "badge", cx: g.r * 0.82, cy: -g.r * 0.78, r: br }));
    inner.append(el("text", { class: "score", x: g.r * 0.82, y: -g.r * 0.78, "text-anchor": "middle", "dominant-baseline": "central", "font-size": br * 1.05 }, it.score));
    if (!g.compact || top || active || chosen) {
      const ly = p.labelBelow ? g.r + font * 1.05 : -g.r - font * 0.55;
      inner.append(el("text", { class: "label", y: ly, "text-anchor": "middle", "font-size": font * 0.95 }, g.compact ? (it.short || it.label) : it.label));
    }
    outer.append(inner);
    if (m.onPick) {
      outer.addEventListener("click", () => m.onPick(it.id));
      outer.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); m.onPick(it.id); } });
    }
    if (m.onHover) {
      outer.addEventListener("pointerenter", () => m.onHover(it.id));
      outer.addEventListener("pointerleave", () => m.onHover(null));
    }
    svg.append(outer);
  }
  return g;
}
