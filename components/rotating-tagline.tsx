"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const PHRASES = [
  "Be the ball",
  "Grip it and rip it",
  "Just tap it in",
  "It's all in the hips",
  "Keep your head down",
];

const INTERVAL_MS = 4500;

export function RotatingTagline() {
  const [index, setIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % PHRASES.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [prefersReducedMotion]);

  const phrase = PHRASES[index];

  return (
    <div className="relative h-10 w-full overflow-hidden sm:h-12">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={index}
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "-100%", opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 flex items-center justify-center whitespace-nowrap text-2xl text-foreground sm:text-3xl"
        >
          {phrase}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
