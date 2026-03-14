import React from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { clsx } from 'clsx';

interface DayScore {
  date: Date;
  score: number;
}

export function StreakCalendar({ scores }: { scores: DayScore[] }) {
  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]';
    if (score >= 75) return 'bg-green-400/60';
    if (score >= 60) return 'bg-orange-500/60';
    return 'bg-red-500/60';
  };

  return (
    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Weekly Heatmap</h3>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[8px] text-zinc-600 uppercase">90+</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500/60" />
            <span className="text-[8px] text-zinc-600 uppercase">&lt;60</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const dayScore = scores.find(s => isSameDay(s.date, day));
          const score = dayScore?.score || 0;
          const isToday = isSameDay(day, new Date());

          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <span className={clsx(
                "text-[10px] font-bold uppercase",
                isToday ? "text-primary" : "text-zinc-600"
              )}>
                {format(day, 'EEE')}
              </span>
              <div className={clsx(
                "w-8 h-8 rounded-xl transition-all duration-500",
                score > 0 ? getScoreColor(score) : "bg-zinc-800/50",
                isToday && "ring-2 ring-primary ring-offset-2 ring-offset-black"
              )} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
