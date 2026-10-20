import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/** Fades and lifts its content into place; `index` staggers siblings. */
export const Reveal: React.FC<{ index?: number; className?: string; children: React.ReactNode }> = ({ index = 0, className, children }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay: index * 0.07, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
};
