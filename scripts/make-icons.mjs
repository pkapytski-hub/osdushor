// Генерирует иконку вкладки и иконки приложения из официального логотипа школы
// (public/images/logo.png). Эмблема на прозрачном фоне обрезается по краям, чтобы
// не тратить пиксели на поля, и ставится на белый прямоугольник: iOS и Android
// не поддерживают прозрачность в иконках приложения и залили бы её чёрным.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const WHITE = "#FFFFFF";
const SOURCE = "public/images/logo.png";

const emblem = await sharp(SOURCE).trim({ threshold: 10 }).toBuffer();

// Иконка вкладки: прозрачный фон, эмблема вплотную к краям.
await sharp(emblem)
  .resize(48, 48, { fit: "inside", kernel: "lanczos3" })
  .sharpen({ sigma: 0.6 })
  .png({ compressionLevel: 9 })
  .toFile("public/favicon.png");
console.log("public/favicon.png: 48x48");

await mkdir("public/images/icons", { recursive: true });

// Иконки приложения: белая подложка и поля, чтобы система могла скруглить углы.
const targets = [
  { file: "apple-touch-icon.png", size: 180, padding: 0.88 },
  { file: "icon-192.png", size: 192, padding: 0.86 },
  { file: "icon-512.png", size: 512, padding: 0.82 },
];

for (const { file, size, padding } of targets) {
  const inner = Math.round(size * padding);
  const glyph = await sharp(emblem)
    .resize(inner, inner, { fit: "inside", kernel: "lanczos3" })
    .sharpen({ sigma: size >= 256 ? 0.8 : 0.5 })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: glyph, gravity: "center" }])
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(`public/images/icons/${file}`);
  console.log(`images/icons/${file}: ${size}x${size}`);
}
