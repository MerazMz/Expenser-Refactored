"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const routes = ["/dashboard", "/calendar", "/insights", "/settings"];

export function SwipeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    // Only enable swiping on main app pages (exclude login and onboarding)
    if (pathname === "/login" || pathname === "/onboarding") {
      return;
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (startX.current === null || startY.current === null) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const diffX = endX - startX.current;
      const diffY = endY - startY.current;

      // Primary horizontal swipe (threshold 70px, vertical limit 40px)
      if (Math.abs(diffX) > 70 && Math.abs(diffY) < 40) {
        let activePath = pathname;
        if (pathname === "/") activePath = "/dashboard";

        const currentIndex = routes.indexOf(activePath);
        if (currentIndex !== -1) {
          if (diffX < 0) {
            // Swipe Left (drag finger left) -> Next Page
            const nextIndex = currentIndex + 1;
            if (nextIndex < routes.length) {
              router.push(routes[nextIndex]);
            }
          } else {
            // Swipe Right (drag finger right) -> Previous Page
            const prevIndex = currentIndex - 1;
            if (prevIndex >= 0) {
              router.push(routes[prevIndex]);
            }
          }
        }
      }

      startX.current = null;
      startY.current = null;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pathname, router]);

  return <>{children}</>;
}
