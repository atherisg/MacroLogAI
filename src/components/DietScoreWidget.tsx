import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Flame, Trophy, Target, Activity } from 'lucide-react';
import { calculateDietScore } from '../utils/dietScore';

interface DietScoreWidgetProps {
  actualProtein: number;
  targetProtein: number;
  actualCarbs: number;
  targetCarbs: number;
  actualFat: number;
  targetFat: number;
  actualCalories: number;
  targetCalories: number;
  currentStreakDays: number;
  longestStreak: number;
}

export const DietScoreWidget: React.FC<DietScoreWidgetProps> = ({
  actualProtein,
  targetProtein,
  actualCarbs,
  targetCarbs,
  actualFat,
  targetFat,
  actualCalories,
  targetCalories,
  currentStreakDays,
  longestStreak
}) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const result = calculateDietScore(
    actualProtein,
    targetProtein,
    actualCarbs,
    targetCarbs,
    actualFat,
    targetFat,
    actualCalories,
    targetCalories
  );

  useEffect(() => {
    let start = 0;
    const end = result.score;
    if (start === end) return;

    let totalDuration = 1000;
    let incrementTime = (totalDuration / end);

    let timer = setInterval(() => {
      start += 1;
      setAnimatedScore(start);
      if (start === end) clearInterval(timer);
    }, incrementTime);

    return () => clearInterval(timer);
  }, [result.score]);

  const getMilestone = (streak: number) => {
    if (streak >= 30) return "Elite Consistency";
    if (streak >= 14) return "Nutrition Focused";
    if (streak >= 7) return "Weekly Discipline";
    if (streak >= 3) return "Consistency Starting";
    return null;
  };

  const milestone = getMilestone(currentStreakDays);

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-bold flex items-center gap-2">
          <Target size={18} className="text-primary" />
          Diet Score
        </h3>
        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-zinc-800/50 ${result.color}`}>
          {result.level}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Score Display */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-zinc-800"
              />
              <motion.circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={351.858}
                strokeDashoffset={351.858 - (351.858 * animatedScore) / 100}
                className={result.color}
                strokeLinecap="round"
                initial={{ strokeDashoffset: 351.858 }}
                animate={{ strokeDashoffset: 351.858 - (351.858 * animatedScore) / 100 }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-black text-white">{animatedScore}</span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">/ 100</span>
            </div>
          </div>
          <p className="text-sm text-zinc-400 mt-4 text-center max-w-[200px]">
            {result.insight}
          </p>
        </div>

        {/* Breakdown & Streak */}
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-400 font-medium">Protein Score</span>
              <span className="text-white font-bold">{result.proteinScore} / 40</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${(result.proteinScore / 40) * 100}%` }}
                transition={{ duration: 1, delay: 0.2 }}
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-400 font-medium">Macro Balance</span>
              <span className="text-white font-bold">{result.macroScore} / 40</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${(result.macroScore / 40) * 100}%` }}
                transition={{ duration: 1, delay: 0.4 }}
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-400 font-medium">Calories</span>
              <span className="text-white font-bold">{result.calorieScore} / 20</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-orange-500"
                initial={{ width: 0 }}
                animate={{ width: `${(result.calorieScore / 20) * 100}%` }}
                transition={{ duration: 1, delay: 0.6 }}
              />
            </div>
          </div>

          {/* Streak Section */}
          <div className="bg-zinc-800/30 rounded-2xl p-4 border border-zinc-700/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${currentStreakDays > 0 ? 'bg-orange-500/20 text-orange-500' : 'bg-zinc-800 text-zinc-500'}`}>
                  <Flame size={20} className={currentStreakDays > 0 ? 'animate-pulse' : ''} />
                </div>
                <div>
                  <div className="text-white font-bold">{currentStreakDays} Day Streak</div>
                  <div className="text-xs text-zinc-500">Longest: {longestStreak} days</div>
                </div>
              </div>
              {milestone && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold">
                  <Trophy size={12} />
                  {milestone}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
