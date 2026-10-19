import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";

const images = ["hero", "training", "awards", "racket-ball"];
await mkdir("public/images", { recursive: true });

for (const name of images) {
  const source = `public/images/${name}.jpg`;
  await sharp(source).webp({ quality: 82, effort: 5 }).toFile(`public/images/${name}.webp`);
}

for (const width of [960, 1440]) {
  await sharp("public/images/hero.jpg")
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 80, effort: 5 })
    .toFile(`public/images/hero-${width}.webp`);
}

for (const file of [
  "hero.webp",
  "hero-960.webp",
  "hero-1440.webp",
  "training.webp",
  "awards.webp",
  "racket-ball.webp",
]) {
  const info = await stat(`public/images/${file}`);
  console.log(`${file}: ${Math.round(info.size / 1024)} KB`);
}
