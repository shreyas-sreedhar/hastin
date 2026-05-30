// Hastin motion system — calm, scholarly, slow, intentional.
// Never bounce, overshoot, or flash. Everything easeOut.
//
// Durations come straight from the spec (NODE 09):
//   hover     120ms
//   panel     200ms
//   chat open 220ms
//   drawer    250ms
//
// All animations should reference these constants — don't hand-roll
// duration values inline, that's how a UI accidentally drifts into
// flashy motion territory.

import type { Variants } from "framer-motion";

export const DURATION = {
  hover: 0.12,
  panel: 0.2,
  chatOpen: 0.22,
  drawer: 0.25,
} as const;

export const EASE = "easeOut" as const;

// A single content card: fade up from y=8 to y=0 over the panel duration.
// Used by Reader blocks and search result items alike.
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.panel, ease: EASE },
  },
};

// Stagger child cards on entry so a screenful of blocks reveals
// sequentially instead of all at once. 40ms apart with a 50ms lead
// keeps the reveal under a second even for long pages.
export const cardListVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

// Search-result list reveals a touch slower than reader cards so the
// "list of hits" reads as deliberate rather than dumped.
export const searchResultListVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

export const searchResultVariants = cardVariants;

// Whole-panel fade for top-level columns and route transitions.
export const panelVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATION.panel, ease: EASE },
  },
};

// Drawer slide-in (from right) for the future grounded-assistant /
// download center sidesheets in NODE 10–11.
export const drawerVariants: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.drawer, ease: EASE },
  },
};

// Floating chat panel pop-in. Slightly slower than panel so it reads
// as a separate gesture from background panel mounts.
export const chatPanelVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.chatOpen, ease: EASE },
  },
};
