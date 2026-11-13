"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { PointRules } from "@/lib/clubs/standings/point-rules";

export function PointRulesSummary({ pointRules }: { pointRules: PointRules }) {
  return (
    <Card className="py-0">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 data-[state=open]:bg-muted/50"
          >
            <span className="font-heading text-base font-medium">
              View points rules
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={16}
              aria-hidden
              className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <RuleList
                label="Hole Scores"
                items={[
                  { label: "Par", value: pointRules.pars },
                  { label: "Birdie", value: pointRules.birdies },
                  { label: "Eagle", value: pointRules.eagles },
                  { label: "Ace", value: pointRules.aces },
                ]}
              />
              <RuleList
                label="Strokes Finish"
                items={pointRules.strokes.positions.map((value, index) => ({
                  label: ordinal(index + 1),
                  value,
                }))}
              />
              <RuleList
                label="Putts Finish"
                items={pointRules.putts.positions.map((value, index) => ({
                  label: ordinal(index + 1),
                  value,
                }))}
              />
              <RuleList
                label="Greenie Distance"
                items={pointRules.greenies.tiers.map((tier) => ({
                  label:
                    tier.maxFt == null
                      ? "Any distance"
                      : `Within ${tier.maxFt} ft`,
                  value: tier.pts,
                }))}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function RuleList({
  label,
  items,
}: {
  label: string;
  items: { label: string; value: number }[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-3">
      <h3 className="text-sm font-medium">{label}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <dl className="flex flex-col gap-1 text-sm">
          {items.map((item, index) => (
            <div key={index} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="font-medium tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
