import React from 'react';
import { Shield, Zap, Activity, Info } from 'lucide-react';
import { MicronutrientProfile } from '../types';
import { motion } from 'motion/react';

interface MicronutrientIntelligenceProps {
  intake: MicronutrientProfile;
  targets: MicronutrientProfile;
  isPremium: boolean;
}

export const MicronutrientIntelligence: React.FC<MicronutrientIntelligenceProps> = ({ intake, targets, isPremium }) => {
  if (!isPremium) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px] z-10 flex flex-col items-center justify-center p-8 text-center">
          <Shield className="text-primary mb-4" size={48} />
          <h3 className="font-black italic uppercase text-2xl">Micronutrient Intelligence</h3>
          <p className="text-sm text-zinc-400 mt-2 mb-6 max-w-md">
            Unlock deep insights into your vitamin and mineral intake. Track 25+ essential nutrients and optimize your health with AI-powered recommendations.
          </p>
          <button className="bg-primary text-black px-8 py-3 rounded-2xl font-black uppercase text-sm hover:scale-105 transition-all shadow-[0_0_20px_rgba(130,217,93,0.3)]">
            Upgrade to Premium
          </button>
        </div>
        <div className="opacity-10 space-y-8">
          <div className="h-40 bg-zinc-800 rounded-3xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-zinc-800 rounded-3xl" />
            <div className="h-24 bg-zinc-800 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  const renderNutrientBar = (label: string, value: number | undefined, target: number | undefined, unit: string) => {
    const val = value || 0;
    const tar = target || 1;
    const percentage = Math.min(150, (val / tar) * 100);
    const isLow = percentage < 70;
    const isHigh = percentage > 120 && (label === 'Sodium' || label === 'Vitamin A' || label === 'Vitamin D');

    return (
      <div key={label} className="space-y-1.5">
        <div className="flex justify-between items-end">
          <span className="text-[10px] font-bold uppercase text-zinc-400">{label}</span>
          <span className={`text-[10px] font-mono ${isLow ? 'text-red-400' : isHigh ? 'text-orange-400' : 'text-zinc-500'}`}>
            {val.toFixed(1)}{unit} / {tar.toFixed(0)}{unit} ({percentage.toFixed(0)}%)
          </span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, percentage)}%` }}
            className={`h-full rounded-full ${isLow ? 'bg-red-500' : isHigh ? 'bg-orange-500' : 'bg-primary'}`}
          />
        </div>
      </div>
    );
  };

  const vitamins = [
    { label: 'Vitamin A', key: 'vitaminA', unit: 'mcg' },
    { label: 'Vitamin C', key: 'vitaminC', unit: 'mg' },
    { label: 'Vitamin D', key: 'vitaminD', unit: 'mcg' },
    { label: 'Vitamin E', key: 'vitaminE', unit: 'mg' },
    { label: 'Vitamin K', key: 'vitaminK', unit: 'mcg' },
    { label: 'B12', key: 'vitaminB12', unit: 'mcg' },
    { label: 'Folate', key: 'vitaminB9', unit: 'mcg' },
    { label: 'B6', key: 'vitaminB6', unit: 'mg' },
  ];

  const minerals = [
    { label: 'Magnesium', key: 'magnesium', unit: 'mg' },
    { label: 'Zinc', key: 'zinc', unit: 'mg' },
    { label: 'Iron', key: 'iron', unit: 'mg' },
    { label: 'Calcium', key: 'calcium', unit: 'mg' },
    { label: 'Potassium', key: 'potassium', unit: 'mg' },
    { label: 'Sodium', key: 'sodium', unit: 'mg' },
    { label: 'Selenium', key: 'selenium', unit: 'mcg' },
    { label: 'Copper', key: 'copper', unit: 'mg' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vitamins Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Shield size={20} />
            </div>
            <h3 className="font-black italic uppercase text-lg">Vitamin Coverage</h3>
          </div>
          <div className="space-y-4">
            {vitamins.map(v => renderNutrientBar(v.label, (intake as any)[v.key], (targets as any)[v.key], v.unit))}
          </div>
        </div>

        {/* Minerals Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
              <Zap size={20} />
            </div>
            <h3 className="font-black italic uppercase text-lg">Mineral Coverage</h3>
          </div>
          <div className="space-y-4">
            {minerals.map(m => renderNutrientBar(m.label, (intake as any)[m.key], (targets as any)[m.key], m.unit))}
          </div>
        </div>
      </div>

      {/* Electrolyte Balance */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Activity size={20} />
          </div>
          <h3 className="font-black italic uppercase text-lg">Electrolyte Balance</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
             {renderNutrientBar('Sodium', intake.sodium, targets.sodium, 'mg')}
             {renderNutrientBar('Potassium', intake.potassium, targets.potassium, 'mg')}
             {renderNutrientBar('Magnesium', intake.magnesium, targets.magnesium, 'mg')}
             {renderNutrientBar('Calcium', intake.calcium, targets.calcium, 'mg')}
          </div>
          <div className="bg-zinc-800/30 rounded-2xl p-4 border border-zinc-800/50 flex flex-col justify-center">
            <div className="flex items-start gap-3">
              <Info className="text-blue-400 shrink-0 mt-1" size={16} />
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-zinc-400">Sodium-Potassium Ratio</p>
                <p className="text-sm text-zinc-300">
                  Target ratio is 1:2. Your current ratio is 1:{((intake.potassium || 1) / (intake.sodium || 1)).toFixed(1)}.
                </p>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  A balanced ratio supports optimal blood pressure and muscle function.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
