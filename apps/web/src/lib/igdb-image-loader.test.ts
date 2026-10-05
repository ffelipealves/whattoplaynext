import { expect, test } from "vitest";

import igdbImageLoader, { igdbFittedImageLoader } from "./igdb-image-loader";

const UPLOAD = "https://images.igdb.com/igdb/image/upload";
const COVER = `${UPLOAD}/t_cover_big_2x/coaarl.jpg`;
const SCREENSHOT = `${UPLOAD}/t_1080p/sctj8u.jpg`;

test.each([
  [32, "cover_small"],
  [90, "cover_small"],
  [91, "cover_big"],
  [264, "cover_big"],
  [384, "cover_big_2x"],
  [3840, "cover_big_2x"],
])("a cover %ipx wide is served as %s", (width, transform) => {
  expect(igdbImageLoader({ src: COVER, width })).toBe(
    `${UPLOAD}/t_${transform}/coaarl.jpg`,
  );
});

test.each([
  [384, "screenshot_med"],
  [828, "screenshot_big"],
  [1200, "screenshot_huge"],
  [1920, "1080p"],
  [3840, "1080p"],
])("a cropped screenshot %ipx wide is served as %s", (width, transform) => {
  expect(igdbImageLoader({ src: SCREENSHOT, width })).toBe(
    `${UPLOAD}/t_${transform}/sctj8u.jpg`,
  );
});

test.each([
  [384, "720p"],
  [1280, "720p"],
  [1281, "1080p"],
  [3840, "1080p"],
])(
  "a screenshot shown whole %ipx wide keeps its proportions as %s",
  (width, transform) => {
    expect(igdbFittedImageLoader({ src: SCREENSHOT, width })).toBe(
      `${UPLOAD}/t_${transform}/sctj8u.jpg`,
    );
  },
);

test("a 720p screenshot belongs to the same family as 1080p", () => {
  expect(
    igdbImageLoader({ src: `${UPLOAD}/t_720p/sctj8u.jpg`, width: 384 }),
  ).toBe(`${UPLOAD}/t_screenshot_med/sctj8u.jpg`);
});

test.each([
  ["another host", "https://example.com/t_cover_big/coaarl.jpg"],
  ["an unknown IGDB size", `${UPLOAD}/t_logo_med/coaarl.jpg`],
  ["a local image", "/placeholder.png"],
])("%s is left unchanged", (_, src) => {
  expect(igdbImageLoader({ src, width: 640 })).toBe(src);
  expect(igdbFittedImageLoader({ src, width: 640 })).toBe(src);
});
