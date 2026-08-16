// Landing-page copy for the Driven to Serve fundraiser.
//
// Committed here rather than stored on the `scrambles` row: the copy is
// authored once and never edited by an organizer, so a static module keeps the
// public page independent of the database. Colocated with the only route that
// reads it; types are inferred rather than declared.

// Venmo prefills only from the bare-handle form with `txn=pay`; the `/u/<handle>`
// form opens the app without prefilling. `amount` is deliberately omitted so the
// donor chooses. See docs/research/venmo-zelle-deep-links.md.
// Registration runs entirely through one phone call, so the number is printed
// twice: once against the RSVP deadline it satisfies, once in the closing line
// that catches sponsors and everything else.
const contactPhone = "510-426-1854";
const contactPhoneHref = "tel:+15104261854";

const venmoDonateHref =
  "https://venmo.com/Heather-Cochnauer?txn=pay&note=Driven%20to%20Serve";

export const event = {
  handle: "driven-to-serve",
  name: "Driven to Serve",
  kicker: "Golf tournament fundraiser",
  narrative:
    "Join us as we rally around Fire Captain Derek Cochnauer, who has dedicated his life to protecting our community. Recently diagnosed with cancer, we are coming together to support him and his family.",
  narrativeHighlight: "Derek Cochnauer",
  proceeds: "All proceeds benefit Captain Derek Cochnauer & his family",
  heroImage: "/events/hero-a-desktop.jpg",
  heroImageMobile: "/events/hero-a-mobile.jpg",
  heroAlt: "A firefighter watching over a controlled grass burn",
  ogSourceImage: "/events/fireman-tournament.jpeg",
  // Venmo is the page's one donate button, because it is the only method that
  // survives a tap: `venmo.com/<handle>?txn=pay` hands off to the app. Zelle has
  // no deep link at all (docs/research/venmo-zelle-deep-links.md), so it lives
  // in `donateMethods` below as a QR to scan, never as a button that dead-ends.
  donate: { label: "Donate with Venmo", href: venmoDonateHref },
  // Both codes are cropped from the recipient's own exports — her Venmo code
  // and her bank's Zelle "My Code" screen — down to the symbol itself. The crop
  // drops the wordmark each export carried, which is why `name` exists: with it
  // gone, a bare symbol says nothing about which app opens it, and the Zelle
  // crop in particular is indistinguishable from any other QR code. Intrinsic
  // sizes are recorded rather than guessed at the call site.
  donateMethods: [
    {
      name: "Venmo",
      image: "/events/venmo-code.jpg",
      alt: "Venmo QR code for @Heather-Cochnauer",
      width: 605,
      height: 607,
      instruction: "Scan with mobile camera",
    },
    {
      name: "Zelle",
      image: "/events/zelle-code.jpg",
      alt: "Zelle QR code for Heather Cochnauer",
      width: 570,
      height: 574,
      instruction: "Open banking app, find Zelle, then scan",
    },
  ],
  // Where, when, and what it costs — the three things a reader checks before
  // deciding. The flyer's separate "format" panel is folded into Entry's
  // detail line: the scramble matters, but not enough to spend a card on.
  facts: [
    {
      label: "When",
      value: "Saturday, September 19",
      detail: "7:30 check-in · 8:00 shotgun start",
    },
    {
      label: "Where",
      value: "Blue Rock Springs Golf Course",
      detail: "655 Columbus Parkway, Vallejo, CA 94591",
    },
    {
      label: "Entry",
      value: "$175 per player",
      detail: "$700 per foursome · Four-player scramble",
    },
    // `as const` so the labels stay literal and the page can key its icons off them.
  ] as const,
  // Second band: the deadline that forces a decision, then what the entry fee
  // actually buys. RSVP leads because it is the only item here with a clock on
  // it — the other two are reasons to say yes once the date has landed.
  extras: [
    {
      label: "RSVP by",
      value: "September 10",
      detail: "Call Samuel White at",
      detailLink: { label: contactPhone, href: contactPhoneHref },
    },
    {
      label: "Contests & Prizes",
      value: "Longest drive · Closest to the pin",
      detail: "Raffles and more throughout the day",
    },
    {
      label: "Lunch & Dinner",
      value: "BBQ lunch · Awards dinner",
      detail: "Included with every entry",
    },
  ] as const,
  registration: {
    contactName: "Samuel White",
    contactPhone,
    contactPhoneHref,
  },
  sponsorTiers: [
    {
      name: "Bronze",
      price: "$500",
      benefits: [
        "Recognition on event signage",
        "Social media recognition",
        "Name listed in program",
      ],
    },
    {
      name: "Silver",
      price: "$1,000",
      benefits: [
        "All Bronze benefits",
        "Logo on signage",
        "Name listed in program",
      ],
    },
    {
      name: "Gold",
      price: "$2,000",
      benefits: [
        "All Silver benefits",
        "Premium logo placement",
        "Sponsor banner at event",
        "Foursome included",
      ],
    },
    {
      name: "Premium",
      price: "$2,000+",
      benefits: ["Anything above Gold is considered a Premium Sponsor"],
    },
  ],
  metaTitle: "Golf Fundraiser for Captain Derek Cochnauer",
  metaDescription:
    "A golf tournament fundraiser supporting Rodeo-Hercules Fire Captain Derek Cochnauer and his family. Saturday, September 19, 2026 at Blue Rock Springs in Vallejo.",
  ogKicker: "Sat Sept 19, 2026 · Vallejo, CA",
};
