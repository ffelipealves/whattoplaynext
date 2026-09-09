export const supportedLocales = ["en", "pt-br"] as const;

export type Locale = (typeof supportedLocales)[number];

export type LandingContent = {
  languageLabel: string;
  alternateLanguage: string;
  alternateLocale: Locale;
  eyebrow: string;
  titleLead: string;
  titleEmphasis: string;
  titleEnd: string;
  description: string;
  primaryAction: string;
  status: string;
  exampleLabel: string;
  resultLabel: string;
  resultValue: string;
  constraints: ReadonlyArray<{ label: string; value: string }>;
  principles: ReadonlyArray<{ title: string; description: string }>;
};

const content: Record<Locale, LandingContent> = {
  en: {
    languageLabel: "Language",
    alternateLanguage: "Português",
    alternateLocale: "pt-br",
    eyebrow: "Structured game discovery",
    titleLead: "Find a game",
    titleEmphasis: "that fits",
    titleEnd: "tonight.",
    description:
      "Combine platform, genre, rating, release date, game mode, and play time. Get strict results you can compare without guessing why they appeared.",
    primaryAction: "Preview the criteria",
    status: "Foundation online · Search tools are next",
    exampleLabel: "Example search",
    resultLabel: "Expected behavior",
    resultValue: "Only exact matches",
    constraints: [
      { label: "Platform", value: "PC + Switch" },
      { label: "Time", value: "2–8 hours" },
      { label: "Mode", value: "Single player" },
      { label: "Rating", value: "80 or higher" },
    ],
    principles: [
      {
        title: "Your constraints stay visible",
        description: "Every applied criterion remains clear and removable.",
      },
      {
        title: "Missing data stays missing",
        description: "Unknown values are shown honestly, never invented.",
      },
      {
        title: "Zero means zero",
        description:
          "We suggest what to relax without sneaking in near matches.",
      },
    ],
  },
  "pt-br": {
    languageLabel: "Idioma",
    alternateLanguage: "English",
    alternateLocale: "en",
    eyebrow: "Descoberta estruturada de jogos",
    titleLead: "Encontre um jogo",
    titleEmphasis: "que caiba",
    titleEnd: "na sua noite.",
    description:
      "Combine plataforma, gênero, nota, lançamento, modo e tempo disponível. Receba resultados estritos e comparáveis, sem precisar adivinhar por que apareceram.",
    primaryAction: "Ver os critérios",
    status: "Fundação online · A busca vem a seguir",
    exampleLabel: "Exemplo de busca",
    resultLabel: "Comportamento esperado",
    resultValue: "Somente correspondências exatas",
    constraints: [
      { label: "Plataforma", value: "PC + Switch" },
      { label: "Tempo", value: "2–8 horas" },
      { label: "Modo", value: "Um jogador" },
      { label: "Nota", value: "80 ou mais" },
    ],
    principles: [
      {
        title: "Seus critérios continuam visíveis",
        description: "Todo filtro aplicado permanece claro e removível.",
      },
      {
        title: "Dado ausente continua ausente",
        description: "Valores desconhecidos são mostrados, nunca inventados.",
      },
      {
        title: "Zero significa zero",
        description:
          "Sugerimos o que flexibilizar sem inserir resultados aproximados.",
      },
    ],
  },
};

export function isSupportedLocale(locale: string): locale is Locale {
  return supportedLocales.some((candidate) => candidate === locale);
}

export function getLandingContent(locale: Locale): LandingContent {
  return content[locale];
}
