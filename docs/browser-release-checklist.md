# Browser Release Checklist

Status: prepared on 2026-09-27; no release-time pass recorded yet
Requirement: NFR-013, the two latest stable releases of Chrome, Edge,
Firefox, and Safari at release time
Tracks: [technical debt 14](technical-debt.md#14-no-retail-browser-has-been-checked--blocking-for-closed-beta)

The automated browser matrix drives the engines Playwright ships, which are
not the browsers visitors install. This checklist closes that gap at release
time, against the build testers will actually use: the closed-beta preview
deployment, not a local build.

## 1. Coverage plan

| Browser | Current stable                         | Previous stable                    | How                                |
| ------- | -------------------------------------- | ---------------------------------- | ---------------------------------- |
| Chrome  | Automated: `pnpm e2e:branded`          | Manual, or a cloud browser service | Playwright `chrome` channel        |
| Edge    | Automated: `pnpm e2e:branded`          | Manual, or a cloud browser service | Playwright `msedge` channel        |
| Firefox | Manual, with this checklist            | Manual                             | Firefox as downloaded from Mozilla |
| Safari  | **Owed**: no Apple device is available | **Owed**                           | A Mac or iPhone, or a paid service |

The automated projects run all 37 Playwright journeys in the installed Chrome
and Edge, at a desktop viewport and with their real user agents:

```bash
# once, on Linux or WSL
cd apps/web && sudo env "PATH=$PATH" npx playwright install chrome msedge
# each release candidate, against the preview deployment
E2E_BASE_URL=https://<preview-origin> pnpm e2e:branded
```

Against a deployment the analytics journeys need the recording stub, so run
them only locally (`pnpm e2e:branded` without `E2E_BASE_URL`). The other
journeys are fixture-independent only where they do not rely on fixture
sentinels such as `trigger-upstream-failure`. Treat those failures as expected
against a real catalog and cover the states they exercise in the manual pass.

Playwright's channels give only the current stable release. The previous
stable release of each browser needs either an older installer kept for the
purpose or a cloud browser service. Choosing between them is a cost decision
for the release.

## 2. Manual journeys

Run each in both locales unless noted. For each browser, keep the developer
tools console open and note any error, including Content Security Policy
reports.

1. **Home.** `/en` and `/pt-br` load with the live catalog summary and no
   console errors.
2. **Name search with autocomplete.** Type a known title slowly, then quickly.
   Suggestions appear after a short pause, can be chosen with the arrow keys
   and Enter, and choosing one only fills the field.
3. **Submit the search.** Results, count, and the URL all reflect the name.
4. **Filters on desktop.** Check a platform and a genre in the sidebar; nothing
   changes until Apply; then the URL, count, and active-filter chips change.
5. **Filters on a narrow window.** Resize below the tablet width, or use a
   phone: open the Filters drawer, apply, and confirm it closes and the
   results update.
6. **Chips, sort, pagination.** Remove one chip, change the sort, go to page
   2; each is a link and survives a reload.
7. **Shared link and history.** Copy the URL into a new window: the same
   search and page appear. Back and forward move between searches correctly.
8. **Zero results.** Search for a nonsense title: the page says nothing matched
   and suggests a way out, rather than an error.
9. **Game page.** Open a result: the canonical URL, cover, summary, ratings,
   durations, releases, and screenshots render; the screenshot viewer opens,
   advances, and closes with the keyboard; Back restores the same search.
10. **External link.** An external link opens in a new tab and leaves the game
    page as it was.
11. **Language switch.** Switching locale on a search or game page keeps the
    same content in the other language.
12. **Keyboard only.** Repeat journeys 2, 4, and 9 without a mouse: every
    control is reachable, focus is always visible, and nothing traps focus.

## 3. Record

Add one row per browser and version tested. A journey is only “pass” if it
completed without a console error.

| Date | Browser | Version | OS / device | Build (commit) | Journeys passed | Tester | Notes |
| ---- | ------- | ------- | ----------- | -------------- | --------------- | ------ | ----- |

Technical debt 14 closes once every row the coverage plan requires reads pass
for the release candidate. Safari stays owed until an Apple device or a paid
service is available.
