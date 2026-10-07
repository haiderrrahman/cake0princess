"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const PARTICLES = [
  { size: 16, x: 70, y: -90, scale: 1.2, duration: 1.2 },
  { size: 22, x: -80, y: 60, scale: 0.9, duration: 1.4 },
  { size: 14, x: 100, y: 80, scale: 1.4, duration: 1.1 },
  { size: 18, x: -120, y: -70, scale: 0.8, duration: 1.3 },
  { size: 24, x: 140, y: -50, scale: 1.1, duration: 1.5 },
  { size: 12, x: -100, y: 120, scale: 1.3, duration: 1.2 },
  { size: 20, x: 50, y: 140, scale: 0.7, duration: 1.0 },
  { size: 15, x: -140, y: -40, scale: 1.0, duration: 1.4 },
  { size: 22, x: 110, y: -130, scale: 1.2, duration: 1.3 },
  { size: 13, x: -60, y: -140, scale: 0.9, duration: 1.1 },
  { size: 17, x: 130, y: 90, scale: 1.3, duration: 1.4 },
  { size: 21, x: -130, y: 100, scale: 1.1, duration: 1.2 },
];

export default function SplashScreen() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSeenSplash = sessionStorage.getItem("splashShown");
      if (hasSeenSplash) {
        setShow(false);
        return;
      }
      sessionStorage.setItem("splashShown", "true");
    }

    // Hide the splash screen after 3 seconds for a fast, cute reveal
    const timer = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(15px)", transition: { duration: 0.8 } }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-[#FFFdfa] via-[#Fef6f8] to-[#FFFdfa] dark:from-[#0D0A1A] dark:via-[#1A0B1C] dark:to-[#0D0A1A] overflow-hidden"
        >
          {/* Glowing Sun Flare (Flashes fast and bright) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, filter: "brightness(1) blur(20px)" }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 2], filter: "brightness(2) blur(40px)" }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
            className="absolute w-96 h-96 bg-gradient-to-tr from-yellow-200 via-white to-pink-100 rounded-full mix-blend-overlay dark:mix-blend-screen"
          />

          {/* Pink Cream Splashes */}
          {PARTICLES.map((p, i) => (
            <motion.div
              key={`cream-${i}`}
              className={`absolute rounded-full ${i % 2 === 0 ? "bg-[#e8456b]" : "bg-[#ff8da6]"}`}
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, p.scale, 0],
                x: p.x,
                y: p.y,
              }}
              transition={{
                duration: p.duration,
                delay: 0.2, // Explode outwards
                ease: "easeOut"
              }}
              style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
                filter: "drop-shadow(0px 4px 6px rgba(232, 69, 107, 0.3))"
              }}
            />
          ))}

          {/* Majestic Logo Reveal with Sun Glare Sweep */}
          <motion.div
            initial={{ 
              opacity: 0, 
              scale: 0.5,
              y: 50,
            }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: 0,
            }}
            transition={{
              duration: 0.8,
              type: "spring",
              bounce: 0.4
            }}
            className="relative z-10 flex flex-col items-center"
          >
            <div className="relative w-72 h-72 md:w-96 md:h-96 drop-shadow-2xl">
              <Image
                src="/cp-logo.png"
                alt="Cake Princess Logo"
                fill
                className="object-contain"
                priority
              />
              {/* Sun Glare sweeping across the logo */}
              <motion.div
                initial={{ x: "-150%", opacity: 0 }}
                animate={{ x: "150%", opacity: [0, 0.6, 0] }}
                transition={{ duration: 1.5, delay: 0.3, ease: "easeInOut" }}
                className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white to-transparent skew-x-12 mix-blend-overlay pointer-events-none"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
