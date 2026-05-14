"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderWordmark({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname();
  if (pathname === "/" && !isAuthed) return <span aria-hidden />;

  return (
    <Link
      href="/"
      className="justify-self-center font-brand text-[1.625rem] font-normal"
    >
      Open Caddie
    </Link>
  );
}
