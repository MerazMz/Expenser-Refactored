"use client";

import { motion } from "framer-motion";
import { Wallet, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TodayCardProps {
  expense?: {
    date?: string;
    limit: number;
    spent: number;
    saved: number;
  } | null;
}

export function TodayCard({ expense }: TodayCardProps) {
  const limit = expense?.limit || 0;
  const spent = expense?.spent || 0;
  const displaySaved = Math.max(0, limit - spent);
  const percentageSaved = limit > 0 ? Math.max(0, Math.min(100, Math.round((displaySaved / limit) * 100))) : 100;
  
  const isBudgetExceeded = spent > limit;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full bg-[#121214]/90 dark:bg-zinc-950/80 text-white rounded-[2.25rem] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.16)] relative overflow-hidden border border-zinc-800/80 hover:scale-[1.01] active:scale-[0.99] transition-transform duration-300 select-none group"
    >
      {/* Liquid Glass Background Blobs */}
      <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-emerald-600/30 blur-[45px] pointer-events-none z-0 group-hover:scale-110 transition-transform duration-500" />
      <div className="absolute -bottom-16 -right-16 w-36 h-36 rounded-full bg-teal-500/20 blur-[50px] pointer-events-none z-0 group-hover:scale-110 transition-transform duration-500" />
      <div className="absolute top-1/2 left-1/3 w-20 h-20 rounded-full bg-emerald-500/10 blur-[35px] pointer-events-none z-0" />

      {/* Card Content Grid */}
      <div className="relative z-10 flex items-center justify-between">
        {/* Left Column: Financial Data */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center space-x-1 mb-1">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Savings Today
              </span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white leading-none">
              ₹{displaySaved}
            </h2>
          </div>

          <div className="space-y-1.5 pt-1">
            {/* Daily Budget Info */}
            <div className="flex items-center space-x-2 text-zinc-400">
              <div className="h-5 w-5 rounded-md bg-zinc-800/60 flex items-center justify-center">
                <Wallet className="h-3 w-3 text-zinc-300" />
              </div>
              <span className="text-xs font-semibold">
                Daily Budget: <span className="text-white">₹{limit}</span>
              </span>
            </div>

            {/* Spent Status Badge */}
            <div className="flex items-center">
              <span className={cn(
                "inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide",
                isBudgetExceeded
                  ? "bg-rose-500/15 text-rose-400"
                  : "bg-emerald-500/15 text-emerald-400"
              )}>
                {isBudgetExceeded ? (
                  <>
                    <TrendingDown className="h-3 w-3 mr-0.5" />
                    <span>Over budget by ₹{spent - limit}</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-3 w-3 mr-0.5" />
                    <span>{percentageSaved}% budget saved</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Gauges and Spent Indicator */}
        <div className="flex flex-col items-center space-y-2 shrink-0 pl-4">
          <div className="relative h-20 w-20">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <defs>
                <linearGradient id="liquidEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
              {/* Back Ring Track */}
              <path
                className="stroke-zinc-800/80 fill-none"
                strokeWidth="3.2"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Active Circular Progress Gauge */}
              <motion.path
                className="fill-none"
                stroke={isBudgetExceeded ? "#ef4444" : "url(#liquidEmerald)"}
                strokeWidth="3.2"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: percentageSaved / 100 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            {/* Centered Percentage Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] font-extrabold text-white leading-none">
                {percentageSaved}%
              </span>
              <span className="text-[6px] font-bold text-zinc-500 uppercase tracking-widest leading-none mt-0.5">
                saved
              </span>
            </div>
          </div>

          {/* Today's Spent Mini Display */}
          <div className="text-center">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
              Spent Today
            </p>
            <p className="text-sm font-bold text-white leading-tight">
              ₹{spent}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
