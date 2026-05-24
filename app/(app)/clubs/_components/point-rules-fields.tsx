"use client";

import type { ReactNode } from "react";
import {
  useFieldArray,
  type Control,
  type FieldArrayPath,
} from "react-hook-form";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ClubFormValues } from "../schema";

type Props = {
  control: Control<ClubFormValues>;
};

const numberInputProps = {
  type: "number" as const,
  inputMode: "numeric" as const,
  step: 1,
  min: 0,
};

function NumberField({
  control,
  name,
  label,
}: {
  control: Control<ClubFormValues>;
  name:
    | "pointRules.participation"
    | "pointRules.pars"
    | "pointRules.birdies"
    | "pointRules.eagles"
    | "pointRules.aces";
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...numberInputProps}
              {...field}
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function PositionsList({
  control,
  name,
}: {
  control: Control<ClubFormValues>;
  name: "pointRules.strokes.positions" | "pointRules.putts.positions";
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: name as unknown as FieldArrayPath<ClubFormValues>,
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => append(0 as never)}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} />
          Add
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-xs text-muted-foreground">
              #{index + 1}
            </span>
            <FormField
              control={control}
              name={
                `${name}.${index}` as `pointRules.strokes.positions.${number}`
              }
              render={({ field: f }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      {...numberInputProps}
                      {...f}
                      value={f.value ?? ""}
                      onChange={(e) =>
                        f.onChange(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => remove(index)}
              aria-label={`Remove position ${index + 1}`}
            >
              <HugeiconsIcon icon={Delete02Icon} size={16} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GreeniesTiers({ control }: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "pointRules.greenies.tiers",
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Each tier awards <em>pts</em> when a greenie is within <em>maxFt</em>.
          Toggle &quot;No max&quot; for the open-ended tier.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => append({ maxFt: 0, pts: 0 })}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} />
          Add tier
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="flex flex-col gap-2 rounded-md border p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Tier {index + 1}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => remove(index)}
                aria-label={`Remove tier ${index + 1}`}
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} />
              </Button>
            </div>
            <FormField
              control={control}
              name={`pointRules.greenies.tiers.${index}.maxFt`}
              render={({ field: f }) => {
                const noMax = f.value === null;
                return (
                  <FormItem>
                    <FormLabel>Max feet</FormLabel>
                    <div className="flex items-center gap-3">
                      <FormControl>
                        <Input
                          {...numberInputProps}
                          disabled={noMax}
                          value={noMax ? "" : (f.value ?? "")}
                          onChange={(e) =>
                            f.onChange(
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <label className="flex shrink-0 items-center gap-2 text-sm">
                        <Switch
                          checked={noMax}
                          onCheckedChange={(checked) =>
                            f.onChange(checked ? null : 0)
                          }
                        />
                        No max
                      </label>
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              control={control}
              name={`pointRules.greenies.tiers.${index}.pts`}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel>Points</FormLabel>
                  <FormControl>
                    <Input
                      {...numberInputProps}
                      {...f}
                      value={f.value ?? ""}
                      onChange={(e) =>
                        f.onChange(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function RulesCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export function PointRulesFields({ control }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <RulesCard title="Hole scores">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              control={control}
              name="pointRules.participation"
              label="Participation"
            />
            <NumberField
              control={control}
              name="pointRules.pars"
              label="Pars"
            />
            <NumberField
              control={control}
              name="pointRules.birdies"
              label="Birdies"
            />
            <NumberField
              control={control}
              name="pointRules.eagles"
              label="Eagles"
            />
            <NumberField
              control={control}
              name="pointRules.aces"
              label="Aces"
            />
          </div>
        </RulesCard>

        <RulesCard title="Strokes positions">
          <PositionsList
            control={control}
            name="pointRules.strokes.positions"
          />
        </RulesCard>

        <RulesCard title="Putts positions">
          <PositionsList control={control} name="pointRules.putts.positions" />
        </RulesCard>
      </div>
      <RulesCard title="Greenie tiers">
        <GreeniesTiers control={control} />
      </RulesCard>
    </div>
  );
}
