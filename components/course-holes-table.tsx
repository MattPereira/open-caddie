import { ResponsiveTable, TableFrame } from "@/components/responsive-table";
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

const HOLE_NUMBERS = Array.from({ length: 18 }, (_, i) => i + 1);

export function CourseHolesTable({ holes }: { holes: CourseHole[] }) {
  const byHole = new Map(holes.map((h) => [h.hole, h]));
  const ordered = HOLE_NUMBERS.map(
    (hole) =>
      byHole.get(hole) ?? { hole, par: null, handicap: null },
  );

  const front = ordered.slice(0, 9);
  const back = ordered.slice(9);

  const sum = (list: CourseHole[], key: "par" | "handicap") =>
    list.reduce<number | null>((acc, h) => {
      const value = h[key];
      if (value == null) return acc;
      return (acc ?? 0) + value;
    }, null);

  const outPar = sum(front, "par");
  const inPar = sum(back, "par");
  const totalPar =
    outPar != null && inPar != null ? outPar + inPar : (outPar ?? inPar);

  return (
    <ResponsiveTable
      desktop={
        <DesktopCourseHolesTable
          front={front}
          back={back}
          outPar={outPar}
          inPar={inPar}
          totalPar={totalPar}
        />
      }
      mobile={<MobileCourseHolesGrids front={front} back={back} />}
    />
  );
}

function DesktopCourseHolesTable({
  front,
  back,
  outPar,
  inPar,
  totalPar,
}: {
  front: CourseHole[];
  back: CourseHole[];
  outPar: number | null;
  inPar: number | null;
  totalPar: number | null;
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
        </TableBody>
      </Table>
    </TableFrame>
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
}: {
  front: CourseHole[];
  back: CourseHole[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <MobileNineGrid label="Out" holes={front} />
      <MobileNineGrid label="In" holes={back} />
    </div>
  );
}

function MobileNineGrid({
  label,
  holes,
}: {
  label: string;
  holes: CourseHole[];
}) {
  const totalPar = holes.reduce<number | null>((acc, h) => {
    if (h.par == null) return acc;
    return (acc ?? 0) + h.par;
  }, null);

  return (
    <div className="grid min-w-0 grid-cols-[auto_repeat(9,minmax(0,1fr))_auto] overflow-hidden rounded-lg ring-1 ring-border text-sm">
      <HeaderCell>Hole</HeaderCell>
      {holes.map((h) => (
        <HeaderCell key={`${label}-h-${h.hole}`}>{h.hole}</HeaderCell>
      ))}
      <HeaderCell>{label}</HeaderCell>

      <RowLabelCell>Par</RowLabelCell>
      {holes.map((h) => (
        <ValueGridCell key={`${label}-par-${h.hole}`} value={h.par} />
      ))}
      <ValueGridCell value={totalPar} strong />

      <RowLabelCell>Hcp</RowLabelCell>
      {holes.map((h) => (
        <ValueGridCell key={`${label}-hcp-${h.hole}`} value={h.handicap} />
      ))}
      <ValueGridCell value={null} />
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
