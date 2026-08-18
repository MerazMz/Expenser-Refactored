"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Calendar as CalendarIcon, BarChart2, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/insights", label: "Insights", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  // Hide nav on login and onboarding
  if (pathname === "/login" || pathname === "/onboarding") {
    return null;
  }

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm select-none">
      <nav className="bg-white/80 dark:bg-zinc-950/85 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/60 rounded-[1.5rem] p-1 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex items-center justify-between">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === "/dashboard" && pathname === "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center py-2 px-2.5 flex-1 cursor-pointer transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="active-nav-pill"
                  className="absolute inset-0 bg-[#e4dfd3] dark:bg-zinc-800/80 rounded-2xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon 
                className={cn(
                  "h-4.5 w-4.5 transition-colors duration-200", 
                  isActive ? "text-zinc-950 dark:text-white stroke-[2.25]" : "text-zinc-400 dark:text-zinc-500 stroke-[1.75]"
                )} 
              />
              <span 
                className={cn(
                  "text-[9px] tracking-tight mt-0.5 transition-colors duration-200", 
                  isActive ? "text-zinc-950 dark:text-white font-extrabold" : "text-zinc-400 dark:text-zinc-500 font-semibold"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
