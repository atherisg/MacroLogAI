import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { useAppSound } from './SoundProvider';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MicroButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export default function MicroButton({ children, className, variant = 'primary', onClick, ...props }: MicroButtonProps) {
  const { playClick } = useAppSound();

  const variants = {
    primary: "bg-primary text-black font-black uppercase italic shadow-lg shadow-primary/20",
    secondary: "bg-zinc-800 text-white font-bold border border-zinc-700",
    ghost: "bg-transparent text-zinc-400 hover:text-white",
    danger: "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white"
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    playClick();
    if (onClick) onClick(e);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02, filter: 'brightness(1.1)' }}
      whileTap={{ scale: 0.96 }}
      onClick={handleClick}
      className={cn(
        "px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
