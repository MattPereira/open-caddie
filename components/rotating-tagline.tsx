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
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={index}
          variants={{
            hidden: { transition: { staggerChildren: 0.06, staggerDirection: 1 } },
            visible: {
              transition: { staggerChildren: 0.06, delayChildren: 0.05 },
            },
          }}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="absolute inset-0 flex items-center justify-center whitespace-nowrap text-2xl text-foreground sm:text-3xl"
        >
          {phrase.split("").map((char, i) => (
            <motion.span
              key={i}
              variants={{
                hidden: { y: -28, opacity: 0 },
                visible: {
                  y: 0,
                  opacity: 1,
                  transition: { type: "spring", stiffness: 320, damping: 14 },
                },
              }}
              className="inline-block whitespace-pre"
            >
              {char === " " ? " " : char}
            </motion.span>
          ))}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
