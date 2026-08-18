"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveTodayExpense } from "@/actions/expenses";
import { toast } from "sonner";
import { Loader2, Check, Tag, X, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

interface SpendInputProps {
  userId: string;
  initialSpent?: number;
  initialNote?: string;
}

export function SpendInput({ userId, initialSpent = 0, initialNote = "" }: SpendInputProps) {
  const queryClient = useQueryClient();
  const [spent, setSpent] = useState("");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    const numSpent = spent === "" ? 0 : Number(spent);
    if (isNaN(numSpent) || numSpent < 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);

    const newTotalSpent = isEditing ? numSpent : (initialSpent + numSpent);
    const newNote = isEditing
      ? note.trim()
      : (initialNote ? (note.trim() ? `${initialNote}, ${note.trim()}` : initialNote) : note.trim());

    const previousDashboardData = queryClient.getQueryData<any>(["dashboard", userId]);

    if (previousDashboardData) {
      queryClient.setQueryData(["dashboard", userId], (old: any) => {
        if (!old) return old;
        const oldSpent = old.todayExpense?.spent || 0;
        const diff = newTotalSpent - oldSpent;
        
        return {
          ...old,
          todayExpense: {
            ...old.todayExpense,
            spent: newTotalSpent,
            saved: (old.todayExpense?.limit || 0) - newTotalSpent,
            note: newNote,
          },
          summary: {
            ...old.summary,
            totalSpent: (old.summary?.totalSpent || 0) + diff,
          }
        };
      });
    }

    try {
      await saveTodayExpense(userId, newTotalSpent, newNote);
      setIsSaved(true);
      toast.success(isEditing ? "Expense updated successfully!" : "Expense added successfully!");
      setSpent("");
      setNote("");
      setIsEditing(false);
      
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
      queryClient.invalidateQueries({ queryKey: ["insights", userId] });
      queryClient.invalidateQueries({ queryKey: ["calendar", userId] });

      setTimeout(() => {
        setIsSaved(false);
      }, 1000);
    } catch {
      if (previousDashboardData) {
        queryClient.setQueryData(["dashboard", userId], previousDashboardData);
      }
      toast.error("Failed to save expense");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPreset = (amount: number) => {
    const current = Number(spent) || 0;
    setSpent((current + amount).toString());
    setIsSaved(false);
  };

  return (
    <div className="bg-white dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800/80 rounded-[1.5rem] p-4 shadow-[0_2px_6px_rgba(0,0,0,0.03)] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#15803d] dark:text-emerald-400" />
          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {isEditing ? "Edit Today's Entry" : "Add Today's Spending"}
          </p>
        </div>
        {isEditing && (
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              setSpent("");
              setNote("");
            }}
            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer font-semibold"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Amount Input */}
      <div className="relative flex items-center bg-[#f7f5f0] dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-[#1d3f32]/20 focus-within:border-[#1d3f32] transition-all">
        <div className="h-7 w-7 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 font-bold text-sm select-none mr-2.5 shadow-2xs">
          ₹
        </div>
        <input
          type="number"
          placeholder="0"
          value={spent}
          onChange={(e) => {
            setSpent(e.target.value);
            setIsSaved(false);
          }}
          className="flex-1 bg-transparent border-none text-zinc-900 dark:text-zinc-100 font-extrabold text-xl focus:outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
        />
        {spent && (
          <button
            type="button"
            onClick={() => setSpent("")}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Quick-Add Presets */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        {[50, 100, 200, 500].map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => handleAddPreset(amount)}
            className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-[#f7f5f0] dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 flex items-center space-x-0.5 active:scale-95"
          >
            <Plus className="h-2.5 w-2.5 text-zinc-400" />
            <span>₹{amount}</span>
          </button>
        ))}
        {spent && (
          <button
            type="button"
            onClick={() => setSpent("0")}
            className="px-2 py-1 rounded-xl text-[10px] font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
          >
            Set ₹0
          </button>
        )}
      </div>

      {/* Note Input */}
      <div className="flex items-center bg-[#f7f5f0]/60 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/60 rounded-xl px-3 py-2">
        <Tag className="h-3.5 w-3.5 text-zinc-400 mr-2 shrink-0" />
        <input
          placeholder="Note: e.g. Coffee, Lunch, Bus (optional)"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setIsSaved(false);
          }}
          className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
        />
      </div>

      {/* Action Button */}
      <Button
        onClick={handleSave}
        disabled={isLoading}
        className={cn(
          "h-11 w-full rounded-xl text-xs font-bold transition-all duration-200 shadow-xs cursor-pointer active:scale-[0.99]",
          isSaved 
            ? "bg-[#15803d] text-white" 
            : "bg-[#1d3f32] hover:bg-[#163428] text-white"
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSaved ? (
          <div className="flex items-center justify-center space-x-1.5">
            <Check className="h-4 w-4 stroke-[2.5]" />
            <span>Saved Successfully</span>
          </div>
        ) : (
          isEditing ? "Save Changes" : "Add Today's Expense"
        )}
      </Button>

      {/* Summary of entries logged today */}
      {initialSpent > 0 && !isEditing && (
        <div className="bg-[#f7f5f0]/80 dark:bg-zinc-900/60 rounded-2xl p-3 border border-zinc-200/40 dark:border-zinc-800/40 flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
            <div className="h-7 w-7 rounded-lg bg-[#e8f6ed] dark:bg-emerald-950/40 flex items-center justify-center text-[#15803d] dark:text-emerald-400 shrink-0">
              <Check className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-zinc-900 dark:text-zinc-100">
                Log Today: ₹{initialSpent}
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                {initialNote || "No note recorded"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSpent(initialSpent.toString());
              setNote(initialNote);
              setIsEditing(true);
            }}
            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-100 dark:bg-[#1b4332]/35 px-3 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
