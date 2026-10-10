import QRCode from "qrcode";
import sharp from "sharp";
import { parse, type Font } from "opentype.js";
import poppins500 from "./fonts/poppins-500";
import poppins600 from "./fonts/poppins-600";
import poppins700 from "./fonts/poppins-700";
import { QR_STUDIO_MAX_TAGLINE_LENGTH, cleanDisplayText, qrStudioThemes, type QrStudioCategory } from "./qr-studio";

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
// Twelve deterministic layouts. Each changes the QR style, panel shape, button, colour direction and decoration.
export const QR_STUDIO_VARIANTS: Variant[] = [
  { modules: "rounded", eyes: "round", panelRadius: 56, frame: 12, cta: "pill", swap: false, band: false, ornament: "none", qr: 560, angle: 0 },
  { modules: "dots", eyes: "round", panelRadius: 96, frame: 10, cta: "pill", swap: true, band: false, ornament: "dots", qr: 540, angle: 1 },
  { modules: "square", eyes: "square", panelRadius: 24, frame: 14, cta: "rounded", swap: false, band: true, ornament: "lines", qr: 580, angle: 2 },
  { modules: "rounded", eyes: "round", panelRadius: 120, frame: 8, cta: "outline", swap: true, band: false, ornament: "corners", qr: 560, angle: 3 },
  { modules: "dots", eyes: "square", panelRadius: 40, frame: 16, cta: "pill", swap: false, band: true, ornament: "dots", qr: 550, angle: 1 },
  { modules: "rounded", eyes: "round", panelRadius: 72, frame: 12, cta: "rounded", swap: true, band: false, ornament: "lines", qr: 570, angle: 2 },
  { modules: "square", eyes: "round", panelRadius: 64, frame: 10, cta: "pill", swap: false, band: false, ornament: "corners", qr: 560, angle: 3 },
  { modules: "dots", eyes: "round", panelRadius: 110, frame: 12, cta: "outline", swap: false, band: true, ornament: "none", qr: 540, angle: 0 },
  { modules: "rounded", eyes: "square", panelRadius: 32, frame: 18, cta: "rounded", swap: true, band: false, ornament: "dots", qr: 580, angle: 1 },
  { modules: "square", eyes: "square", panelRadius: 80, frame: 8, cta: "pill", swap: true, band: true, ornament: "lines", qr: 560, angle: 2 },
  { modules: "dots", eyes: "round", panelRadius: 56, frame: 14, cta: "rounded", swap: false, band: false, ornament: "corners", qr: 550, angle: 3 },
  { modules: "rounded", eyes: "round", panelRadius: 100, frame: 10, cta: "outline", swap: true, band: true, ornament: "none", qr: 560, angle: 0 },
];
const GRADIENT_VECTORS = ["0 0 0 1", "0 0 1 1", "1 0 0 1", "0 1 1 0"];

const subtitles: Record<QrStudioCategory, string> = {
  cafes: "Café & Coffee House", restaurants: "Family Restaurant", hotels: "Hotel & Stay", pg: "PG & Hostel Stay", salons: "Salon & Styling Studio", clinics: "Clinic & Care Centre",
  coaching_centres: "Coaching Institute", plant_nurseries: "Plant Nursery & Garden", day_care: "Day Care & Play Home", preschools: "Preschool & Early Learning", gyms: "Gym & Fitness Studio", other: "Local Business",
};
// Centre badge icons, drawn on a 108 x 108 canvas.
const badgePaths: Record<QrStudioCategory, string> = {
  cafes: "M28 47h45V76H28zM73 54h12c10 0 10 17 0 17H73M38 31c-5 7 5 11 0 18M55 31c-5 7 5 11 0 18",
  restaurants: "M24 64h56M31 62c2-23 40-23 43 0M39 41c-5-7 4-11 0-18M53 41c-5-7 4-11 0-18M67 41c-5-7 4-11 0-18",
  hotels: "M24 75V39h56v36M34 39V27h36v12M36 55h9M55 55h9M24 75h56",
  pg: "M25 49 52 26l27 23v28H25zM46 77V59h12v18M65 55h5",
  salons: "M29 31 75 77M75 31 29 77M25 27l10 10M69 27l-10 10",
  clinics: "M45 24h14v16h16v14H59v16H45V54H29V40h16z",
  coaching_centres: "M26 33c16-8 28-5 34 1 8-5 19-6 27-1v40c-9-5-19-3-27 2-8-5-18-7-34-2zM60 34v41",
  plant_nurseries: "M52 78V49M52 63c-22 0-25-19-19-28 18 3 21 16 19 28M53 55c5-18 18-20 28-15-3 18-14 22-28 15",
  day_care: "M31 55c0-13 10-24 23-24s23 11 23 24-10 24-23 24-23-11-23-24zM43 55h1M64 55h1M47 66c4 3 8 3 12 0",
  preschools: "M29 74V37h50v37M29 37l25-16 25 16M43 74V57h22v17",
  gyms: "M22 48v16M31 42v28M40 48h40M78 42v28M87 48v16",
  other: "M53 22 61 45l23 8-23 8-8 23-8-23-23-8 23-8z",
};

function cornerRect(x: number, y: number, size: number, tl: number, tr: number, br: number, bl: number) {
  const f = (value: number) => Math.round(value * 100) / 100;
  return `M${f(x + tl)} ${f(y)}H${f(x + size - tr)}${tr ? `A${f(tr)} ${f(tr)} 0 0 1 ${f(x + size)} ${f(y + tr)}` : ""}V${f(y + size - br)}${br ? `A${f(br)} ${f(br)} 0 0 1 ${f(x + size - br)} ${f(y + size)}` : ""}H${f(x + bl)}${bl ? `A${f(bl)} ${f(bl)} 0 0 1 ${f(x)} ${f(y + size - bl)}` : ""}V${f(y + tl)}${tl ? `A${f(tl)} ${f(tl)} 0 0 1 ${f(x + tl)} ${f(y)}` : ""}Z`;
}
function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const f = (value: number) => Math.round(value * 100) / 100;
  return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${r} ${r} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${r} ${r} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${r} ${r} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${r} ${r} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}

function qrArtwork(url: string, variant: Variant, left: number, top: number, size: number, colour: string) {
  const code = QRCode.create(url, { errorCorrectionLevel: "H" });
  const count = code.modules.size; const module = size / count;
  const badge = size * 0.22; const clear = badge / 2 + module * 0.6; const centre = size / 2;
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
  const variantIndex = ((input.variantIndex % 12) + 12) % 12;
  const variant = QR_STUDIO_VARIANTS[variantIndex];
  const palette = input.bwMode ? { dark: "#000000", accent: "#000000", light: "#ffffff" } : { dark: input.photoPalette?.dark || theme.dark, accent: input.photoPalette?.accent || theme.accent, light: input.photoPalette?.light || theme.light };
  const ink = input.bwMode ? "#000000" : "#FFFFFF";
  const name = printable((cleanDisplayText(input.businessName, 60) ?? "Your business").toUpperCase(), 700).trim() || "YOUR BUSINESS";
  const tagline = printable(cleanDisplayText(input.tagline, QR_STUDIO_MAX_TAGLINE_LENGTH) ?? "Tell us about your experience", 500).trim() || "Tell us about your experience";

  const title = fitBlock(name, 700, 1040, 128, 52, 2);
  const lastBaseline = 255; const subtitleY = lastBaseline + 88;
  const titleSvg = title.lines.map((line, index) => textPath(line, 700, title.size, WIDTH / 2, lastBaseline - (title.lines.length - 1 - index) * title.size * 1.08, ink)).join("");
  const subtitleSvg = textPath(printable(subtitles[input.category], 500).toUpperCase(), 500, 34, WIDTH / 2, subtitleY, input.bwMode ? "#000000" : palette.light, 5);

  const pad = 64; const panelSize = variant.qr + pad * 2; const panelX = (WIDTH - panelSize) / 2; const panelY = 455;
  const qr = qrArtwork(input.trackingUrl, variant, panelX + pad, panelY + pad, variant.qr, input.bwMode ? "#000000" : palette.dark);
  const borderColour = input.bwMode ? "#000000" : variant.swap ? palette.dark : palette.accent;
  const iconScale = qr.badge / 108;
  const badge = `<g transform="translate(${(qr.centre.x - qr.badge / 2).toFixed(1)} ${(qr.centre.y - qr.badge / 2).toFixed(1)}) scale(${iconScale.toFixed(4)})"><circle cx="54" cy="54" r="51" fill="${palette.light}" stroke="${input.bwMode ? "#000000" : palette.accent}" stroke-width="7"/><g transform="translate(54 54) scale(.78) translate(-54 -54)"><path d="${badgePaths[input.category]}" fill="none" stroke="${palette.dark}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;

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
  const tint = input.photo ? [0.34, 0.66] : [1, 1];
  const background = input.bwMode
    ? sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: "#ffffff" } })
    : input.photo
      ? sharp(input.photo).resize(WIDTH, HEIGHT, { fit: "cover" }).modulate({ brightness: 0.62, saturation: 0.95 }).blur(1.6)
      : sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: palette.dark } });
  const backdrop = input.bwMode ? "" : `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#tint)"/><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#scrim)"/>${ornaments(variant.ornament, palette.light, variantIndex)}${variant.band ? `<rect x="0" y="${lastBaseline - title.size * 1.1 - (title.lines.length - 1) * title.size * 1.08}" width="${WIDTH}" height="${subtitleY + 52 - (lastBaseline - title.size * 1.1 - (title.lines.length - 1) * title.size * 1.08)}" fill="${palette.dark}" opacity=".72"/><rect x="0" y="${subtitleY + 52}" width="${WIDTH}" height="6" fill="${palette.accent}"/>` : ""}`;
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="tint" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${fromColour}" stop-opacity="${tint[0]}"/><stop offset="1" stop-color="${toColour}" stop-opacity="${tint[1]}"/></linearGradient><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset=".3" stop-color="#000" stop-opacity=".05"/><stop offset=".72" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient></defs>${backdrop}${titleSvg}${subtitleSvg}<rect x="${panelX}" y="${panelY}" width="${panelSize}" height="${panelSize}" rx="${variant.panelRadius}" fill="${palette.light}" stroke="${borderColour}" stroke-width="${variant.frame}"/>${qr.svg}${badge}${cta}${taglineSvg}</svg>`;
  const image = await background.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png({ compressionLevel: 9 }).toBuffer();
  return { image, palette };
}
