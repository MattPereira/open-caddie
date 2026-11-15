import { db } from "@/db";
import { users } from "@/db/schema";

export async function getPlayerCount(): Promise<number> {
  return db.$count(users);
}
