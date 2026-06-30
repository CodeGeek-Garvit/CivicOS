import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const scenes = [
  { text: "Every year... critical civic issues remain unnoticed until they become expensive emergencies." },
  { text: "Road damage. Water leakages. Illegal dumping. Broken infrastructure. Small incidents. Massive consequences." },
  { text: "Municipal teams still spend valuable time prioritizing, dispatching, and verifying operations manually." },
  { text: "What if an AI system could detect, prioritize, coordinate, verify, and close every civic issue?" },
];

export default function StartupIntro({ onComplete }: { onComplete: () => void }) {
  const [currentScene, setCurrentScene] = useState(0);
  const [showLogo, setShowLogo] = useState(false);

  useEffect(() => {
    if (currentScene < scenes.length) {
      const timer = setTimeout(() => {
        setCurrentScene((prev) => prev + 1);
      }, 2000); // 2s per text scene
      return () => clearTimeout(timer);
    } else {
      setShowLogo(true);
      const timer = setTimeout(() => {
        onComplete();
      }, 4000); // Logo + loading time
      return () => clearTimeout(timer);
    }
  }, [currentScene, onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        {!showLogo ? (
          <motion.div
            key={currentScene}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-white text-center max-w-2xl"
          >
            <p className="text-3xl font-light tracking-wide leading-relaxed">
              {scenes[currentScene]?.text}
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-4"
          >
            <h1 className="text-6xl font-black text-white tracking-tighter">
              Civic<span className="text-[#5B4BFF]">OS</span>
            </h1>
            <p className="text-sm text-slate-400 uppercase tracking-widest font-medium">
              Autonomous Civic Intelligence Platform
            </p>
            <div className="h-1 w-24 bg-slate-800 rounded-full mx-auto overflow-hidden">
              <motion.div 
                className="h-full bg-[#5B4BFF]"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
