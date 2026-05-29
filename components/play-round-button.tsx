"use client";

import Link from "next/link";
import { GolfBatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";

export function PlayRoundButton({ href }: { href: string }) {
  return (
    <motion.div
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className="w-full sm:w-64"
    >
      <motion.div
        animate={{ boxShadow: ["0 0 0 0px oklch(0.55 0.15 145 / 0.5)", "0 0 0 8px oklch(0.55 0.15 145 / 0)", "0 0 0 0px oklch(0.55 0.15 145 / 0)"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        className="w-full rounded-xl"
      >
        <Button asChild size="xl" className="w-full">
          <Link href={href}>
            <HugeiconsIcon icon={GolfBatIcon} data-icon="inline-start" />
            Play round
          </Link>
        </Button>
      </motion.div>
    </motion.div>
  );
}
