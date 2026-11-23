import { notFound } from "next/navigation";

// Unmatched URLs would otherwise skip the (app) layout and hit the root 404.
export default function MissingPage() {
  notFound();
}
