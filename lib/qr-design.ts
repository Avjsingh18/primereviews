import QRCode from "qrcode";

export const QR_DESIGN_MAX_THEME_LENGTH = 600;

export type QrDesign = {
  theme: string;
  backgroundDataUrl: string;
  qrDataUrl: string;
  generatedAt: string;
};

type ImageGeneration = { data?: Array<{ b64_json?: string }> };

export function normalizeQrTheme(value: unknown) {
  if (typeof value !== "string") return null;
  const theme = value.replace(/\s+/g, " ").trim();
  return theme.length >= 8 && theme.length <= QR_DESIGN_MAX_THEME_LENGTH ? theme : null;
}

export function qrArtworkPrompt(theme: string) {
  return [
    "Create a square, premium restaurant review-card background.",
    `The restaurant's style description is: "${theme}".`,
    "Use only the visual mood, materials, colours, and atmosphere in that description.",
    "Leave the central 70 percent calm, low-detail and high-contrast so a real QR code can be placed over it.",
    "Do not draw a QR code. Do not include words, letters, numbers, logos, brand marks, people, menus, or a Google logo.",
    "The image must work as a tasteful print-ready background, with detail kept toward the outer edges.",
  ].join(" ");
}

export async function createReliableQrDataUrl(trackingUrl: string) {
  return QRCode.toDataURL(trackingUrl, {
    width: 760,
    margin: 5,
    errorCorrectionLevel: "H",
    color: { dark: "#172033", light: "#ffffff" },
  });
}

export async function generateQrDesign({
  theme,
  trackingUrl,
  apiKey,
  model = "gpt-image-2.5-flare",
  signal,
}: {
  theme: string;
  trackingUrl: string;
  apiKey: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<QrDesign> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: qrArtworkPrompt(theme),
      size: "1024x1024",
      quality: "low",
      output_format: "webp",
      output_compression: 70,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { code?: string } } | null;
    const code = body?.error?.code;
    throw new Error(code === "moderation_blocked" ? "Theme artwork was blocked. Try a neutral restaurant description." : "The artwork service is unavailable.");
  }

  const result = await response.json() as ImageGeneration;
  const image = result.data?.[0]?.b64_json;
  if (!image) throw new Error("The artwork service did not return an image.");

  return {
    theme,
    backgroundDataUrl: `data:image/webp;base64,${image}`,
    qrDataUrl: await createReliableQrDataUrl(trackingUrl),
    generatedAt: new Date().toISOString(),
  };
}
