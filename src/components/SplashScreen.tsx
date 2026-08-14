"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

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
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={`cream-${i}`}
              className={`absolute rounded-full ${i % 2 === 0 ? "bg-[#e8456b]" : "bg-[#ff8da6]"}`}
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, Math.random() * 1.5 + 0.5, 0],
                x: (Math.random() - 0.5) * (typeof window !== 'undefined' ? window.innerWidth * 0.8 : 300),
                y: (Math.random() - 0.5) * (typeof window !== 'undefined' ? window.innerHeight * 0.8 : 300),
              }}
              transition={{
                duration: 1 + Math.random() * 0.5,
                delay: 0.2, // Explode outwards
                ease: "easeOut"
              }}
              style={{
                width: `${Math.random() * 15 + 10}px`,
                height: `${Math.random() * 15 + 10}px`,
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
