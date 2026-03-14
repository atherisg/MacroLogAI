import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, BrainCircuit, TrendingUp, Target, ShieldCheck, Star, Loader2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import confetti from 'canvas-confetti';

export default function Premium({ user, isPremium }: { user: User, isPremium: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        isPremium: true,
        premiumExpiresAt: null // Lifetime for free upgrade
      });
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#82D95D', '#ffffff', '#22c55e']
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users/' + user.uid);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: BrainCircuit,
      title: "Amino Acid Intelligence",
      description: "Deep analysis of protein quality and essential amino acid profiles for every meal."
    },
    {
      icon: Target,
      title: "Protein Quality Scoring",
      description: "Advanced algorithms to calculate your Protein Utilization Score based on bioavailability."
    },
    {
      icon: TrendingUp,
      title: "Advanced Nutrition Charts",
      description: "Visualize your nutrition with radar charts, coverage trackers, and long-term trends."
    },
    {
      icon: Zap,
      title: "AI Nutrition Insights",
      description: "Personalized recommendations and deep-dives into your eating habits powered by Gemini."
    }
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">MacroLog Premium</h2>
          <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Unlock deeper nutrition intelligence</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-8 bg-zinc-900/40 border border-zinc-800/50 rounded-[2.5rem] backdrop-blur-xl space-y-4 hover:border-primary/30 transition-colors group"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <feature.icon size={24} />
            </div>
            <h3 className="text-xl font-bold uppercase tracking-tighter text-white">{feature.title}</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-10 bg-gradient-to-br from-primary/20 to-transparent border border-primary/30 rounded-[3rem] text-center space-y-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,var(--color-primary)_0%,transparent_70%)] opacity-5" />
        
        <div className="space-y-4 relative">
          <div className="flex justify-center">
            <div className="bg-primary/20 p-4 rounded-full">
              <Star size={32} className="text-primary fill-primary" />
            </div>
          </div>
          <h3 className="text-4xl font-black italic uppercase tracking-tighter text-white">Ready to Level Up?</h3>
          <p className="text-zinc-400 max-w-md mx-auto">
            Get full access to all advanced features and support the development of MacroLog.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 relative">
          {isPremium ? (
            <div className="flex flex-col items-center gap-2">
              <div className="px-12 py-4 bg-zinc-800 text-primary font-black uppercase tracking-widest rounded-full flex items-center gap-2 border border-primary/30">
                Premium Active
                <ShieldCheck size={20} />
              </div>
              <p className="text-[10px] text-primary font-mono uppercase tracking-widest">
                You have full access to all features
              </p>
            </div>
          ) : (
            <>
              <button 
                onClick={handleUpgrade}
                disabled={loading}
                className="px-12 py-4 bg-primary text-black font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform flex items-center gap-2 shadow-[0_0_20px_rgba(130,217,93,0.3)] disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : "Upgrade to Premium"}
                {!loading && <ShieldCheck size={20} />}
              </button>
              <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                Free for a limited time during development
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
