# Venmo and Zelle deep links for a tappable donation

Research note answering [issue #33](https://github.com/MattPereira/open-caddie/issues/33). Researched 2026-08-10; every URL below was fetched on that date.

Evidence tiers used throughout:

- **DOCUMENTED** — stated in an official Venmo/PayPal/Zelle/Apple/Google document.
- **FIRST-PARTY OBSERVED** — not written down anywhere official, but demonstrated directly by a Venmo- or Zelle-owned server/artifact (HTTP responses, `apple-app-site-association`, page markup) that I fetched myself.
- **UNVERIFIED / community-reported** — only blogs, forums, or inference support it.

---

## Bottom line

- **Venmo has a working universal link.** `https://venmo.com/u/<handle>` is a registered universal-link path in Venmo's own production `apple-app-site-association` file, and `venmo.com` delegates `handle_all_urls` to `com.venmo` on Android. App installed → Venmo app profile; app missing → Venmo's web profile page. **This is the safe button href.** No prefill.
- **Venmo can prefill amount and note**, via a different path: `https://venmo.com/<handle>?txn=pay&amount=25&note=...`. Venmo's own server answers this with a `307` to `venmo://paycharge?amount=…&note=…&recipients=…&txn=pay` for mobile user-agents, and to a web fallback page for desktop. Verified live against `@Heather-Cochnauer`. Risk: on a phone **without** the app, the `venmo://` redirect dead-ends in the browser. Use as a secondary/enhanced link, or accept the risk knowingly.
- **Zelle has no deep link, no universal link, and no web handoff.** Confirmed: Zelle's own FAQ describes generic-camera scans of a Zelle QR as "landing on zellepay.com" to look up your bank, and `enroll.zellepay.com`'s `apple-app-site-association` only ever claimed `/mobile` (checked live and in a 2023 archive). The standalone Zelle app stopped transacting in **March 2025**. So Zelle renders as an **image + copyable text**, never a button.
- **The single most useful Zelle affordance is not the QR — it's the enrolled email/US mobile number as selectable text with a copy button.** A donor reading the landing page on their phone physically cannot scan a QR shown on that same phone; they will retype the token into their bank app.
- **Both QRs are regenerable, but with different confidence.** Venmo: encode `https://venmo.com/u/<handle>` (or `https://venmo.com/code?user_id=<id>`) into your own SVG/high-DPI QR — verified to resolve. Zelle: the payload format is FIRST-PARTY OBSERVED (`https://enroll.zellepay.com/qr-codes?data=<base64 JSON>`), so regeneration is *technically* possible but undocumented — **ask the client for the original full-resolution PNG exported by the "share/print" button in their bank app's Zelle "My Code" screen**, not a crop of the flyer.
- **Terms-of-service caveat worth raising with the client:** PayPal's Acceptable Use Policy (which the Venmo User Agreement incorporates by reference) lists "Collecting donations as a charity or non-profit organization" under **Activities Requiring Approval**. Money flowing to a named individual's *personal* Venmo, described on a public page as a charity donation, sits close to that line. See §1.4.

---

## 1. Venmo

### 1.1 `venmo.com/u/<handle>` — universal link, no prefill

**DOCUMENTED (by Venmo's own associated-domains file).** Venmo publishes `https://venmo.com/.well-known/apple-app-site-association` (fetched 2026-08-10, HTTP 200, `application/json`, 27,615 bytes). The production app entry — `appID: "6DEPQ9SPDK.net.kortina.labs.Venmo"` — lists 117 paths, including:

```
/u/*
/code
/payment/
/account/donation/*/*/*
/profile/qrcode
/qrcode/*
/qrcodes/*
```

There are no negation (`NOT ...`) entries. Per Apple, "When users install your app, iOS checks a file that you've uploaded to your web server to make sure that your website allows your app to open URLs on its behalf," and "only the path component of the URL is used for comparison. Other components, such as the query string or fragment identifier, are ignored" ([Apple, Universal Links](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html), accessed 2026-08-10). Apple also states the fallback explicitly: "Universal links work even when your app is not installed. When your app isn't installed, tapping a link to your website opens the content in Safari, as users expect."

So on iOS: `https://venmo.com/u/Heather-Cochnauer` → Venmo app (profile screen) if installed, → Venmo web profile if not.

**Android.** `https://venmo.com/.well-known/assetlinks.json` (fetched 2026-08-10, HTTP 200) delegates:

```json
{"relation": ["delegate_permission/common.handle_all_urls"],
 "target": {"namespace": "android_app", "package_name": "com.venmo",
            "sha256_cert_fingerprints": ["C7:7E:26:...:C9:47"]}}
```

`handle_all_urls` verifies the whole `venmo.com` domain for `com.venmo`. Android then opens verified links "directly in your app instead of prompting the user or opening the browser" ([Android App Links verification](https://developer.android.com/training/app-links/verify-android-applinks), accessed 2026-08-10). Which *paths* the Android app actually registers intent filters for is not visible from the web side — `assetlinks.json` only grants domain verification. **Not device-tested.**

**Web behaviour (no app / desktop).** `GET https://venmo.com/u/Heather-Cochnauer` returns HTTP 200 directly (no redirect). The page renders the profile — `<title>Heather Cochnauer | @Heather-Cochnauer</title>` — with a call to action reading **"Sign in to pay this person"** and a "Sign in" button to `https://venmo.com/account/sign-in?next=%2Fu%2FHeather-Cochnauer`. Embedded SSR JSON confirms the account: `"id":"1979208104411136355","username":"Heather-Cochnauer","pageType":"personal"`. FIRST-PARTY OBSERVED, 2026-08-10.

Venmo's help centre does **not** document this URL format anywhere I could find; the closest is [Personal QR codes on Venmo FAQ](https://help.venmo.com/cs/articles/personal-qr-codes-on-venmo-faq-vhel316) (accessed 2026-08-10), which says your Venmo QR "can be scanned with another user's Venmo app or device camera to take them to your profile" — i.e. it confirms a URL is encoded, without naming it.

### 1.2 `venmo.com/<handle>?txn=pay&amount=&note=` — prefill, via `venmo://paycharge`

This is the format usually cited as community lore. It is **FIRST-PARTY OBSERVED**: Venmo's own edge emits the `venmo://paycharge` URL. Exact traces, 2026-08-10:

```
$ curl -sD- -o/dev/null -A "<iPhone Safari UA>" \
  "https://venmo.com/Heather-Cochnauer?txn=pay&amount=25&note=Charity%20donation"
HTTP/2 302
location: https://account.venmo.com/Heather-Cochnauer?txn=pay&amount=25&note=Charity%20donation
HTTP/2 307
location: venmo://paycharge?amount=25&note=Charity+donation&recipients=Heather-Cochnauer&txn=pay
```

Behaviour by user-agent on the second hop (`account.venmo.com/<handle>?...`):

| UA | Response |
| --- | --- |
| iPhone Safari 17 | `307 → venmo://paycharge?amount=25.00&note=Golf+scramble&recipients=Heather-Cochnauer&txn=pay` |
| Android Chrome (Pixel 8) | `307 → venmo://paycharge?...` (identical) |
| macOS Chrome | `307 → https://account.venmo.com/payment-link?amount=25.00&note=Golf%20scramble&recipients=Heather-Cochnauer&txn=pay` |

Parameter behaviour, all FIRST-PARTY OBSERVED:

- `txn=pay` and `txn=charge` both work; `txn=charge` produces `venmo://paycharge?amount=5&recipients=…&txn=charge` (a request rather than a payment).
- `amount` and `note` are both optional. `?txn=pay` alone → `venmo://paycharge?recipients=Heather-Cochnauer&txn=pay`.
- **`txn` is the trigger.** Without it, `account.venmo.com/<handle>` → `307 → /u/<handle>` (plain web profile).
- **The prefill does not work on the `/u/` path.** `https://venmo.com/u/Heather-Cochnauer?txn=pay&amount=5` returns HTTP 200 web profile with no redirect and no reflected amount. This matters: the universal-link path and the prefill path are mutually exclusive.
- Spaces in `note` are re-encoded as `+`. Multi-recipient (`recipients=a,b`) is UNVERIFIED — I did not test it and Venmo documents nothing.

**Desktop fallback page.** `https://account.venmo.com/payment-link?amount=25.00&note=Golf%20scramble&recipients=Heather-Cochnauer&txn=pay` renders a Venmo-branded page reading: *"Heather Cochnauer @Heather-Cochnauer / Sign in to pay Heather Cochnauer / $25.00 / Note from Heather Cochnauer: Golf scramble / Or create your Venmo account."* So the amount and note **do** survive to a signed-out web view. Same content returned for iPhone and desktop UAs when requested directly. FIRST-PARTY OBSERVED, 2026-08-10.

**Whether `venmo://paycharge` actually opens a prefilled payment sheet in the installed app is NOT device-tested here** — I verified only that Venmo's servers generate the URL. Given Venmo generates it themselves for mobile traffic, this is strong but not conclusive.

**Known risk.** `account.venmo.com` is *not* covered for these paths by associated domains — its `apple-app-site-association` (fetched 2026-08-10) lists only `/go/web/paypal` and `/go/checkout/wallet-network`. So the prefill flow is a plain HTTP redirect into a custom scheme, not a universal link. On a mobile browser where Venmo is not installed, the `venmo://` hop fails (Safari surfaces an "address is invalid" style error). Apple explicitly contrasts this: universal links are "Unique. Unlike custom URL schemes, universal links can't be claimed by other apps."

### 1.3 Other formats

| Format | Status | Evidence |
| --- | --- | --- |
| `https://venmo.com/u/<handle>` | **FIRST-PARTY OBSERVED / effectively documented** — path present in production AASA | Venmo AASA, live 200 |
| `https://venmo.com/<handle>` (bare) | **FIRST-PARTY OBSERVED** — `301/302 → account.venmo.com/u/<handle>`; *not* an AASA path, so no universal link | live trace |
| `https://venmo.com/<handle>?txn=pay\|charge&amount=&note=` | **FIRST-PARTY OBSERVED** — server emits `venmo://paycharge`; undocumented | live trace, §1.2 |
| `https://venmo.com/code?user_id=<id>` | **FIRST-PARTY OBSERVED** — `/code` is an AASA path; `venmo.com/code?user_id=1979208104411136355` → `account.venmo.com/u/Heather-Cochnauer` (HTTP 200) | live trace + AASA |
| `venmo://paycharge?txn=…&recipients=…&amount=…&note=…` | **FIRST-PARTY OBSERVED** — generated by Venmo's own 307 | live trace |
| `venmo://appBanner` | **FIRST-PARTY OBSERVED** — in Venmo's own `<meta name="apple-itunes-app">` | profile page markup |
| `https://account.venmo.com/payment-link?...` | **FIRST-PARTY OBSERVED** — desktop fallback target | live trace |
| `https://account.venmo.com/code?user_id=` | **DOCUMENTED-ish** — Venmo's own profile page sets `al:ios:url`, `al:iphone:url`, `al:android:url`, `twitter:app:url:iphone` and `apple-itunes-app` `app-argument` to this value | profile page markup |
| Any of the above in Venmo help/developer docs | **Not documented.** No Venmo help-centre article names any URL format; `developer.venmo.com` is HTTP 404 | live probe |

The Venmo profile page's own App Links metadata (fetched 2026-08-10):

```html
<meta property="al:ios:url" content="https://account.venmo.com/code?user_id=" />
<meta property="al:android:url" content="https://account.venmo.com/code?user_id=" />
<meta property="al:android:package" content="com.venmo" />
<meta property="apple-itunes-app" content="app-id=351727428 app-argument=https://account.venmo.com/code?user_id=" />
```

(The `user_id` value is empty in the server-rendered HTML for a signed-out fetch; it is presumably filled client-side. The *shape* is what matters.)

### 1.4 Terms of service — linking to a personal Venmo for a charity donation

Sources: [Venmo User Agreement](https://venmo.com/legal/us-user-agreement) and the [PayPal Acceptable Use Policy](https://www.paypal.com/us/webapps/mpp/ua/acceptableuse-full) (redirects to `https://www.paypal.com/us/legalhub/paypal/acceptableuse-full`), which the User Agreement incorporates by reference. Both accessed 2026-08-10.

**There is no clause prohibiting a third-party website from linking to a personal Venmo account.** I read the "Restricted Activities" list in full; nothing addresses inbound links, embedding, or QR codes. **Contradicted:** any claim that linking itself is a TOS violation.

**The real constraint is on the account type, not the link.** From the User Agreement, *Opening a Venmo Account*:

> "Except for commercial transactions expressly authorized by Venmo, for example, transactions with authorized merchants or business profiles, purchases made using your Venmo Mastercard®, or transactions that are identified as payments for goods and services, personal accounts and Teen Accounts may not be used to conduct business, commercial or merchant transactions with other personal accounts or Teen Accounts, which includes paying or accepting payment from other personal accounts or Teen Accounts held by users you do not personally know for goods or services."

And in *Restricted Activities*:

> "Use your personal account or a Teen Account to conduct transactions for goods or services with other personal accounts or Teen Accounts, except as expressly authorized by Venmo"

A donation is not a payment for goods or services, so on its face a personal-account donation is an ordinary personal payment and is permitted.

**But the Acceptable Use Policy places charity fundraising under pre-approval.** From *Activities Requiring Approval*:

> "PayPal requires pre-approval to accept payments for certain items and services as detailed below."

and, row 2 of that table:

> "Charities / Non-Profit — Collecting donations as a charity or non-profit organization."

The AUP's prohibited list also covers transactions that:

> "relate to transactions involving any activity that requires pre-approval without having obtained said approval."

Venmo's sanctioned route for donations is a **charity profile**, which requires a PayPal-confirmed 501(c)(3). From the User Agreement:

> "We may also offer you the ability to link a PayPal confirmed charity account to your Venmo account to create a Venmo charity profile, which you can use to receive donations through Venmo."

and, by warranty:

> "you are, and at all times during the term of this Agreement will remain, an organization eligible to receive tax-deductible charitable contributions with Private Operating Foundation or Public Charity status described in sections 501(c)(3) and 509(a) of the Code … you will at all times use our Services in compliance with all applicable laws, rules and regulations, including any requirements governing charitable status and solicitation of charitable donations"

Charity profiles are charged 1.9% + $0.10 per donation ([Receiving Donations FAQ](https://help.venmo.com/cs/articles/receiving-donations-faq-vhel180), accessed 2026-08-10). Note also that donations are **excluded from Venmo Purchase Protection** — the User Agreement lists "Donations, including payments to Venmo charity profiles, payments on crowdfunding platforms as well as payments made on crowdlending platforms" among ineligible transactions.

**Reading for this ticket.** A named individual collecting money on behalf of an event, into a personal account, is not "collecting donations *as* a charity or non-profit organization" on a literal reading — the AUP row is scoped to the organisation. But a public landing page that frames it as a charity donation makes that reading harder to defend, and Venmo can act on this at its sole discretion (freeze, hold funds up to 180 days). **Recommendation: word the page as a personal payment to a named person who is collecting for the cause (e.g. "Send your donation to Heather"), not as "Donate to <charity>", unless the charity has an actual Venmo charity profile — in which case use that profile's handle instead.** This is a judgement call, not a legal finding; flag it to the client.

### 1.5 Venmo developer/API situation (context only)

- `https://developer.venmo.com/` → **HTTP 404** (probed 2026-08-10). There is no public Venmo payments API.
- The only supported programmatic integration is **Pay with Venmo via Braintree / PayPal Checkout**: [Braintree Venmo overview](https://developer.paypal.com/braintree/docs/guides/venmo/overview) (accessed 2026-08-10) states you "can use Venmo for payments only with United States-based business entities," requires the Braintree client SDKs, and does not support paying an individual personal Venmo account. Venmo also "does not work when loaded within an iframe element."
- `https://venmo.com/developers/` exists but is business-profile marketing, not API docs.

**Conclusion: a "proper" integration is not available for this use case.** Deep link or QR is the only option.

---

## 2. Zelle — no deep link, no universal link, no web handoff

**Confirmed. The working assumption in the ticket is correct.**

### 2.1 No associated-domain / app-link surface for payments

- `https://enroll.zellepay.com/.well-known/apple-app-site-association` (fetched 2026-08-10, HTTP 200) claims exactly **one** path for both app IDs (`HHEB3LK84D.com.zellepay.zelle` and a QA build): `/mobile`. Nothing for `/qr-codes`, no send/pay path.
- The same file archived at [web.archive.org 2023-01-03](https://web.archive.org/web/20230103073939id_/https://enroll.zellepay.com/.well-known/apple-app-site-association) is **byte-identical in structure** — `/mobile` only. So even while the standalone app was alive and transacting, Zelle QR URLs were never universal links.
- `https://enroll.zellepay.com/.well-known/assetlinks.json` delegates to `com.zellepay.zelle` / `com.zellepay.zelle.qa` and to the web target `https://enroll.zellepay.com/mobile`. Again nothing payment-related.
- `www.zelle.com/.well-known/apple-app-site-association` returns an HTML error page, not JSON.

### 2.2 Zelle's own FAQ describes the generic-scan outcome as a dead end

From [Using Zelle® FAQ](https://www.zelle.com/faq/using-zelle) (accessed 2026-08-10), two FAQ entries are titled:

> "After scanning a Zelle® QR code and landing on zellepay.com, I located my bank, but it says the ability to use a Zelle® QR code is coming soon. Now what do I do?"

with the answer:

> "Your bank or credit union does not offer Zelle® QR code yet. Until it does, you can still send money to those you know and trust by opening your banking app and sending money using the recipient's U.S. mobile number or email address."

and:

> "When in doubt, open your bank or credit union app and navigate to Zelle®. If your bank or credit union offers Zelle® QR code, you will be able to click the QR code icon displayed at the top of the 'Select Recipient' screen, scan the QR code and send money."

This is Zelle stating, in its own words, that scanning a Zelle QR with a generic camera lands you on a **web page that tells you to go find your bank app**. There is no handoff.

From [How do I use a Zelle® QR code?](https://www.zelle.com/support/how-do-i-use-zelle-qr-code) (accessed 2026-08-10): "The QR code is not available at all Financial Institutions." And on finding your own: "click the 'My Code' tab. From here you can view your QR code and use the print and share icons to text, email or print your Zelle® QR code."

### 2.3 Standalone Zelle app: discontinued

From Zelle's own blog post, [We're Evolving How Consumers Send Money With Zelle®](https://www.zelle.com/blog/were-evolving-how-consumers-send-money-zelle) (accessed 2026-08-10):

> "Over the next few months, we will be phasing out the ability to enroll and transact within the standalone app."

Users had "until March 2025 to re-enroll at another financial institution," and afterwards "the app will be dedicated to consumer education about scams and fraud and provide a list of the more than 2,200 banks and credit unions that offer Zelle." The post was published in **October 2024**; transacting ended **March 2025**. Nothing replaced it — the replacement is "your bank's app."

**What this means for QR codes generated in the old app:** the blog post says nothing about QR codes. A QR generated by the old standalone app encodes the enrolled token (see §3), and the token — an email address or US mobile number — survives the app shutdown *only if the person re-enrolled that same token at a bank*. If they re-enrolled with a different email/phone, an old QR points at a stale or unenrolled token. **UNVERIFIED whether Zelle invalidates old QR payloads; there is no primary statement either way.** Practical consequence: any Zelle QR of uncertain provenance must be re-confirmed with the client.

### 2.4 Early Warning Services

[Early Warning](https://www.earlywarning.com/topics/zelle) (accessed 2026-08-10) publishes partner/OpenAPI material for **financial institutions**, not for websites. There is no public developer portal documenting a consumer-facing Zelle link, deep link, or QR spec. `developer.zellepay.com` produced no results.

**Verdict: Zelle renders as a static image plus copyable text. Not a button.**

---

## 3. What a Zelle QR code actually encodes

**There is no primary Zelle document describing the payload.** Zelle's help pages describe only the user-visible behaviour. Stating that plainly, per the ticket's instruction.

However, the payload is **FIRST-PARTY OBSERVED** with high confidence, because the URLs live on Zelle's own domain and have been captured by the Internet Archive in large numbers. A CDX query for `enroll.zellepay.com/qr-codes*` (run 2026-08-10) returns hundreds of distinct real captures of the form:

```
https://enroll.zellepay.com/qr-codes?data=<base64>
```

Decoding several (2023–2026 captures):

```json
\n{\n    "token": "12156058774",\n    "name": "Gotwald Creation Inc",\n    "action": "payment"\n}
\n{\n    "token": "treasurer@rainbowhistory.org",\n    "name": "Rainbow History Project",\n    "action": "payment"\n}
\n{\n    "token": "zelle@newdestinywc.com",\n    "name": "New Destiny Worship Center Inc",\n    "action": "payment"\n}
```

An older/compact variant also appears (2023 capture): `{"name":"SHELLY","token":"8563816335"}` — no `action` key, no whitespace. So there is at least one format variant; bank apps evidently generate slightly different serialisations.

So, to the extent it can be established:

- The QR encodes a **plain HTTPS URL** on `enroll.zellepay.com`, not an opaque token or an enrolment identifier.
- The `data` query parameter is **standard base64** (sometimes percent-encoded, `=` → `%3D`) of a small JSON object.
- The JSON carries the recipient's **Zelle enrolment token in the clear** — the US mobile number or email address they enrolled — plus a display `name` and usually `"action": "payment"`.
- No amount, no note, no memo field appears in any sample. **A Zelle QR cannot carry an amount.**

**Privacy note worth raising:** because the token is in the clear, publishing a Zelle QR on a public landing page publishes the client's email address or mobile number in machine-readable form. Confirm they are comfortable with that.

**Critically, the URL is inert on the web.** Fetching `https://enroll.zellepay.com/qr-codes?data=<valid-format base64>` on 2026-08-10 (iPhone UA) returns HTTP 200 with the *"Find Your Bank | Zelle Enroll"* bank directory and **zero occurrences of the encoded name** — the `data` parameter is ignored entirely by the current page, and the page's JS bundles contain no `data`/QR handling. The 2022-02-25 archived snapshot of that page was also just the bank directory. Note too that `https://www.zelle.com/qr-codes` itself `301`s to `https://enroll.zellepay.com/qr-codes/?data=s`, a vestigial literal `s`.

The payload is therefore parsed **inside the bank app's own QR scanner**, never by a browser.

---

## 4. Regenerating the QR images

### 4.1 Venmo — yes, regenerate it

- **No official QR endpoint exists.** `venmo.com/qrcode/<id>`, `venmo.com/profile/qrcode`, `api.venmo.com/v1/qr-codes` all return **HTTP 404** unauthenticated (probed 2026-08-10). The AASA reserves `/profile/qrcode`, `/qrcode/*`, `/qrcodes/*` for the app, but nothing is publicly served.
- **The branded "Venmo code."** Archived real-world captures show the app's QR encodes `https://venmo.com/code?user_id=<19-digit id>&created=<epoch>`, e.g. `https://venmo.com/code?user_id=2514685249191936495&created=1627675451` and `…user_id=3341082993623040077&created=1630536699.003968` (Internet Archive CDX for `venmo.com/code*`, queried 2026-08-10). `/code` is a production AASA path, and `https://venmo.com/code?user_id=1979208104411136355` resolves live to `https://account.venmo.com/u/Heather-Cochnauer` (HTTP 200) — that is `@Heather-Cochnauer`'s real user id, read from her profile page's SSR JSON.
- **A generic URL QR works too.** Venmo's help centre confirms the QR "can be scanned with another user's Venmo app or device camera to take them to your profile" ([Personal QR codes FAQ](https://help.venmo.com/cs/articles/personal-qr-codes-on-venmo-faq-vhel316)) — i.e. resolution happens through the URL and the OS, not a proprietary symbology. Encoding `https://venmo.com/u/Heather-Cochnauer` yourself gives the same universal-link behaviour on a native camera scan.

**Recommendation for Venmo:** generate your own QR from `https://venmo.com/u/Heather-Cochnauer` as **SVG** (or ≥1024px PNG) at build time. Prefer `/u/<handle>` over `/code?user_id=<id>`: it is human-readable, survives if the numeric id is ever rotated, and hits the same AASA-registered path family. Do **not** crop the flyer.

*Caveat, UNVERIFIED:* whether Venmo's **in-app** "Scan" scanner accepts a generic `venmo.com/u/<handle>` QR (as opposed to the native camera opening it via universal link) is not device-tested. Only the branded `/code?user_id=` form is known to be what the app itself produces. If in-app scanning matters, use `https://venmo.com/code?user_id=1979208104411136355` instead — it is verified to resolve to the right profile.

### 4.2 Zelle — technically possible, but use the client's original

Given §3, you *could* construct `https://enroll.zellepay.com/qr-codes?data=` + base64 of `{"token": "<their email or mobile>", "name": "<Their Name>", "action": "payment"}` and render it at any resolution.

**Do not do this for a live client event.** Reasons:

1. The format is undocumented and Zelle owes you no stability guarantee; a serialisation difference (whitespace, key order, missing `action`) could make a bank app reject it, and you cannot test it without the client's actual bank app.
2. The `name` must presumably match the recipient's Zelle-registered name; you would be guessing at their bank's exact casing/spelling.
3. Failure mode is silent and expensive — the donor's bank app just says the code is invalid, at the event, with no way to debug.

**Ask the client for:** the QR exported from the **share or print icon on the "My Code" tab** inside their bank app's Zelle screen — Zelle documents that this exists ("use the print and share icons to text, email or print your Zelle® QR code"). Request the emailed/AirDropped original PNG at full resolution, plus the **enrolled email address or US mobile number in plain text** and the name shown on the code. The plain-text token is the more important artefact; it also lets you sanity-check the QR by decoding the `data` parameter yourself and confirming it matches.

If the client can only produce a flyer crop: render it small and de-emphasised, and lead with the plain-text token.

### 4.3 Practical recommendation for the landing page

```
Venmo  →  <a href="https://venmo.com/u/Heather-Cochnauer">  ← primary button; universal link both platforms
          optional secondary: ?txn=pay&note=… on the bare-handle path for prefill (see §1.2 risk)
          QR: self-generated SVG of https://venmo.com/u/Heather-Cochnauer

Zelle  →  no button. Render:
          1. the enrolled email / mobile as large selectable text + a "Copy" button   ← the thing that actually works on-phone
          2. the client's original QR PNG, sized for a second-device scan
          3. one line of copy: "Open your bank's app and find Zelle"
```

Rationale for the Zelle ordering: a donor holding the phone that displays the page cannot scan a QR on that same screen, and Zelle offers no link to hand off with. The copyable token is the only affordance that survives that constraint.

---

## Open questions / what could not be verified

1. **Device behaviour is untested end to end.** Every Venmo claim rests on Venmo's own AASA/assetlinks and live HTTP traces, not on a physical iPhone/Android with the app installed. Before launch, test on one real iPhone and one real Android: (a) `venmo.com/u/<handle>` opens the app; (b) `venmo.com/<handle>?txn=pay&note=…` opens a prefilled payment sheet; (c) what iOS Safari actually shows when the app is absent.
2. **`venmo://paycharge` semantics inside the app** — whether the app confirms before sending, whether `note` has a length limit, whether `amount` accepts more than 2 decimals — all UNVERIFIED. Venmo documents none of it.
3. **Multi-recipient `recipients=a,b`** — UNVERIFIED, untested.
4. **Which Android paths `com.venmo` actually registers** — invisible from the web; `handle_all_urls` only proves domain verification.
5. **Zelle QR payload format is not officially documented.** The evidence is strong (hundreds of first-party URLs on `enroll.zellepay.com`, consistent 2023–2026) but Zelle has published nothing, and at least two serialisation variants exist. Treat regeneration as unsupported.
6. **Fate of QR codes generated in the discontinued standalone Zelle app** — no primary statement. If the client's QR predates March 2025, re-confirm the token is still enrolled.
7. **Whether Venmo's in-app scanner accepts a self-generated `venmo.com/u/<handle>` QR** — UNVERIFIED (see §4.1).
8. **The charity/personal-account TOS question is a judgement call**, not a settled reading. The AUP pre-approval row is scoped to organisations; nothing squarely addresses an individual collecting for a cause. If the charity has its own Venmo charity profile, using it removes the ambiguity entirely — worth one question to the client.
9. **Venmo QR "Venmo me" vs "Show to pay"** — the help FAQ names two QR types; only the "Venmo me" (profile) type is relevant here, and only its behaviour was researched.

---

## Sources

All accessed 2026-08-10.

**Venmo / PayPal**
- Venmo associated domains (live artefact): https://venmo.com/.well-known/apple-app-site-association
- Venmo Digital Asset Links (live artefact): https://venmo.com/.well-known/assetlinks.json
- account.venmo.com associated domains: https://account.venmo.com/.well-known/apple-app-site-association
- Venmo User Agreement: https://venmo.com/legal/us-user-agreement
- PayPal Acceptable Use Policy (incorporated by the Venmo User Agreement): https://www.paypal.com/us/webapps/mpp/ua/acceptableuse-full → https://www.paypal.com/us/legalhub/paypal/acceptableuse-full
- Personal QR codes on Venmo FAQ: https://help.venmo.com/cs/articles/personal-qr-codes-on-venmo-faq-vhel316
- Charity Profile Account Settings: https://help.venmo.com/cs/articles/charity-profile-account-settings-vhel199
- Receiving Donations FAQ: https://help.venmo.com/cs/articles/receiving-donations-faq-vhel180
- Braintree — Venmo overview (merchant integration): https://developer.paypal.com/braintree/docs/guides/venmo/overview
- `https://developer.venmo.com/` — HTTP 404 (probed)
- Live HTTP traces against `venmo.com/u/Heather-Cochnauer`, `venmo.com/Heather-Cochnauer?txn=…`, `venmo.com/code?user_id=…`, `account.venmo.com/payment-link?…`

**Zelle / Early Warning**
- Using Zelle® FAQ: https://www.zelle.com/faq/using-zelle
- How do I use a Zelle® QR code?: https://www.zelle.com/support/how-do-i-use-zelle-qr-code
- We're Evolving How Consumers Send Money With Zelle® (standalone app phase-out): https://www.zelle.com/blog/were-evolving-how-consumers-send-money-zelle
- Zelle enrolment associated domains (live artefact): https://enroll.zellepay.com/.well-known/apple-app-site-association
- Zelle enrolment Digital Asset Links (live artefact): https://enroll.zellepay.com/.well-known/assetlinks.json
- Same AASA archived 2023-01-03: https://web.archive.org/web/20230103073939id_/https://enroll.zellepay.com/.well-known/apple-app-site-association
- Zelle QR landing page: https://enroll.zellepay.com/qr-codes (and 2022 snapshot https://web.archive.org/web/20220225030920id_/https://enroll.zellepay.com/qr-codes)
- Internet Archive CDX index of real `enroll.zellepay.com/qr-codes?data=` captures: https://web.archive.org/cdx/search/cdx?url=enroll.zellepay.com%2Fqr-codes*&fl=timestamp,original&collapse=urlkey
- Early Warning — Zelle: https://www.earlywarning.com/topics/zelle

**Platform**
- Apple, Universal Links (associated domains, path matching, no-app fallback): https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html
- Apple, Supporting associated domains: https://developer.apple.com/documentation/xcode/supporting-associated-domains
- Android, Verify Android App Links: https://developer.android.com/training/app-links/verify-android-applinks
