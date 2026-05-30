"use client";

import { motion } from "framer-motion";
import { panelVariants } from "@/lib/motion";

// Top-level column wrapper. Fades the column in on mount; since the
// route is dynamic, re-fires on every page navigation, giving the
// 200ms panel-transition feel without any client-side router
// coordination.
export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={panelVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
