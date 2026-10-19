// Генерирует иконки PWA из public/favicon.svg: apple-touch-icon и иконки манифеста.
// У SVG-фавикона скруглённые углы с прозрачностью, а для иконок приложений нужен
// сплошной фон, поэтому рисуем на прямоугольнике цвета темы.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const NAVY = "#0A1631";
const source = await sharp("public/favicon.svg").png().toBuffer();

await mkdir("public/images/icons", { recursive: true });

const targets = [
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
];

for (const { file, size } of targets) {
  await sharp(source)
    .resize(size, size)
    .flatten({ background: NAVY })
    .png({ compressionLevel: 9 })
    .toFile(`public/images/icons/${file}`);
  console.log(`images/icons/${file}: ${size}x${size}`);
}
