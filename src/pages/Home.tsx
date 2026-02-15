import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo3D } from "@/components/Logo3D";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Add public-page class to body for proper scrolling
  useEffect(() => {
    document.body.classList.add('public-page');
    return () => {
      document.body.classList.remove('public-page');
    };
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0f14] relative overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-end p-4 md:p-6">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 shadow-lg">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-white/90 hover:text-white hover:bg-white/10 px-4 py-2"
            onClick={() => navigate('/login')}
          >
            Login
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 bg-white/20" />
          <Button
            variant="ghost"
            size="sm"
            className="text-white/90 hover:text-white hover:bg-white/10 px-3"
            onClick={() => {/* toggle language */}}
          >
            العربية
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-screen flex flex-col items-center justify-center px-4 relative">
        {/* 3D Background W */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-[20rem] md:text-[30rem] lg:text-[40rem] font-bold text-white/[0.03] select-none">W</div>
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="relative z-10 text-center max-w-4xl mx-auto"
        >
          {/* Logo */}
          <motion.div variants={itemVariants} className="mb-6 md:mb-8">
            <Logo3D size="xl" className="mx-auto" />
          </motion.div>

          {/* Brand Name */}
          <motion.div variants={itemVariants} className="mb-3 md:mb-4">
            <h1 className="text-4xl md:text-6xl lg:text-8xl font-light tracking-[0.3em] text-white">
              WAKTI
            </h1>
          </motion.div>

          {/* Tagline */}
          <motion.div variants={itemVariants} className="mb-8 md:mb-12">
            <p className="text-sm md:text-xl lg:text-2xl font-light tracking-[0.15em] text-white/70">
              SMARTER . FASTER . EASIER
            </p>
          </motion.div>

          {/* CTA Button */}
          <motion.div variants={itemVariants} className="mb-4 md:mb-6">
            <Button
              size="lg"
              className="bg-[#e9ceb0] hover:bg-[#d4b896] text-[#060541] font-semibold py-5 md:py-6 px-8 md:px-12 rounded-full text-base md:text-xl shadow-lg hover:shadow-xl transition-all duration-300"
              onClick={() => navigate('/signup')}
            >
              CREATE YOUR ACCOUNT
            </Button>
          </motion.div>

          {/* Price Link */}
          <motion.div variants={itemVariants}>
            <button
              onClick={() => navigate('/pricing')}
              className="text-white/50 hover:text-white/80 text-xs md:text-sm tracking-widest uppercase transition-colors"
            >
              PRICE
            </button>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          className="absolute bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-white/40 text-xs tracking-[0.3em] uppercase">SCROLL</span>
          <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-4 px-6">
        <div className="flex items-center justify-center gap-4 md:gap-8 text-[10px] md:text-xs text-white/40">
          <button onClick={() => navigate('/privacy')} className="hover:text-white/70 transition-colors">
            Privacy & Terms
          </button>
          <span className="hidden md:inline">•</span>
          <button onClick={() => navigate('/contact')} className="hover:text-white/70 transition-colors">
            Contact Us
          </button>
          <span className="hidden md:inline">•</span>
          <button onClick={() => navigate('/login')} className="hover:text-white/70 transition-colors">
            Sign in
          </button>
          <span className="hidden md:inline">•</span>
          <span>Made by TMW</span>
        </div>
        <div className="text-center mt-2 text-[8px] md:text-[10px] text-white/30">
          © 2025 WAKTI All Rights Reserved
        </div>
      </footer>
    </div>
  );
}

