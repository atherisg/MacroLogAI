import React from 'react';
import { AminoAcidProfile } from '../types';
import { motion } from 'motion/react';

interface Props {
  profile: AminoAcidProfile;
  weightKg: number;
}

const DAILY_REQUIREMENTS_PER_KG = {
  histidine: 10,
  isoleucine: 20,
  leucine: 39,
  lysine: 30,
  methionine_cysteine: 15,
  phenylalanine_tyrosine: 25,
  threonine: 15,
  tryptophan: 4,
  valine: 26,
};

const AA_DESCRIPTIONS: { [key: string]: string } = {
  histidine: "Vital for growth, tissue repair, and making histamine (immune system).",
  isoleucine: "Involved in muscle metabolism and immune function.",
  leucine: "Critical for protein synthesis and muscle repair.",
  lysine: "Important for protein synthesis, hormone production, and calcium absorption.",
  methionine: "Necessary for tissue growth and metabolism.",
  phenylalanine: "Precursor for neurotransmitters like dopamine and norepinephrine.",
  threonine: "Principal part of structural proteins like collagen and elastin.",
  tryptophan: "Precursor for serotonin, which regulates appetite, sleep, and mood.",
  valine: "Stimulates muscle growth and regeneration.",
};

export default function AminoAcidCoverage({ profile, weightKg }: Props) {
  const requirements = {
    histidine: (profile.histidine || 0) * 1000 / (weightKg * DAILY_REQUIREMENTS_PER_KG.histidine),
    isoleucine: (profile.isoleucine || 0) * 1000 / (weightKg * DAILY_REQUIREMENTS_PER_KG.isoleucine),
    leucine: (profile.leucine || 0) * 1000 / (weightKg * DAILY_REQUIREMENTS_PER_KG.leucine),
    lysine: (profile.lysine || 0) * 1000 / (weightKg * DAILY_REQUIREMENTS_PER_KG.lysine),
    methionine: ((profile.methionine || 0) + (profile.cysteine || 0)) * 1000 / (weightKg * DAILY_REQUIREMENTS_PER_KG.methionine_cysteine),
    phenylalanine: ((profile.phenylalanine || 0) + (profile.tyrosine || 0)) * 1000 / (weightKg * DAILY_REQUIREMENTS_PER_KG.phenylalanine_tyrosine),
    threonine: (profile.threonine || 0) * 1000 / (weightKg * DAILY_REQUIREMENTS_PER_KG.threonine),
    tryptophan: (profile.tryptophan || 0) * 1000 / (weightKg * DAILY_REQUIREMENTS_PER_KG.tryptophan),
    valine: (profile.valine || 0) * 1000 / (weightKg * DAILY_REQUIREMENTS_PER_KG.valine),
  };

  return (
    <div className="space-y-4 bg-black/20 rounded-2xl p-6 border border-white/5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Daily Essential AA Coverage</h3>
        <span className="text-[10px] text-zinc-500 uppercase font-bold">Hover for details</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(requirements).map(([name, ratio]) => {
          const percentage = Number((ratio * 100).toFixed(1));
          const color = percentage >= 100 ? 'bg-emerald-500' : percentage >= 70 ? 'bg-amber-500' : 'bg-rose-500';
          const description = AA_DESCRIPTIONS[name] || "";
          
          return (
            <div key={name} className="group relative space-y-1">
              <div className="flex justify-between text-xs">
                <span className="capitalize text-white/70 flex items-center gap-1">
                  {name}
                  <div className="w-3 h-3 rounded-full border border-white/20 flex items-center justify-center text-[8px] text-white/40 group-hover:border-primary group-hover:text-primary transition-colors">?</div>
                </span>
                <span className={percentage >= 100 ? 'text-emerald-400 font-bold' : 'text-white/50'}>{percentage}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(percentage, 100)}%` }}
                  className={`h-full ${color}`}
                />
              </div>

              {/* Tooltip */}
              <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                <p className="text-[10px] font-bold text-primary uppercase mb-1">{name}</p>
                <p className="text-[9px] text-zinc-400 leading-tight mb-2">{description}</p>
                <div className="pt-1 border-t border-white/5">
                  <p className="text-[8px] text-zinc-500 uppercase font-bold">
                    {percentage}% of your daily requirement for this amino acid is met by this meal.
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
