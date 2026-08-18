"use client";

import Link from "next/link";
import { Wallet, TrendingUp, Sparkles, ChevronRight, ShieldCheck } from "lucide-react";

interface MonthlySummaryProps {
  summary?: {
    totalSpent: number;
    totalSaved: number;
    totalLimit: number;
    totalLimitTillNow: number;
  } | null;
  monthlyBudget: number;
}

export function MonthlySummary({ summary, monthlyBudget }: MonthlySummaryProps) {
  const spent = summary?.totalSpent || 0;
  const saved = summary?.totalSaved || 0;
  const remaining = Math.max(0, monthlyBudget - spent);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Account Summary</h3>
        <Link 
          href="/calendar" 
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors flex items-center gap-0.5"
        >
          <span>View All</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Current Balance Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-[#e8f6ed] dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-[#15803d] dark:text-emerald-400 stroke-[1.75]" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Current Balance</p>
            <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">₹{monthlyBudget}</p>
          </div>
        </div>

        {/* Spent Card */}
        <div className="bg-[#fdeeee]/40 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-[#fdeeee] dark:bg-rose-950/40 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5 text-[#e11d48] dark:text-rose-400 stroke-[1.75]" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Spent</p>
            <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">₹{spent}</p>
          </div>
        </div>

        {/* Saved Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-[#e8f6ed] dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-[#15803d] dark:text-emerald-400 stroke-[1.75]" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Saved</p>
            <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">₹{saved}</p>
          </div>
        </div>

        {/* Remaining Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-[#fdf2e2] dark:bg-amber-950/40 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-[#d97706] dark:text-amber-400 stroke-[1.75]" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Remaining</p>
            <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">₹{remaining}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
