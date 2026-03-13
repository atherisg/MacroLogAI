import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Meal, PantryItem } from '../types';
import { getWeeklyCoaching, chatWithAssistant } from '../services/gemini';
import { BrainCircuit, Send, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function AIAssistant({ user, profile }: { user: User, profile: UserProfile }) {
  const [coaching, setCoaching] = useState<string | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pantry, setPantry] = useState<string[]>([]);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load context
    const loadContext = async () => {
      try {
        const pantrySnap = await getDocs(query(collection(db, 'pantry'), where('uid', '==', user.uid)));
        setPantry(pantrySnap.docs.map(d => (d.data() as PantryItem).name));

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const mealsSnap = await getDocs(query(
          collection(db, 'meals'), 
          where('uid', '==', user.uid),
          where('timestamp', '>=', startOfDay.toISOString())
        ));
        setTodayMeals(mealsSnap.docs.map(d => d.data() as Meal));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'context');
      }
    };
    loadContext();
  }, [user.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleGetCoaching = async () => {
    setLoadingCoach(true);
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const mealsSnap = await getDocs(query(
        collection(db, 'meals'),
        where('uid', '==', user.uid),
        where('timestamp', '>=', sevenDaysAgo.toISOString())
      ));
      
      const last7DaysMeals = mealsSnap.docs.map(d => d.data() as Meal);
      const summary = await getWeeklyCoaching(profile, last7DaysMeals);
      setCoaching(summary);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'meals');
    } finally {
      setLoadingCoach(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setSending(true);

    try {
      const response = await chatWithAssistant(userMsg, { profile, pantry, todayMeals });
      setMessages(prev => [...prev, { role: 'ai', content: response || "I'm sorry, I couldn't process that." }]);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8 flex flex-col h-[calc(100vh-12rem)]">
      <div className="space-y-2">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-primary">AI Coach</h2>
        <p className="text-zinc-500 text-sm">Weekly insights and real-time nutrition assistance.</p>
      </div>

      {/* Weekly Coaching Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles size={18} />
            <h3 className="text-xs font-bold uppercase tracking-widest">Weekly Insights</h3>
          </div>
          {!coaching && (
            <button 
              onClick={handleGetCoaching}
              disabled={loadingCoach}
              className="text-[10px] font-bold uppercase text-primary hover:underline disabled:opacity-50"
            >
              {loadingCoach ? 'Analyzing...' : 'Generate Summary'}
            </button>
          )}
        </div>
        
        {loadingCoach ? (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="animate-spin text-primary" size={20} />
            <p className="text-sm text-zinc-500 italic">Analyzing your last 7 days of nutrition data...</p>
          </div>
        ) : coaching ? (
          <div className="text-sm text-zinc-300 leading-relaxed prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{coaching}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-zinc-600 italic">Click generate to see your weekly nutrition analysis.</p>
        )}
      </div>

      {/* Chat Section */}
      <div className="flex-1 flex flex-col bg-zinc-900/30 border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
          <MessageSquare size={16} className="text-zinc-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Nutrition Assistant</span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-30">
              <BrainCircuit size={48} />
              <p className="text-sm">Ask me anything about your diet, pantry, or goals.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={clsx(
              "flex flex-col max-w-[85%]",
              msg.role === 'user' ? "ml-auto items-end" : "items-start"
            )}>
              <div className={clsx(
                "p-4 rounded-2xl text-sm",
                msg.role === 'user' ? "bg-primary text-black font-medium" : "bg-zinc-800 text-zinc-200"
              )}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-start">
              <div className="bg-zinc-800 p-4 rounded-2xl">
                <Loader2 size={16} className="animate-spin text-primary" />
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="p-4 bg-zinc-900/50 border-t border-zinc-800 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask MacroLog AI..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || sending}
            className="bg-primary text-black p-3 rounded-xl disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

function clsx(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
