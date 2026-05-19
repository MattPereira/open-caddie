"use client";

import { useMemo, useState } from "react";

import { ResponsiveTable, TableFrame } from "@/components/responsive-table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type CourseHole = {
  hole: number;
  par: number | null;
  handicap: number | null;
};

type CourseTee = {
  id: number;
  name: string;
  color: string | null;
  rating: string;
  slope: number;
  yardages: (number | null)[];
};

const HOLE_NUMBERS = Array.from({ length: 18 }, (_, i) => i + 1);

export function CourseHolesTable({
  holes,
  tees = [],
}: {
  holes: CourseHole[];
  tees?: CourseTee[];
}) {
  const [selectedTeeId, setSelectedTeeId] = useState(() =>
    tees[0] ? String(tees[0].id) : "",
  );
  const selectedTee = useMemo(
    () => tees.find((tee) => String(tee.id) === selectedTeeId) ?? tees[0],
    [selectedTeeId, tees],
  );

  const { front, back, outPar, inPar, totalPar } = useMemo(() => {
    const byHole = new Map(holes.map((h) => [h.hole, h]));
    const ordered = HOLE_NUMBERS.map(
      (hole) => byHole.get(hole) ?? { hole, par: null, handicap: null },
    );
    const front = ordered.slice(0, 9);
    const back = ordered.slice(9);
    const outPar = sumHoleValues(front, "par");
    const inPar = sumHoleValues(back, "par");

    return {
      front,
      back,
      outPar,
      inPar,
      totalPar:
        outPar != null && inPar != null ? outPar + inPar : (outPar ?? inPar),
    };
  }, [holes]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold">Scorecard</h3>
        {tees.length > 0 ? (
          <Select value={selectedTeeId} onValueChange={setSelectedTeeId}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Select tee" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {tees.map((tee) => (
                  <SelectItem key={tee.id} value={String(tee.id)}>
                    <TeeOptionLabel tee={tee} />
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
      </div>
      <ResponsiveTable
        desktop={
          <DesktopCourseHolesTable
            front={front}
            back={back}
            outPar={outPar}
            inPar={inPar}
            totalPar={totalPar}
            tee={selectedTee}
          />
        }
        mobile={
          <MobileCourseHolesGrids
            front={front}
            back={back}
            selectedTee={selectedTee}
          />
        }
      />
    </div>
  );
}

function sumHoleValues(list: CourseHole[], key: "par" | "handicap") {
  return list.reduce<number | null>((acc, h) => {
    const value = h[key];
    if (value == null) return acc;
    return (acc ?? 0) + value;
  }, null);
}

function sumValues(list: (number | null)[]) {
  return list.reduce<number | null>((acc, value) => {
    if (value == null) return acc;
    return (acc ?? 0) + value;
  }, null);
}

function DesktopCourseHolesTable({
  front,
  back,
  outPar,
  inPar,
  totalPar,
  tee,
}: {
  front: CourseHole[];
  back: CourseHole[];
  outPar: number | null;
  inPar: number | null;
  totalPar: number | null;
  tee?: CourseTee;
}) {
  return (
    <TableFrame>
      <Table className="w-max">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-20 bg-card">
              Hole
            </TableHead>
            {front.map((h) => (
              <TableHead key={`f-${h.hole}`} className="w-10 text-center">
                {h.hole}
              </TableHead>
            ))}
            <TableHead className="w-12 text-center">Out</TableHead>
            {back.map((h) => (
              <TableHead key={`b-${h.hole}`} className="w-10 text-center">
                {h.hole}
              </TableHead>
            ))}
            <TableHead className="w-12 text-center">In</TableHead>
            <TableHead className="w-12 text-center">Tot</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tee ? (
            <TeeYardageRow tee={tee} />
          ) : null}
          <TableRow>
            <TableCell className="sticky left-0 z-10 bg-card font-medium">
              Hcp
            </TableCell>
            {front.map((h) => (
              <ValueCell key={`f-hcp-${h.hole}`} value={h.handicap} />
            ))}
            <TableCell />
            {back.map((h) => (
              <ValueCell key={`b-hcp-${h.hole}`} value={h.handicap} />
            ))}
            <TableCell />
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell className="sticky left-0 z-10 bg-card font-medium">
              Par
            </TableCell>
            {front.map((h) => (
              <ValueCell key={`f-par-${h.hole}`} value={h.par} />
            ))}
            <ValueCell value={outPar} strong />
            {back.map((h) => (
              <ValueCell key={`b-par-${h.hole}`} value={h.par} />
            ))}
            <ValueCell value={inPar} strong />
            <ValueCell value={totalPar} strong />
          </TableRow>
        </TableBody>
      </Table>
    </TableFrame>
  );
}

function TeeYardageRow({ tee }: { tee: CourseTee }) {
  const frontYardages = tee.yardages.slice(0, 9);
  const backYardages = tee.yardages.slice(9);
  const outYards = sumValues(frontYardages);
  const inYards = sumValues(backYardages);
  const totalYards =
    outYards != null && inYards != null
      ? outYards + inYards
      : (outYards ?? inYards);

  return (
    <TableRow>
      <TableCell className="sticky left-0 z-10 bg-card font-medium">
        <TeeRowLabel tee={tee} />
      </TableCell>
      {frontYardages.map((yards, index) => (
        <ValueCell key={`${tee.id}-f-yards-${index}`} value={yards} />
      ))}
      <ValueCell value={outYards} strong />
      {backYardages.map((yards, index) => (
        <ValueCell key={`${tee.id}-b-yards-${index}`} value={yards} />
      ))}
      <ValueCell value={inYards} strong />
      <ValueCell value={totalYards} strong />
    </TableRow>
  );
}

function TeeOptionLabel({ tee }: { tee: CourseTee }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {tee.color ? (
        <span
          className="size-3 shrink-0 rounded-full ring-1 ring-border"
          style={{ backgroundColor: tee.color }}
          aria-hidden
        />
      ) : null}
      <span className="truncate">{tee.name}</span>
      <span className="text-xs font-normal text-muted-foreground">
        {tee.rating}/{tee.slope}
      </span>
    </span>
  );
}

function TeeRowLabel({ tee }: { tee: CourseTee }) {
  return (
    <div className="flex min-w-28 items-center gap-2">
      {tee.color ? (
        <span
          className="size-3 shrink-0 rounded-full ring-1 ring-border"
          style={{ backgroundColor: tee.color }}
          aria-hidden
        />
      ) : null}
      <span className="truncate">{tee.name}</span>
    </div>
  );
}

function ValueCell({
  value,
  strong,
}: {
  value: number | null;
  strong?: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "text-center tabular-nums",
        strong ? "font-semibold" : "font-medium",
      )}
    >
      {value ?? "—"}
    </TableCell>
  );
}

function MobileCourseHolesGrids({
  front,
  back,
  selectedTee,
}: {
  front: CourseHole[];
  back: CourseHole[];
  selectedTee?: CourseTee;
}) {
  return (
    <div className="flex flex-col gap-4">
      <MobileNineGrid label="Out" holes={front} tee={selectedTee} />
      <MobileNineGrid label="In" holes={back} tee={selectedTee} />
    </div>
  );
}

function MobileNineGrid({
  label,
  holes,
  tee,
}: {
  label: string;
  holes: CourseHole[];
  tee?: CourseTee;
}) {
  const totalPar = holes.reduce<number | null>((acc, h) => {
    if (h.par == null) return acc;
    return (acc ?? 0) + h.par;
  }, null);
  const offset = holes[0]?.hole === 10 ? 9 : 0;
  const yardages = tee?.yardages.slice(offset, offset + 9) ?? [];
  const totalYards = sumValues(yardages);

  return (
    <div className="grid min-w-0 grid-cols-[auto_repeat(9,minmax(0,1fr))_auto] overflow-hidden rounded-lg ring-1 ring-border text-sm">
      <HeaderCell>Hole</HeaderCell>
      {holes.map((h) => (
        <HeaderCell key={`${label}-h-${h.hole}`}>{h.hole}</HeaderCell>
      ))}
      <HeaderCell>{label}</HeaderCell>

      {tee ? (
        <>
          <RowLabelCell>Yds</RowLabelCell>
          {yardages.map((yards, index) => (
            <ValueGridCell key={`${label}-yards-${index}`} value={yards} />
          ))}
          <ValueGridCell value={totalYards} strong />
        </>
      ) : null}

      <RowLabelCell>Hcp</RowLabelCell>
      {holes.map((h) => (
        <ValueGridCell key={`${label}-hcp-${h.hole}`} value={h.handicap} />
      ))}
      <ValueGridCell value={null} />

      <RowLabelCell>Par</RowLabelCell>
      {holes.map((h) => (
        <ValueGridCell key={`${label}-par-${h.hole}`} value={h.par} />
      ))}
      <ValueGridCell value={totalPar} strong />
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-muted px-1 py-1 text-center text-xs font-medium text-muted-foreground">
      {children}
    </div>
  );
}

function RowLabelCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-muted px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
      {children}
    </div>
  );
}

function ValueGridCell({
  value,
  strong,
}: {
  value: number | null;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 px-1 py-1.5 text-center tabular-nums",
        strong ? "font-semibold" : "font-medium",
      )}
    >
      {value ?? "—"}
    </div>
  );
}
