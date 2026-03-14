import React from 'react';
import { motion } from 'motion/react';

interface MacroCircleBarProps {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export default function MacroCircleBar({ protein, carbs, fat, calories }: MacroCircleBarProps) {
  // 1g protein = 4 kcal
  // 1g carbs = 4 kcal
  // 1g fat = 9 kcal
  
  const proteinKcal = protein * 4;
  const carbsKcal = carbs * 4;
  const fatKcal = fat * 9;
  
  const totalKcal = proteinKcal + carbsKcal + fatKcal;
  
  // Calculate percentages
  const pPct = totalKcal > 0 ? proteinKcal / totalKcal : 0.3;
  const cPct = totalKcal > 0 ? carbsKcal / totalKcal : 0.4;
  const fPct = totalKcal > 0 ? fatKcal / totalKcal : 0.3;

  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  const pDash = pPct * circumference;
  const cDash = cPct * circumference;
  const fDash = fPct * circumference;

  const pOffset = 0;
  const cOffset = -pDash;
  const fOffset = cOffset - cDash;

  return (
    <div className="relative w-48 h-48 mx-auto flex items-center justify-center group">
      <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full transition-all duration-500 group-hover:bg-primary/10" />
      
      <svg className="w-full h-full transform -rotate-90 relative z-10" viewBox="0 0 160 160">
        {/* Background Circle */}
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="12"
        />
        
        {/* Protein */}
        <motion.circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="#10b981" // emerald-500
          strokeWidth="12"
          strokeDasharray={`${pDash} ${circumference}`}
          strokeDashoffset={pOffset}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${pDash} ${circumference}` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
        />
        
        {/* Carbs */}
        <motion.circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="#3b82f6" // blue-500
          strokeWidth="12"
          strokeDasharray={`${cDash} ${circumference}`}
          strokeDashoffset={cOffset}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${cDash} ${circumference}` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          className="drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
        />
        
        {/* Fat */}
        <motion.circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="#f59e0b" // amber-500
          strokeWidth="12"
          strokeDasharray={`${fDash} ${circumference}`}
          strokeDashoffset={fOffset}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${fDash} ${circumference}` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
          className="drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
        />
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Calories</p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black text-white">{calories}</span>
        </div>
      </div>
    </div>
  );
}
