import type { Metadata } from "next";
import Image from "next/image";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Calendar01Icon, Call02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { appPageIcons } from "@/components/layout/app-nav-items";
import { event } from "./content";

export const metadata: Metadata = {
  title: { absolute: event.metaTitle },
  description: event.metaDescription,
  openGraph: {
    type: "website",
    title: event.metaTitle,
    description: event.metaDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: event.metaTitle,
    description: event.metaDescription,
  },
};

export default function EventPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <section className="relative isolate overflow-hidden">
        <Image
          src={event.heroImage}
          alt={event.heroAlt}
          fill
          priority
          className="object-cover object-top opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/45 to-neutral-950/20" />
        <div className="relative mx-auto max-w-6xl px-5 pt-64 pb-16 sm:px-8 sm:pt-56">
          {/* One column so every element in the hero shares the same width. */}
          <div className="flex w-full flex-col gap-4 lg:w-1/2 lg:min-w-[34rem]">
            <h1 className="font-[family-name:var(--font-poster)] text-6xl leading-[0.95] sm:text-[6.5rem]">
              {event.name}
            </h1>
            <p className="flex items-center justify-between gap-3 bg-[linear-gradient(to_right,transparent_0,#8e1c1c_2.5rem,#8e1c1c_calc(100%-2.5rem),transparent_100%)] px-6 py-1.5 font-[family-name:var(--font-poster)] text-xl tracking-[0.08em] whitespace-nowrap text-neutral-50 uppercase sm:px-10 sm:text-3xl sm:tracking-[0.12em]">
              <Star />
              {event.kicker}
              <Star />
            </p>
            <p className="text-lg leading-relaxed text-neutral-200 sm:text-xl">
              <Highlighted
                text={event.narrative}
                highlight={event.narrativeHighlight}
              />
            </p>
            {/* Button and its caption travel together, tighter than the hero gap. */}
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-2 sm:gap-3">
                {event.donations.map(({ label, href }) => (
                  <Button
                    key={href}
                    size="xl"
                    className="w-full border-neutral-50/30 bg-transparent text-neutral-50 [a]:hover:bg-neutral-50/10 sm:h-14 sm:rounded-xl sm:text-lg"
                    asChild
                  >
                    <a href={href} target="_blank" rel="noreferrer">
                      {label}
                    </a>
                  </Button>
                ))}
              </div>
              <Proceeds proceeds={event.proceeds} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-5 pt-0 pb-10 sm:px-8">
        <EventFacts facts={event.facts} />

        <section className="flex flex-col gap-5">
          <h2 className="font-[family-name:var(--font-poster)] text-3xl tracking-[0.06em] uppercase sm:text-4xl">
            Sponsorship opportunities
          </h2>
          <SponsorGrid tiers={event.sponsorTiers} />
        </section>

        <ContactSection contact={event.registration} />
      </div>
    </main>
  );
}

function ContactSection({ contact }: { contact: typeof event.registration }) {
  return (
    <section className="flex justify-end py-4">
      <div className="flex flex-col items-end gap-1.5 text-right">
        <p className="text-base text-neutral-300">
          For more information, contact {contact.contactName}
        </p>
        <a
          href={contact.contactPhoneHref}
          className="flex items-center gap-2 font-semibold text-orange-300 underline decoration-orange-300/40 underline-offset-4 transition-colors hover:text-orange-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-300/40"
        >
          <HugeiconsIcon icon={Call02Icon} className="size-5 shrink-0" />
          {contact.contactPhone}
        </a>
      </div>
    </section>
  );
}

// Reads as a caption on the donate button: where the money actually goes.
function Proceeds({ proceeds }: { proceeds: string }) {
  return (
    <p className="text-center text-sm text-balance text-neutral-400">
      <Heart />
      {proceeds}
    </p>
  );
}

// Matches the gold stars flanking the flyer's red fundraiser banner.
function Star() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-4 shrink-0 fill-orange-300 sm:size-6"
    >
      <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" />
    </svg>
  );
}

// Echoes the flyer's heart icon over "ALL PROCEEDS BENEFIT".
function Heart() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="mr-1.5 inline-block size-3.5 align-[-0.125em] fill-neutral-500"
    >
      <path d="M12 21s-7.5-4.7-9.3-9.2A5.1 5.1 0 0 1 12 6.6a5.1 5.1 0 0 1 9.3 5.2C19.5 16.3 12 21 12 21z" />
    </svg>
  );
}

// Matches the flyer's checkmarked sponsor benefit lists.
function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="mt-0.5 size-4 shrink-0 stroke-orange-300"
      fill="none"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12.5l5.5 5.5L20 6" />
    </svg>
  );
}

// Splits the narrative around the highlighted name so the copy stays one
// editable string in content.ts rather than pre-chopped markup.
function Highlighted({ text, highlight }: { text: string; highlight: string }) {
  const start = text.indexOf(highlight);

  if (start === -1) return text;

  return (
    <>
      {text.slice(0, start)}
      <span className="text-orange-300">{highlight}</span>
      {text.slice(start + highlight.length)}
    </>
  );
}

// Each fact borrows the icon the app already uses for that idea, so the page
// reads as part of the product: courses for the venue, tournaments for the
// format, and a plain calendar for the date.
const factIcons = {
  When: Calendar01Icon,
  Where: appPageIcons.courses,
  Format: appPageIcons.tournaments,
} satisfies Record<(typeof event.facts)[number]["label"], IconSvgElement>;

function EventFacts({ facts }: { facts: typeof event.facts }) {
  return (
    <div className="bg-border border-border grid gap-px overflow-hidden rounded-xl border sm:grid-cols-3">
      {facts.map(({ label, value, detail }) => (
        <div key={label} className="bg-neutral-950 p-4">
          <p className="flex items-center gap-2 text-base tracking-widest text-orange-300 uppercase">
            <HugeiconsIcon
              icon={factIcons[label]}
              className="size-5 shrink-0"
            />
            {label}
          </p>
          <p className="mt-1 text-lg font-semibold">{value}</p>
          <p className="mt-1 text-sm text-neutral-400">{detail}</p>
        </div>
      ))}
    </div>
  );
}

function SponsorGrid({ tiers }: { tiers: typeof event.sponsorTiers }) {
  return (
    <div className="bg-border border-border grid gap-px overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-4">
      {tiers.map(({ name, price, benefits }) => (
        <div key={name} className="bg-neutral-950 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-base tracking-widest text-orange-300 uppercase">
              {name}
            </p>
            <p className="font-heading text-xl font-medium">{price}</p>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-neutral-400">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex gap-2">
                <Check />
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
