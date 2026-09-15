import type { GameDetail } from "../../src/features/game/get-game-detail";

export const completeGameDetail = {
  id: 1942,
  slug: "the-witcher-3-wild-hunt",
  title: "The Witcher 3: Wild Hunt",
  alternativeNames: ["TW3", "Wiedzmin 3: Dziki Gon"],
  summary: "A story-driven, next-generation open world role-playing game.",
  summaryLanguage: "en",
  cover: {
    url: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
    width: 264,
    height: 374,
  },
  screenshots: [
    {
      url: "https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc1abc.jpg",
      width: 889,
      height: 500,
    },
    {
      url: "https://images.igdb.com/igdb/image/upload/t_screenshot_big/sc2def.jpg",
      width: 889,
      height: 500,
    },
  ],
  releases: [
    { platform: { id: "pc", label: "PC" }, releaseDate: "2015-05-19" },
    {
      platform: { id: "playstation-4", label: "PlayStation 4" },
      releaseDate: "2015-05-19",
    },
    {
      platform: { id: "playstation-5", label: "PlayStation 5" },
      releaseDate: "2020-12-22",
    },
  ],
  genres: [
    { id: "role-playing-rpg", label: "Role-playing (RPG)" },
    { id: "adventure", label: "Adventure" },
  ],
  themes: [
    { id: 1, name: "Action" },
    { id: 22, name: "Historical" },
  ],
  platforms: [
    { id: "pc", label: "PC" },
    { id: "playstation-4", label: "PlayStation 4" },
    { id: "playstation-5", label: "PlayStation 5" },
  ],
  gameModes: [{ id: "single-player", label: "Single player" }],
  multiplayer: {
    onlineCoop: true,
    offlineCoop: false,
    splitScreen: true,
    maxPlayers: 4,
  },
  userRating: { value: 88.5, count: 5321, source: "IGDB user" },
  criticRating: { value: 92.1, count: 45, source: "IGDB critic" },
  combinedRating: {
    value: 92.25,
    count: 2745,
    source: "IGDB combined",
  },
  durations: {
    fast: { seconds: 18000, submissionCount: 1834 },
    normal: { seconds: 39600, submissionCount: 1834 },
    completionist: { seconds: 108000, submissionCount: 1834 },
  },
  ageRatings: [
    { organization: "ESRB", rating: "Mature" },
    { organization: "PEGI", rating: "18" },
  ],
  externalLinks: [
    {
      label: "Official Website",
      url: "https://thewitcher.com/en/witcher3",
    },
    {
      label: "Steam",
      url: "https://store.steampowered.com/app/292030",
    },
  ],
  meta: {
    servedFrom: "provider",
    dataMayBeStale: false,
    excludedUnknownDuration: false,
  },
} satisfies GameDetail;

export const sparseGameDetail = {
  id: 1942,
  slug: "minimal-game",
  title: "Minimal Game",
  alternativeNames: [],
  summary: null,
  summaryLanguage: null,
  cover: null,
  screenshots: [],
  releases: [],
  genres: [],
  themes: [],
  platforms: [],
  gameModes: [],
  multiplayer: {
    onlineCoop: false,
    offlineCoop: false,
    splitScreen: false,
    maxPlayers: null,
  },
  userRating: null,
  criticRating: null,
  combinedRating: null,
  durations: { fast: null, normal: null, completionist: null },
  ageRatings: [],
  externalLinks: [],
  meta: {
    servedFrom: "provider",
    dataMayBeStale: false,
    excludedUnknownDuration: false,
  },
} satisfies GameDetail;
