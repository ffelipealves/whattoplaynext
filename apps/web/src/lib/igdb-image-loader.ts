"use client";

/**
 * Serves game images straight from IGDB's CDN, picking the IGDB size that
 * covers the width the browser asked for. Going through `/_next/image` would
 * spend Vercel image transformations, which the Hobby plan caps at 5,000 a
 * month; IGDB already publishes every image at a fixed set of sizes.
 *
 * The default loader may use IGDB's cropped screenshot sizes, because every
 * screenshot it serves is shown with `object-cover` and cropped anyway. A
 * screenshot shown whole must use `igdbFittedImageLoader`.
 */

type ImageLoaderProps = { src: string; width: number; quality?: number };

type Size = readonly [width: number, transform: string];

const IGDB_IMAGE =
  /^(https:\/\/images\.igdb\.com\/igdb\/image\/upload\/)t_([a-z0-9_]+)(\/[a-z0-9]+\.jpg)$/;

const COVER_SIZES: readonly Size[] = [
  [90, "cover_small"],
  [264, "cover_big"],
  [528, "cover_big_2x"],
];

// `screenshot_*` fill their box and crop the rest; `1080p` fits the image.
const CROPPED_SCREENSHOT_SIZES: readonly Size[] = [
  [569, "screenshot_med"],
  [889, "screenshot_big"],
  [1280, "screenshot_huge"],
  [1920, "1080p"],
];

const FITTED_SCREENSHOT_SIZES: readonly Size[] = [
  [1280, "720p"],
  [1920, "1080p"],
];

function smallestCovering(sizes: readonly Size[], width: number): string {
  const size = sizes.find(([sizeWidth]) => sizeWidth >= width);
  return (size ?? sizes[sizes.length - 1])[1];
}

function resize(
  src: string,
  width: number,
  screenshotSizes: readonly Size[],
): string {
  const match = IGDB_IMAGE.exec(src);
  if (!match) {
    return src;
  }
  const [, base, transform, file] = match;
  const sizes = transform.startsWith("cover_")
    ? COVER_SIZES
    : transform.startsWith("screenshot_") ||
        transform === "720p" ||
        transform === "1080p"
      ? screenshotSizes
      : null;
  if (!sizes) {
    return src;
  }
  return `${base}t_${smallestCovering(sizes, width)}${file}`;
}

export default function igdbImageLoader({ src, width }: ImageLoaderProps) {
  return resize(src, width, CROPPED_SCREENSHOT_SIZES);
}

export function igdbFittedImageLoader({ src, width }: ImageLoaderProps) {
  return resize(src, width, FITTED_SCREENSHOT_SIZES);
}
