import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';

export default function AnimatedNumber({ value, duration = 0.4, precision = 0 }: { value: number; duration?: number; precision?: number }) {
  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  });
  
  const display = useTransform(spring, (current) => current.toFixed(precision).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}
