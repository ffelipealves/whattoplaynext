# External Prerequisites

Status: active — owner actions and public-beta blockers remain  
Last reviewed: 2026-09-10

This document records operational due diligence for the working product name,
domain, Twitch application, and IGDB partnership. It is not a legal opinion or
a substitute for a professional trademark search. Domain availability, provider
terms, and registration requirements can change and must be rechecked at the
time of action.

## 1. Gate status

| Area                        | Status                               | Evidence                                                                                                                                                                                                                     | Required next action                                                                                         |
| --------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Product name                | Deferred until public-beta planning  | The phrase is descriptive and several active game-discovery products use materially similar names. Preliminary indexed searches did not surface a conclusive exact-match registration, but they are not trademark clearance. | Before public beta, choose whether to rename and run official searches in the intended launch jurisdictions. |
| Primary domain              | Deferred; current `.com` unavailable | Registry RDAP reported `whattoplaynext.com` as registered on 2024-08-27 and currently held through NameCheap.                                                                                                                | After choosing the public name, recheck and register the selected domain immediately before launch work.     |
| Twitch application          | Complete                             | The owner registered a Twitch application and configured its credentials locally; the M1.10 live smoke test (`pnpm smoke:api`) observed real IGDB data through it on 2026-09-12.                                             | None; credentials must remain in `apps/api/.env`, outside Git.                                               |
| IGDB commercial partnership | Provider response required           | IGDB directs commercial projects to `partner@igdb.com`. No request has been sent or response received.                                                                                                                       | Send the prepared inquiry and retain the written response.                                                   |
| IGDB attribution            | Planned, not approved                | IGDB expects visible, user-facing attribution in a static location for commercial integrations.                                                                                                                              | Confirm the proposed wording and placement in the partnership reply, then implement it before public beta.   |

The public beta remains blocked until the product name/domain decision and the
written IGDB usage confirmation are complete. Milestone 1 engineering may
proceed with locally stored Twitch credentials and provider fakes in automated
tests.

Decision recorded on 2026-09-10: name and domain selection are intentionally
deferred because they do not block provider-independent development. The
working name remains temporary and the public-beta gate remains unchanged.

## 2. Name and domain diligence

### Preliminary findings

Searches for the exact phrase and close variants found a crowded naming space:

- [What2PlayNext](https://what2playnext.com/) targets Steam-library game
  selection;
- [PlayNext](https://playnext.games/) presents game discovery using Steam and
  Twitch data;
- [PlayNext](https://tryplaynext.com/) presents personalized next-game choices;
- [Which Game Next](https://whichgamenext.com/) recommends games from connected
  libraries.

These products are not evidence of trademark ownership by themselves. They do
show a meaningful risk of user confusion and weak search differentiation. The
working phrase is also highly descriptive of the product, which may make it
difficult to distinguish or protect.

The `.com` registration was checked through the Verisign RDAP service at
<https://rdap.verisign.com/com/v1/domain/whattoplaynext.com>. Candidate domains
must not be treated as reserved based on a lookup; availability should be
checked privately immediately before purchase.

### Required decision process

1. Decide whether `What To Play Next` remains only the repository working name
   or becomes the public product name.
2. If renaming, shortlist distinctive names before checking domains so the
   domain does not dictate a weak brand.
3. Search exact and confusingly similar marks in the launch jurisdictions,
   including [INPI](https://busca.inpi.gov.br/pePI/) for Brazil,
   [USPTO](https://tmsearch.uspto.gov/) for the United States, and
   [EUIPO](https://euipo.europa.eu/eSearch/) if launching in the European Union.
4. Have a qualified professional review the result before meaningful brand or
   marketing spend.
5. Register the selected domain and record the owner account, renewal date, and
   recovery method outside the public repository.

## 3. Twitch application checklist

Official references:

- <https://api-docs.igdb.com/#getting-started>;
- <https://dev.twitch.tv/docs/authentication/register-app/>.

The owner must complete these steps in the Twitch Developer Console:

- [ ] Use a Twitch account with verified email and 2FA enabled.
- [ ] Register one application dedicated to this product under its final name.
- [ ] Use `localhost` as the OAuth redirect value for IGDB access, as directed
      by the IGDB setup guide.
- [ ] Set the client type to **Confidential** so a client secret can be created.
- [ ] Generate the Client ID and Client Secret once and save them in an approved
      password or secret manager.
- [ ] Put local values only in `apps/api/.env` as
      `WTPN_TWITCH_CLIENT_ID` and `WTPN_TWITCH_CLIENT_SECRET`.
- [ ] Store production values only in the API host's secret configuration.
- [ ] Record the application owner and creation date without recording either
      credential in Git, issues, logs, screenshots, or documentation.

Creating a new secret invalidates the previous one. Client credentials remain
server-side; the browser never calls Twitch or IGDB directly.

## 4. IGDB partnership inquiry

IGDB's current documentation states that commercial use is available through
its partner program, the API is free for commercial and non-commercial
projects, cached serving is allowed and encouraged, and commercial integrations
are expected to show fair attribution to IGDB.com in a visible static location.
The documented contact is `partner@igdb.com`.

No message has been sent. The owner can use this prepared draft:

```text
Subject: Commercial partnership inquiry — What To Play Next

Hello IGDB team,

I am building a public web application, currently called “What To Play Next”,
that lets users discover games by combining objective criteria such as platform,
genre, release date, rating, game mode, and estimated campaign duration.

The application will access IGDB only from a server-side API, cache normalized
responses to reduce request volume, and will not expose Twitch credentials or
the IGDB API directly to browsers. It may become a monetized product after its
beta period.

Could you please confirm in writing:

1. whether a commercial partnership must be in place before a public or closed
   beta;
2. whether “Game data and images provided by IGDB” with a link to IGDB.com in a
   persistent site footer and an About/Data Sources page is acceptable;
3. whether caching and resizing IGDB images for responsive delivery is allowed,
   and whether you require a particular image-retention policy;
4. whether there are current logo, attribution, or launch-review requirements
   not covered by the public API documentation; and
5. what information you need from me to register the project in the partner
   program.

Thank you,
<owner name>
<contact email>
<planned domain, once selected>
```

Do not commit the sent email or private reply verbatim if it contains personal,
contractual, or account information. Record a dated, non-sensitive decision
summary here and retain the original evidence in private storage.

## 5. Attribution decision

Pending provider confirmation, the implementation target is:

> Game data and images provided by [IGDB](https://www.igdb.com/).

The attribution will appear in the persistent footer of catalog-backed pages
and on the About/Data Sources page. It must remain visible without opening a
changelog or developer-only screen. No IGDB logo will be used until any brand
guidelines and logo permissions are confirmed.

## 6. Evidence to close this increment

- [x] Preliminary product-name and competitor search recorded.
- [x] Primary `.com` registration checked through registry RDAP.
- [x] Current Twitch/IGDB setup requirements recorded from primary sources.
- [x] Commercial contact path and attribution expectation confirmed in current
      IGDB documentation.
- [x] Partnership inquiry prepared without sending it.
- [ ] Public product name approved after appropriate mark review.
- [ ] Final domain registered in the owner's account.
- [x] Twitch application created and credentials stored privately.
- [ ] IGDB inquiry sent and written response retained.
- [ ] Non-sensitive summary of the IGDB response recorded here.

The unchecked items require owner decisions, account access, secret handling, or
external communication and cannot be completed by repository changes alone.
