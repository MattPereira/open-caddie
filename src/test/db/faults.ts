import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Makes inserting a hole for the course named `courseName` raise, until the
 * returned function removes the trigger. Scoped to that course so other
 * course writes keep working.
 */
export async function failCourseHoleInserts(courseName: string) {
  const name = courseName.replaceAll("'", "''");
  await db.execute(
    sql.raw(
      `create function fail_course_holes_insert() returns trigger language plpgsql as $$ begin if exists (select 1 from courses where id = new.course_id and name = '${name}') then raise exception 'forced course_holes insert failure'; end if; return new; end; $$`,
    ),
  );
  await db.execute(
    sql.raw(
      "create trigger fail_course_holes_insert before insert on course_holes for each row execute function fail_course_holes_insert()",
    ),
  );
  return async () => {
    await db.execute(
      sql.raw(
        "drop trigger if exists fail_course_holes_insert on course_holes",
      ),
    );
    await db.execute(
      sql.raw("drop function if exists fail_course_holes_insert()"),
    );
  };
}
