"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

const links = [
  { 
    href: "/", 
    label: "الرئيسية", 
    emoji: "✨",
    activeEmoji: "🌟",
    gradient: "from-[#FF3366] to-[#E040FB]"
  },
  { 
    href: "/courses", 
    label: "الأكاديمية", 
    emoji: "🎓",
    activeEmoji: "💫",
    gradient: "from-[#E040FB] to-[#FF3366]"
  },
  { 
    href: "/shop", 
    label: "الكيك", 
    emoji: "🎂",
    activeEmoji: "🍰",
    gradient: "from-[#F5C842] to-[#FF3366]"
  },
  {
    href: "/supplies",
    label: "مواد الكيك",
    emoji: "🎨",
    activeEmoji: "🖌️",
    gradient: "from-[#33FF99] to-[#00CCFF]"
  },
  { 
    href: "/profile", 
    label: "حساب", 
    emoji: "💎",
    activeEmoji: "👑",
    gradient: "from-[#F5C842] to-[#E040FB]"
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [pressed, setPressed] = useState<string | null>(null);

  const hideOnPaths = ["/login", "/checkout", "/cart"];

  if (hideOnPaths.includes(pathname || "")) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Soft background blur zone */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#FFF8F0]/90 dark:from-[#0D0A1A]/90 to-transparent pointer-events-none" />
      
      {/* The floating pill nav */}
      <div className="relative mx-4 mb-5 flex items-center justify-around px-2 py-2 rounded-[28px] glass shadow-[0_8px_32px_rgba(255,51,102,0.18),0_2px_8px_rgba(0,0,0,0.08)] border border-white/60 dark:border-white/10">
        
        {/* Active background pill */}
        {links.map((link) => {
          const isActive = pathname === link.href || 
            (link.href !== '/' && pathname?.startsWith(link.href));
          if (!isActive) return null;
          const idx = links.findIndex(l => l.href === link.href);
          return (
            <div 
              key={`bg-${link.href}`}
              className="absolute top-2 bottom-2 rounded-[20px] transition-all duration-500"
              style={{ 
                left: `calc(${(idx / links.length) * 100}% + 8px)`,
                width: `calc(${100 / links.length}% - 16px)`,
                background: `linear-gradient(135deg, var(--from), var(--to))`,
              }}
            />
          );
        })}

        {links.map((link) => {
          const isActive = pathname === link.href || 
            (link.href !== '/' && pathname?.startsWith(link.href));
          const isPressed = pressed === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              onMouseDown={() => setPressed(link.href)}
              onMouseUp={() => setPressed(null)}
              onTouchStart={() => setPressed(link.href)}
              onTouchEnd={() => setPressed(null)}
              className={cn(
                "relative flex flex-col items-center justify-center py-2.5 px-4 rounded-[20px] flex-1 z-10 transition-all duration-300 select-none",
                isActive ? "text-white" : "text-gray-400 dark:text-gray-500",
                isPressed && "scale-90"
              )}
            >
              {/* Glow for active */}
              {isActive && (
                <div className={cn(
                  "absolute inset-0 rounded-[20px] opacity-80",
                  `bg-gradient-to-br ${link.gradient}`
                )} />
              )}
              
              {/* Icon */}
              <span 
                className={cn(
                  "relative text-2xl transition-all duration-300 leading-none",
                  isActive ? "-translate-y-0.5 drop-shadow-md" : "opacity-60",
                  isActive && "animate-float"
                )}
              >
                {isActive ? link.activeEmoji : link.emoji}
              </span>

              {/* Label */}
              <span className={cn(
                "relative text-[9px] font-black mt-1 transition-all duration-300 leading-none",
                isActive ? "text-white" : "text-gray-400 dark:text-gray-600"
              )}>
                {link.label}
              </span>

              {/* Active dot pulse */}
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white animate-pulse-glow" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
