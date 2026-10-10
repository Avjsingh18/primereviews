import QRCode from "qrcode";
import sharp from "sharp";
import { parse, type Font } from "opentype.js";
import poppins500 from "./fonts/poppins-500";
import poppins600 from "./fonts/poppins-600";
import poppins700 from "./fonts/poppins-700";
import { QR_STUDIO_DESIGN_COUNT, derivePhotoPalette, QR_STUDIO_MAX_TAGLINE_LENGTH, cleanDisplayText, qrStudioThemes, type QrStudioCategory } from "./qr-studio";

// Card text is converted to vector paths from a bundled font, so rendering never depends on fonts installed on the server.
const WIDTH = 1200;
const HEIGHT = 1620;
type Weight = 500 | 600 | 700;
const fontData: Record<Weight, string> = { 500: poppins500, 600: poppins600, 700: poppins700 };
const fonts = new Map<Weight, Font>();
function loadFont(weight: Weight) {
  let font = fonts.get(weight);
  if (!font) {
    const bytes = Buffer.from(fontData[weight], "base64");
    font = parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    fonts.set(weight, font);
  }
  return font;
}
export function printable(text: string, weight: Weight = 600) {
  const font = loadFont(weight);
  return [...text].filter((character) => font.charToGlyphIndex(character) > 0).join("");
}
// opentype.js toPathData can emit NaN for some coordinates, so path commands are serialised here.
function pathData(path: { commands: Array<{ type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }> }) {
  const n = (value: number | undefined) => (Math.round((value ?? 0) * 10) / 10).toString();
  return path.commands.map((c) => c.type === "Z" ? "Z" : c.type === "Q" ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}` : c.type === "C" ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : `${c.type}${n(c.x)} ${n(c.y)}`).join("");
}
function textWidth(text: string, weight: Weight, size: number, spacing = 0) {
  const font = loadFont(weight);
  return font.getAdvanceWidth(text, size, { kerning: false }) + spacing * Math.max(0, [...text].length - 1);
}
function textPath(text: string, weight: Weight, size: number, centre: number, baseline: number, fill: string, spacing = 0) {
  const font = loadFont(weight);
  const start = centre - textWidth(text, weight, size, spacing) / 2;
  let x = start; let data = "";
  // Glyph by glyph, without kerning, so spacing is predictable.
  for (const character of text) { data += pathData(font.getPath(character, x, baseline, size, { kerning: false })); x += font.getAdvanceWidth(character, size, { kerning: false }) + spacing; }
  if (/NaN/.test(data)) throw new Error(`Card text could not be rendered: ${text} w${weight} s${size} c${centre} b${baseline} sp${spacing} start${start}`);
  return `<path d="${data}" fill="${fill}"/>`;
}
function wrap(text: string, weight: Weight, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const current = lines[lines.length - 1];
    if (current !== undefined && textWidth(`${current} ${word}`, weight, size) <= maxWidth) lines[lines.length - 1] = `${current} ${word}`; else lines.push(word);
  }
  return lines;
}
function fitBlock(text: string, weight: Weight, maxWidth: number, maxSize: number, minSize: number, maxLines: number) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    const lines = wrap(text, weight, size, maxWidth);
    if (lines.length <= maxLines && lines.every((line) => textWidth(line, weight, size) <= maxWidth)) return { lines, size };
  }
  const lines = wrap(text, weight, minSize, maxWidth).slice(0, maxLines);
  return { lines, size: minSize };
}

type Variant = { modules: "rounded" | "dots" | "square"; eyes: "round" | "square"; panelRadius: number; frame: number; cta: "pill" | "rounded" | "outline"; swap: boolean; band: boolean; ornament: "none" | "dots" | "lines" | "corners"; qr: number; angle: 0 | 1 | 2 | 3 };
// Only four designs are offered: the classic card and a bolder "cool" card, each with and without the centre badge.
const CLASSIC: Variant = { modules: "rounded", eyes: "round", panelRadius: 56, frame: 12, cta: "pill", swap: false, band: false, ornament: "none", qr: 560, angle: 0 };
const COOL: Variant = { modules: "dots", eyes: "round", panelRadius: 110, frame: 10, cta: "rounded", swap: true, band: true, ornament: "corners", qr: 540, angle: 1 };
export const QR_STUDIO_DESIGNS = [
  { style: CLASSIC, badge: true }, { style: CLASSIC, badge: false }, { style: COOL, badge: true }, { style: COOL, badge: false },
] as const;
const GRADIENT_VECTORS = ["0 0 0 1", "0 0 1 1", "1 0 0 1", "0 1 1 0"];

const subtitles: Record<QrStudioCategory, string> = {
  cafes: "Café & Coffee House", restaurants: "Family Restaurant", hotels: "Hotel & Stay", pg: "PG & Hostel Stay", salons: "Salon & Styling Studio", clinics: "Clinic & Care Centre",
  coaching_centres: "Coaching Institute", plant_nurseries: "Plant Nursery & Garden", day_care: "Day Care & Play Home", preschools: "Preschool & Early Learning", gyms: "Gym & Fitness Studio", other: "Local Business",
};
// Centre badge illustrations on a 108 x 108 canvas, painted with the card palette (a = main, b = accent, i = ink, l = light).
type Ink = { a: string; b: string; i: string; l: string };
const stroke = (d: string, colour: string, width: number) => `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const badgeArt: Record<QrStudioCategory, (c: Ink) => string> = {
  restaurants: (c) => `${stroke("M40 42c-6-6 6-9 0-17M54 42c-6-6 6-9 0-17M68 42c-6-6 6-9 0-17", c.i, 3.5)}<path d="M23 56a31 31 0 0 0 62 0z" fill="${c.a}"/><rect x="19" y="51" width="70" height="8" rx="4" fill="${c.i}"/>`,
  cafes: (c) => `${stroke("M44 40c-5-6 5-8 0-15M58 40c-5-6 5-8 0-15", c.i, 3.5)}<path d="M28 48h46v14a16 16 0 0 1-16 16H44a16 16 0 0 1-16-16z" fill="${c.a}"/>${stroke("M74 53h5a8 8 0 0 1 0 16h-6", c.a, 5)}<ellipse cx="51" cy="82" rx="28" ry="4.5" fill="${c.b}"/>`,
  hotels: (c) => `<rect x="28" y="24" width="52" height="58" rx="5" fill="${c.a}"/>${[0, 1, 2].map((row) => [0, 1, 2].map((col) => `<rect x="${36 + col * 15}" y="${32 + row * 13}" width="9" height="8" rx="1.5" fill="${row === 1 && col === 1 ? c.b : c.l}"/>`).join("")).join("")}<rect x="47" y="66" width="14" height="16" rx="2" fill="${c.b}"/>`,
  pg: (c) => `<path d="M18 54 54 22l36 32z" fill="${c.b}"/><rect x="27" y="52" width="54" height="30" rx="3" fill="${c.a}"/><rect x="48" y="62" width="13" height="20" rx="2" fill="${c.l}"/><rect x="33" y="60" width="10" height="10" rx="1.5" fill="${c.l}"/><rect x="66" y="60" width="9" height="10" rx="1.5" fill="${c.l}"/>`,
  salons: (c) => `${stroke("M78 24 46 64M30 24l32 40", c.a, 6.5)}<circle cx="68" cy="76" r="9.5" fill="none" stroke="${c.b}" stroke-width="5.5"/><circle cx="40" cy="76" r="9.5" fill="none" stroke="${c.b}" stroke-width="5.5"/><circle cx="54" cy="52" r="3.4" fill="${c.i}"/>`,
  clinics: (c) => `<rect x="43" y="22" width="22" height="64" rx="7" fill="${c.a}"/><rect x="22" y="43" width="64" height="22" rx="7" fill="${c.a}"/><circle cx="54" cy="54" r="8" fill="${c.l}"/><circle cx="54" cy="54" r="4" fill="${c.b}"/>`,
  coaching_centres: (c) => `<path d="M34 52v14c0 9 40 9 40 0V52l-20 9z" fill="${c.i}"/><path d="M54 26 92 43 54 60 16 43z" fill="${c.a}"/>${stroke("M86 45v20", c.b, 3.5)}<circle cx="86" cy="69" r="4.5" fill="${c.b}"/>`,
  plant_nurseries: (c) => `<path d="M54 58C54 42 40 34 29 36c0 13 11 22 25 22z" fill="${c.a}"/><path d="M54 58C54 40 68 28 81 30c0 15-12 28-27 28z" fill="${c.a}"/>${stroke("M54 60V44", c.i, 3.5)}<path d="M32 60h44l-5 24H37z" fill="${c.b}"/><rect x="28" y="55" width="52" height="9" rx="3.5" fill="${c.i}"/>`,
  day_care: (c) => `<circle cx="34" cy="34" r="10" fill="${c.b}"/><circle cx="74" cy="34" r="10" fill="${c.b}"/><circle cx="54" cy="54" r="27" fill="${c.a}"/><ellipse cx="54" cy="63" rx="12" ry="9" fill="${c.l}"/><circle cx="44" cy="49" r="3.4" fill="${c.i}"/><circle cx="64" cy="49" r="3.4" fill="${c.i}"/><ellipse cx="54" cy="59" rx="4.5" ry="3.2" fill="${c.i}"/>${stroke("M54 62v3M48 67c3 3 9 3 12 0", c.i, 2.5)}`,
  preschools: (c) => `${stroke("M20 76A34 34 0 0 1 88 76", c.a, 8)}${stroke("M31 76A23 23 0 0 1 77 76", c.b, 8)}${stroke("M42 76A12 12 0 0 1 66 76", c.i, 8)}<circle cx="20" cy="78" r="6" fill="${c.l}" stroke="${c.i}" stroke-width="2.5"/><circle cx="88" cy="78" r="6" fill="${c.l}" stroke="${c.i}" stroke-width="2.5"/>`,
  gyms: (c) => `<rect x="30" y="49" width="48" height="10" rx="5" fill="${c.i}"/><rect x="17" y="33" width="14" height="42" rx="5" fill="${c.a}"/><rect x="77" y="33" width="14" height="42" rx="5" fill="${c.a}"/><rect x="30" y="39" width="9" height="30" rx="3.5" fill="${c.b}"/><rect x="69" y="39" width="9" height="30" rx="3.5" fill="${c.b}"/>`,
  other: (c) => `<path d="M54 20 64 43l25 2-19 16 6 25-22-13-22 13 6-25-19-16 25-2z" fill="${c.b}" stroke="${c.a}" stroke-width="5" stroke-linejoin="round"/>`,
};
function themePattern(category: QrStudioCategory, colour: string) {
  const ink = { a: colour, b: colour, i: colour, l: colour };
  return Array.from({ length: 20 }, (_, index) => { const row = Math.floor(index / 4); const column = index % 4; const x = 40 + column * 310 + (row % 2) * 150; const y = 40 + row * 330;
    return `<g transform="translate(${x} ${y}) rotate(${(index * 23) % 40 - 20} 90 90) scale(1.7)" opacity=".1">${badgeArt[category](ink)}</g>`; }).join("");
}

function mix(hex: string, toBlack: number) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#3a2a20";
  return `#${[1, 3, 5].map((index) => Math.round(parseInt(value.slice(index, index + 2), 16) * (1 - toBlack)).toString(16).padStart(2, "0")).join("")}`;
}
function cornerRect(x: number, y: number, size: number, tl: number, tr: number, br: number, bl: number) {
  const f = (value: number) => Math.round(value * 100) / 100;
  return `M${f(x + tl)} ${f(y)}H${f(x + size - tr)}${tr ? `A${f(tr)} ${f(tr)} 0 0 1 ${f(x + size)} ${f(y + tr)}` : ""}V${f(y + size - br)}${br ? `A${f(br)} ${f(br)} 0 0 1 ${f(x + size - br)} ${f(y + size)}` : ""}H${f(x + bl)}${bl ? `A${f(bl)} ${f(bl)} 0 0 1 ${f(x)} ${f(y + size - bl)}` : ""}V${f(y + tl)}${tl ? `A${f(tl)} ${f(tl)} 0 0 1 ${f(x + tl)} ${f(y)}` : ""}Z`;
}
function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const f = (value: number) => Math.round(value * 100) / 100;
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${r} ${r} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${r} ${r} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${r} ${r} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${r} ${r} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}

function qrArtwork(url: string, variant: Variant, left: number, top: number, size: number, colour: string, withBadge: boolean) {
  const code = QRCode.create(url, { errorCorrectionLevel: "H" });
  const count = code.modules.size; const module = size / count;
  const badge = size * 0.25; const clear = withBadge ? badge / 2 + module * 0.6 : 0; const centre = size / 2;
  const inEye = (row: number, column: number) => (row < 7 && column < 7) || (row < 7 && column >= count - 7) || (row >= count - 7 && column < 7);
  const hidden = (row: number, column: number) => Math.hypot((column + 0.5) * module - centre, (row + 0.5) * module - centre) < clear;
  const on = (row: number, column: number) => row >= 0 && column >= 0 && row < count && column < count && !inEye(row, column) && !hidden(row, column) && Boolean(code.modules.get(row, column));
  let data = "";
  for (let row = 0; row < count; row++) for (let column = 0; column < count; column++) {
    if (!on(row, column)) continue;
    const x = left + column * module; const y = top + row * module;
    if (variant.modules === "square") data += cornerRect(x, y, module, 0, 0, 0, 0);
    else if (variant.modules === "dots") data += `M${(x + module * 0.03).toFixed(2)} ${(y + module / 2).toFixed(2)}a${(module * 0.47).toFixed(2)} ${(module * 0.47).toFixed(2)} 0 1 0 ${(module * 0.94).toFixed(2)} 0a${(module * 0.47).toFixed(2)} ${(module * 0.47).toFixed(2)} 0 1 0 ${(-module * 0.94).toFixed(2)} 0Z`;
    else {
      const up = on(row - 1, column); const down = on(row + 1, column); const side = on(row, column - 1); const other = on(row, column + 1); const r = module / 2;
      data += cornerRect(x, y, module, !up && !side ? r : 0, !up && !other ? r : 0, !down && !other ? r : 0, !down && !side ? r : 0);
    }
  }
  let eyes = "";
  for (const [row, column] of [[0, 0], [0, count - 7], [count - 7, 0]]) {
    const x = left + column * module; const y = top + row * module; const round = variant.eyes === "round";
    eyes += `<path fill-rule="evenodd" d="${roundedRect(x, y, module * 7, module * 7, round ? module * 2.2 : 0)}${roundedRect(x + module, y + module, module * 5, module * 5, round ? module * 1.2 : 0)}"/><path d="${roundedRect(x + module * 2, y + module * 2, module * 3, module * 3, round ? module * 1 : 0)}"/>`;
  }
  return { svg: `<g fill="${colour}"><path d="${data}"/>${eyes}</g>`, badge, centre: { x: left + centre, y: top + centre } };
}

function ornaments(kind: Variant["ornament"], colour: string, seed: number) {
  if (kind === "none") return "";
  if (kind === "corners") return [[40, 40, 1, 1], [WIDTH - 40, 40, -1, 1], [40, HEIGHT - 40, 1, -1], [WIDTH - 40, HEIGHT - 40, -1, -1]].map(([x, y, dx, dy]) => `<path d="M${x} ${y + dy * 90}V${y}H${x + dx * 90}" fill="none" stroke="${colour}" stroke-width="8" stroke-linecap="round" opacity=".85"/>`).join("");
  if (kind === "lines") return Array.from({ length: 9 }, (_, index) => `<path d="M${-200 + index * 220} ${HEIGHT}L${300 + index * 220} 0" stroke="${colour}" stroke-width="3" opacity=".16"/>`).join("");
  let state = seed + 11; const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: 18 }, () => `<circle cx="${Math.round(next() * WIDTH)}" cy="${Math.round(next() * HEIGHT)}" r="${Math.round(6 + next() * 16)}" fill="${colour}" opacity="${(0.1 + next() * 0.14).toFixed(2)}"/>`).join("");
}

export type StudioRenderInput = { businessName: string; trackingUrl: string; category: QrStudioCategory; variantIndex: number; tagline: string; bwMode: boolean; photo?: Buffer; photoPalette?: { dark?: string; accent?: string; light?: string } | null };

export async function renderStudioCard(input: StudioRenderInput) {
  const theme = qrStudioThemes[input.category];
  const variantIndex = ((input.variantIndex % QR_STUDIO_DESIGN_COUNT) + QR_STUDIO_DESIGN_COUNT) % QR_STUDIO_DESIGN_COUNT;
  const { style: variant, badge: withBadge } = QR_STUDIO_DESIGNS[variantIndex];
  const palette = input.bwMode ? { dark: "#000000", accent: "#000000", light: "#ffffff" } : input.photo ? await derivePhotoPalette(input.photo, theme) : { dark: theme.dark, accent: theme.accent, light: theme.light };
  const ink = input.bwMode ? "#000000" : "#FFFFFF";
  const name = printable((cleanDisplayText(input.businessName, 60) ?? "Your business").toUpperCase(), 700).trim() || "YOUR BUSINESS";
  const tagline = printable(cleanDisplayText(input.tagline, QR_STUDIO_MAX_TAGLINE_LENGTH) ?? "Tell us about your experience", 500).trim() || "Tell us about your experience";

  const title = fitBlock(name, 700, 1040, 128, 52, 2);
  const lastBaseline = 255; const subtitleY = lastBaseline + 88;
  const titleSvg = title.lines.map((line, index) => textPath(line, 700, title.size, WIDTH / 2, lastBaseline - (title.lines.length - 1 - index) * title.size * 1.08, ink)).join("");
  const subtitleSvg = textPath(printable(subtitles[input.category], 500).toUpperCase(), 500, 34, WIDTH / 2, subtitleY, input.bwMode ? "#000000" : palette.light, 5);

  const pad = 64; const panelSize = variant.qr + pad * 2; const panelX = (WIDTH - panelSize) / 2; const panelY = 455;
  const qr = qrArtwork(input.trackingUrl, variant, panelX + pad, panelY + pad, variant.qr, input.bwMode ? "#000000" : palette.dark, withBadge);
  const borderColour = input.bwMode ? "#000000" : variant.swap ? palette.dark : palette.accent;
  const iconScale = qr.badge / 108; const ink2 = input.bwMode ? "#000000" : mix(palette.dark, 0.55);
  const badge = `<g transform="translate(${(qr.centre.x - qr.badge / 2).toFixed(1)} ${(qr.centre.y - qr.badge / 2).toFixed(1)}) scale(${iconScale.toFixed(4)})"><circle cx="54" cy="54" r="51" fill="${palette.light}" stroke="${input.bwMode ? "#000000" : palette.accent}" stroke-width="7"/><g transform="translate(54 54) scale(.8) translate(-54 -54)">${badgeArt[input.category]({ a: palette.dark, b: palette.accent, i: ink2, l: palette.light })}</g></g>`;

  const ctaTop = panelY + panelSize + 130; const ctaHeight = 116; const ctaWidth = 700; const ctaX = (WIDTH - ctaWidth) / 2;
  const ctaRadius = variant.cta === "pill" ? ctaHeight / 2 : variant.cta === "rounded" ? 28 : ctaHeight / 2;
  const ctaFill = variant.cta === "outline" ? "none" : palette.dark;
  const ctaStroke = variant.cta === "outline" ? `stroke="${input.bwMode ? "#000000" : ink}" stroke-width="6"` : input.bwMode ? "" : `stroke="${palette.accent}" stroke-width="5"`;
  const ctaTextColour = input.bwMode ? (variant.cta === "outline" ? "#000000" : "#FFFFFF") : ink;
  const cta = `<rect x="${ctaX}" y="${ctaTop}" width="${ctaWidth}" height="${ctaHeight}" rx="${ctaRadius}" fill="${ctaFill}" ${ctaStroke}/>${textPath("SCAN & REVIEW", 700, 56, WIDTH / 2, ctaTop + ctaHeight / 2 + 20, ctaTextColour, 2)}`;

  const message = fitBlock(tagline, 500, 980, 46, 30, 2);
  const lineHeight = message.size * 1.28; const areaTop = ctaTop + ctaHeight; const centreY = areaTop + (HEIGHT - areaTop) / 2;
  const taglineSvg = message.lines.map((line, index) => textPath(line, 500, message.size, WIDTH / 2, centreY - ((message.lines.length - 1) * lineHeight) / 2 + index * lineHeight + message.size * 0.35, input.bwMode ? "#000000" : ink)).join("");

  const [x1, y1, x2, y2] = GRADIENT_VECTORS[variant.angle].split(" ");
  const [fromColour, toColour] = variant.swap ? [palette.dark, palette.accent] : [palette.accent, palette.dark];
  const tint = [1, 1];
  // Photos keep their own colours: only brightness is nudged towards a readable level, and text areas get a neutral dark shade.
  let photoBrightness = 1;
  if (input.photo) { const [red, green, blue] = (await sharp(input.photo).stats()).channels.map((channel) => channel.mean); const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255; photoBrightness = Math.min(1.15, Math.max(0.45, 0.3 / Math.max(luminance, 0.05))); }
  const background = input.bwMode
    ? sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: "#ffffff" } })
    : input.photo
      ? sharp(input.photo).resize(WIDTH, HEIGHT, { fit: "cover" }).modulate({ brightness: photoBrightness, saturation: 1.05 }).blur(1.2)
      : sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: palette.dark } });
  const backdrop = input.bwMode ? "" : `${input.photo ? "" : `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#tint)"/>`}<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#${input.photo ? "photoShade" : "scrim"})"/>${input.photo ? "" : themePattern(input.category, palette.light)}${ornaments(variant.ornament, palette.light, variantIndex)}${variant.band ? `<rect x="0" y="${lastBaseline - title.size * 1.1 - (title.lines.length - 1) * title.size * 1.08}" width="${WIDTH}" height="${subtitleY + 52 - (lastBaseline - title.size * 1.1 - (title.lines.length - 1) * title.size * 1.08)}" fill="${palette.dark}" opacity=".72"/><rect x="0" y="${subtitleY + 52}" width="${WIDTH}" height="6" fill="${palette.accent}"/>` : ""}`;
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="tint" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${fromColour}" stop-opacity="${tint[0]}"/><stop offset="1" stop-color="${toColour}" stop-opacity="${tint[1]}"/></linearGradient><linearGradient id="photoShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".68"/><stop offset=".3" stop-color="#000" stop-opacity=".2"/><stop offset=".7" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".72"/></linearGradient><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset=".3" stop-color="#000" stop-opacity=".05"/><stop offset=".72" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient></defs>${backdrop}${titleSvg}${subtitleSvg}<rect x="${panelX}" y="${panelY}" width="${panelSize}" height="${panelSize}" rx="${variant.panelRadius}" fill="${palette.light}" stroke="${borderColour}" stroke-width="${variant.frame}"/>${qr.svg}${withBadge ? badge : ""}${cta}${taglineSvg}</svg>`;
  const image = await background.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).flatten({ background: "#ffffff" }).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer();
  return { image, palette };
}
