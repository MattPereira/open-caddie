import { formatGreetingFor } from "./lib/greeting";

export function greet(name: string): string {
  return formatGreetingFor(name);
}
