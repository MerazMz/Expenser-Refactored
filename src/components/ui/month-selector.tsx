"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { format, subMonths, parseISO, isAfter, isBefore, startOfMonth } from "date-fns";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface MonthSelectorProps {
  currentDate: Date;
  onSelectMonth: (date: Date) => void;
  userCreatedAt?: string | Date | null;
  monthsList?: string[];
  className?: string;
  align?: "center" | "right" | "left";
}

export function MonthSelector({
  currentDate,
  onSelectMonth,
  userCreatedAt,
  monthsList,
  className,
  align = "center",
}: MonthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Compute available months
  const availableMonths = useMemo(() => {
    if (monthsList && monthsList.length > 0) {
      return monthsList.map((mStr) => {
        const [y, m] = mStr.split("-").map(Number);
        const d = new Date(y, m - 1, 1);
        return {
          date: d,
          label: format(d, "MMMM yyyy"),
          value: mStr,
        };
      });
    }

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    
    let earliestMonthStart = startOfMonth(now);
    if (userCreatedAt) {
      try {
        const createdDate = typeof userCreatedAt === "string" ? parseISO(userCreatedAt) : new Date(userCreatedAt);
        if (!isNaN(createdDate.getTime())) {
          earliestMonthStart = startOfMonth(createdDate);
        }
      } catch {
        earliestMonthStart = startOfMonth(now);
      }
    }

    const months: { date: Date; label: string; value: string }[] = [];
    let cur = currentMonthStart;

    let safetyCounter = 0;
    while ((isAfter(cur, earliestMonthStart) || cur.getTime() === earliestMonthStart.getTime()) && safetyCounter < 60) {
      months.push({
        date: new Date(cur),
        label: format(cur, "MMMM yyyy"),
        value: format(cur, "yyyy-MM"),
      });
      cur = subMonths(cur, 1);
      safetyCounter++;
    }

    if (months.length === 0) {
      months.push({
        date: now,
        label: format(now, "MMMM yyyy"),
        value: format(now, "yyyy-MM"),
      });
    }

    return months;
  }, [monthsList, userCreatedAt]);

  const selectedValue = format(currentDate, "yyyy-MM");

  return (
    <div className={cn("relative inline-block", className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer select-none"
        aria-expanded={isOpen}
      >
        <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          {format(currentDate, "MMMM yyyy")}
        </span>
        <ChevronDown 
          className={cn(
            "w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 transition-transform duration-200 stroke-[2.5]",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute top-full mt-1.5 z-50 min-w-[170px] max-h-60 overflow-y-auto rounded-2xl bg-white dark:bg-[#18181b] border border-zinc-200/90 dark:border-zinc-800 p-1.5 shadow-xl",
              align === "center" && "left-1/2 -translate-x-1/2",
              align === "right" && "right-0",
              align === "left" && "left-0"
            )}
          >
            <div className="space-y-0.5">
              {availableMonths.map((m) => {
                const isSelected = m.value === selectedValue;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => {
                      onSelectMonth(m.date);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left",
                      isSelected
                        ? "bg-[#1d3f32] text-white"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-[#f7f5f0] dark:hover:bg-zinc-800"
                    )}
                  >
                    <span>{m.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5] ml-2" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
