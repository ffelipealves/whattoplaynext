import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import axe, { type Result } from "axe-core";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";
import ptMessages from "../../../messages/pt-br.json";

import { InformationPage } from "./information-page";
import { SiteFooter } from "./site-footer";

function withMessages(
  children: React.ReactNode,
  messages: typeof enMessages | typeof ptMessages = enMessages,
) {
  return (
    <NextIntlClientProvider
      locale={messages === ptMessages ? "pt-br" : "en"}
      messages={messages}
    >
      {children}
    </NextIntlClientProvider>
  );
}

async function seriousViolations(container: HTMLElement): Promise<Result[]> {
  const result = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );
}

test.each([
  ["about", "About & data sources", "Sobre e fontes de dados"],
  ["privacy", "Privacy", "Privacidade"],
  ["terms", "Terms", "Termos"],
] as const)(
  "renders and localizes the %s draft",
  (kind, english, portuguese) => {
    const en = render(withMessages(<InformationPage kind={kind} />));
    expect(
      screen.getByRole("heading", { level: 1, name: english }),
    ).toBeDefined();
    expect(screen.getByText("Draft — pending review")).toBeDefined();
    expect(screen.getByText(/has not been legally reviewed/i)).toBeDefined();
    en.unmount();

    render(withMessages(<InformationPage kind={kind} />, ptMessages));
    expect(
      screen.getByRole("heading", { level: 1, name: portuguese }),
    ).toBeDefined();
    expect(screen.getByText("Rascunho — revisão pendente")).toBeDefined();
    expect(screen.getByText(/não passou por revisão jurídica/i)).toBeDefined();
  },
);

test("puts the planned text-only IGDB attribution on About", () => {
  render(withMessages(<InformationPage kind="about" />));

  expect(screen.getByText(/Game data and images provided by/)).toBeDefined();
  expect(screen.getByRole("link", { name: "IGDB" }).getAttribute("href")).toBe(
    "https://www.igdb.com/",
  );
  expect(screen.queryByRole("img")).toBeNull();
});

test.each([
  [
    enMessages,
    [
      "Anonymous usage analytics",
      "Your IP address and request limits",
      "Technical logs",
      "Cookies",
      "Service providers",
    ],
    [
      /Umami Cloud/,
      /six months/,
      /one-way digest/,
      /up to 14 days/,
      /images load directly from IGDB/,
    ],
  ],
  [
    ptMessages,
    [
      "Análise de uso anônima",
      "Seu endereço IP e os limites de requisições",
      "Logs técnicos",
      "Cookies",
      "Prestadores de serviço",
    ],
    [
      /Umami Cloud/,
      /seis meses/,
      /resumo criptográfico/,
      /até 14 dias/,
      /diretamente dos servidores de imagem do IGDB/,
    ],
  ],
] as const)(
  "describes how the closed beta handles data on Privacy",
  (messages, headings, facts) => {
    render(withMessages(<InformationPage kind="privacy" />, messages));

    for (const name of headings) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeDefined();
    }
    for (const fact of facts) {
      expect(screen.getAllByText(fact).length).toBeGreaterThan(0);
    }
  },
);

test.each([
  [enMessages, "/en/about", "/en/privacy", "/en/terms"],
  [ptMessages, "/pt-br/about", "/pt-br/privacy", "/pt-br/terms"],
] as const)(
  "links every information page and attributes IGDB from the localized footer",
  (messages, aboutHref, privacyHref, termsHref) => {
    render(withMessages(<SiteFooter />, messages));

    expect(
      screen
        .getByRole("link", { name: /data sources|fontes de dados/i })
        .getAttribute("href"),
    ).toBe(aboutHref);
    expect(
      screen
        .getByRole("link", { name: /privacy|privacidade/i })
        .getAttribute("href"),
    ).toBe(privacyHref);
    expect(
      screen.getByRole("link", { name: /terms|termos/i }).getAttribute("href"),
    ).toBe(termsHref);
    expect(screen.getByText(/provided by|fornecidos pelo/)).toBeDefined();
  },
);

test("the footer and every information draft have no critical or serious axe violations", async () => {
  for (const view of [
    <SiteFooter key="footer" />,
    <InformationPage key="about" kind="about" />,
    <InformationPage key="privacy" kind="privacy" />,
    <InformationPage key="terms" kind="terms" />,
  ]) {
    const rendered = render(withMessages(view));
    expect(await seriousViolations(rendered.container)).toEqual([]);
    rendered.unmount();
  }
});
