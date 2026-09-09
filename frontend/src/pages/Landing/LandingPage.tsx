import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, BarChart3, Lightbulb, ArrowRight, ShieldCheck } from 'lucide-react';
import { LandingGlobe, IntroPhase } from './LandingGlobe';

// Deterministic realistic stars for aesthetic deep space background
const STARS = Array.from({ length: 75 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const x = ((seed / 233280) * 100).toFixed(2);
  const seed2 = (seed * 9301 + 49297) % 233280;
  const y = ((seed2 / 233280) * 100).toFixed(2);
  const size = i % 12 === 0 ? 2.4 : i % 4 === 0 ? 1.6 : 1.0;
  const opacity = (0.35 + (i % 6) * 0.11).toFixed(2);
  const duration = (2.2 + (i % 5) * 0.7).toFixed(1);
  const delay = ((i % 7) * 0.4).toFixed(1);
  const color = i % 7 === 0 ? '#FEF08A' : i % 9 === 0 ? '#BAE6FD' : '#FFFFFF';
  return { x, y, size, opacity, duration, delay, color };
});

export const LandingPage: React.FC = () => {
  const [introPhase, setIntroPhase] = useState<IntroPhase>('space_spin');
  const heroSlotRef = useRef<HTMLDivElement>(null);
  const [centerOffset, setCenterOffset] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return {
        x: -(window.innerWidth * 0.22),
        y: 0,
      };
    }
    return { x: 0, y: 0 };
  });

  const isDocked = introPhase === 'transitioning' || introPhase === 'settled';
  const isTransitioning = introPhase === 'transitioning';
  const isSettled = introPhase === 'settled';

  // Calculate pixel delta between viewport center and the designated hero globe slot
  React.useLayoutEffect(() => {
    const updateOffset = () => {
      if (!heroSlotRef.current) return;
      const rect = heroSlotRef.current.getBoundingClientRect();
      const targetCenterX = rect.left + rect.width / 2;
      const targetCenterY = rect.top + rect.height / 2;
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;
      setCenterOffset({
        x: screenCenterX - targetCenterX,
        y: screenCenterY - targetCenterY,
      });
    };

    updateOffset();
    window.addEventListener('resize', updateOffset);
    return () => {
      window.removeEventListener('resize', updateOffset);
    };
  }, []);

  // Cinematic Intro Sequence Timers
  useEffect(() => {
    // As soon as all points are plotted (~1050ms), transition immediately begins
    // while the globe continues in its spinning and decelerating position
    const t1 = setTimeout(() => {
      setIntroPhase('transitioning');
    }, 1100);

    // Fully settled landing page
    const t2 = setTimeout(() => {
      setIntroPhase('settled');
    }, 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const handleSkip = () => {
    setIntroPhase('settled');
  };

  return (
    <div className="relative w-full min-h-screen bg-[#FAF8F3] text-[#475569] overflow-hidden font-sans select-none">
      
      {/* =========================================================================
          REALISTIC AESTHETIC DEEP SPACE COSMOS (FULLSCREEN INTRO LAYER)
          ========================================================================= */}
      <div
        className={`fixed inset-0 w-full h-full z-10 transition-opacity duration-1000 ease-out select-none overflow-hidden ${
          isDocked ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, #0c1527 0%, #060913 55%, #020307 100%)',
        }}
      >
        {/* Realistic Multi-Layered Stars */}
        {STARS.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none animate-pulse"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: star.color,
              boxShadow: star.size > 1.8 ? `0 0 ${star.size * 3}px ${star.color}` : 'none',
              opacity: Number(star.opacity),
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}

        {/* Deep Space Cosmic Nebula Dust Glows */}
        <div className="absolute top-[18%] left-[12%] w-[650px] h-[650px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.08)_0%,transparent_70%)] blur-[90px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[10%] w-[750px] h-[750px] rounded-full bg-[radial-gradient(circle,rgba(217,119,6,0.07)_0%,transparent_70%)] blur-[100px] pointer-events-none" />
        <div className="absolute top-[42%] right-[28%] w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.06)_0%,transparent_70%)] blur-[90px] pointer-events-none" />

        {/* Subtle Celestial Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.75)_100%)] pointer-events-none" />

        {/* Skip Intro Control */}
        {!isDocked && (
          <button
            onClick={handleSkip}
            className="absolute top-6 right-8 z-50 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 hover:text-white text-[12.5px] font-medium tracking-wide backdrop-blur-md transition-all shadow-lg select-none cursor-pointer"
          >
            Skip Intro →
          </button>
        )}
      </div>

      {/* =========================================================================
          AMBIENT RADIANCE & SILKY DUNES (WARM AMBER & GOLD PALETTE - ZERO BLUE)
          Fades in as the space background transitions out
          ========================================================================= */}
      <div
        className={`absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden transition-opacity duration-1000 ease-out ${
          isDocked ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      >
        {/* Warm Golden Ambient Glows */}
        <div className="absolute top-0 right-0 w-[950px] h-[750px] bg-[radial-gradient(ellipse_at_top_right,rgba(254,243,199,0.7),transparent_70%)]" />
        {/* Globe Backlight Aura (Brightens the Globe brilliantly) */}
        <div className="absolute top-[18%] right-[8%] w-[680px] h-[680px] bg-[radial-gradient(circle,rgba(253,224,71,0.28)_0%,rgba(254,243,199,0.42)_45%,transparent_70%)]" />
        <div className="absolute bottom-0 left-0 w-[850px] h-[700px] bg-[radial-gradient(ellipse_at_bottom_left,rgba(254,240,138,0.32),transparent_65%)]" />

        {/* Soft Silky Fluid Wave Dunes at the Bottom */}
        <svg
          className="absolute bottom-0 left-0 w-full h-[320px] md:h-[380px] object-cover"
          viewBox="0 0 1920 400"
          fill="none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="traject-wave-back" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FAF8F3" stopOpacity="0.85" />
              <stop offset="45%" stopColor="#F5F1E5" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#EDE7D8" stopOpacity="0.95" />
            </linearGradient>

            <linearGradient id="traject-wave-front" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
              <stop offset="40%" stopColor="#FAF8F3" stopOpacity="0.92" />
              <stop offset="80%" stopColor="#F6F3EB" stopOpacity="0.96" />
              <stop offset="100%" stopColor="#EDE8D9" stopOpacity="0.98" />
            </linearGradient>

            <filter id="traject-warm-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="6" stdDeviation="14" floodColor="rgba(195, 185, 165, 0.25)" />
            </filter>
          </defs>

          {/* Back Dune */}
          <path
            d="M-50 240 C 380 180, 780 310, 1240 180 C 1580 90, 1820 140, 2020 60 L 2020 450 L -50 450 Z"
            fill="url(#traject-wave-back)"
          />
          {/* Back Dune Crest Highlight */}
          <path
            d="M-50 240 C 380 180, 780 310, 1240 180 C 1580 90, 1820 140, 2020 60"
            stroke="rgba(255, 255, 255, 0.9)"
            strokeWidth="3"
            fill="none"
            filter="url(#traject-warm-shadow)"
          />

          {/* Front Dune */}
          <path
            d="M-50 290 C 350 230, 820 340, 1260 220 C 1600 130, 1840 190, 2020 120 L 2020 450 L -50 450 Z"
            fill="url(#traject-wave-front)"
          />
          {/* Front Dune Crest Line */}
          <path
            d="M-50 290 C 350 230, 820 340, 1260 220 C 1600 130, 1840 190, 2020 120"
            stroke="rgba(255, 255, 255, 0.98)"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>

      {/* =========================================================================
          TOP INSTITUTIONAL HEADER NAVIGATION
          Fades and glides in from the top
          ========================================================================= */}
      <header
        className={`fixed top-0 left-0 w-full h-[80px] z-50 bg-transparent transition-all duration-1000 ease-out ${
          isDocked ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="max-w-[1560px] mx-auto h-full px-8 md:px-14 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group outline-none">
            <div className="flex items-center justify-center drop-shadow-[0_4px_12px_rgba(245,158,11,0.28)] transition-transform group-hover:scale-105">
              <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
                <path d="M18 3L4 29L18 22L18 3Z" fill="url(#prism-left)" />
                <path d="M18 3L32 29L18 22L18 3Z" fill="url(#prism-right)" />
                <path d="M4 29L18 22L24 29L4 29Z" fill="url(#prism-bottom)" />
                <defs>
                  <linearGradient id="prism-left" x1="4" y1="3" x2="18" y2="29" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FDE047" />
                    <stop offset="1" stopColor="#F59E0B" />
                  </linearGradient>
                  <linearGradient id="prism-right" x1="18" y1="3" x2="32" y2="29" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#374151" />
                    <stop offset="1" stopColor="#111727" />
                  </linearGradient>
                  <linearGradient id="prism-bottom" x1="4" y1="22" x2="24" y2="29" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F59E0B" />
                    <stop offset="1" stopColor="#D97706" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="font-brand text-[18px] font-bold text-[#111727] tracking-[0.14em] leading-none">
              TRAJECT
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-10">
            <Link to="/overview" className="text-[14.5px] font-medium text-slate-700 hover:text-[#D97706] transition-colors">
              Product
            </Link>
            <Link to="/trends" className="text-[14.5px] font-medium text-slate-700 hover:text-[#D97706] transition-colors">
              Intelligence
            </Link>
            <Link to="/explorer" className="text-[14.5px] font-medium text-slate-700 hover:text-[#D97706] transition-colors">
              Sources
            </Link>
            <Link to="/overview" className="text-[14.5px] font-medium text-slate-700 hover:text-[#D97706] transition-colors">
              About
            </Link>
          </nav>

          {/* Action CTA */}
          <div className="flex items-center">
            <Link
              to="/overview"
              className="font-brand text-[14px] font-medium text-white bg-[#181D24] hover:bg-[#111727] px-6 py-2.5 rounded-full shadow-[0_4px_14px_rgba(24,29,36,0.22)] hover:shadow-[0_6px_18px_rgba(24,29,36,0.3)] hover:-translate-y-0.5 transition-all"
            >
              Get Started
            </Link>
          </div>

        </div>
      </header>

      {/* =========================================================================
          MAIN HERO VIEWPORT
          ========================================================================= */}
      <main className="relative w-screen min-h-screen flex items-center px-8 md:px-14 z-20 pt-16 pb-12 bg-transparent">
        <div className="max-w-[1560px] w-full mx-auto grid grid-cols-1 lg:grid-cols-[minmax(480px,580px)_1fr] items-center gap-8 lg:gap-14">

          {/* Left Hero Content Column - Emerges fading in from the bottom */}
          <div className="flex flex-col justify-center z-20">
            
            {/* Headline */}
            <h1
              className={`font-brand text-[clamp(44px,4.2vw,70px)] font-extrabold leading-[1.04] tracking-[-0.035em] text-[#111727] mb-4 flex flex-col transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] delay-100 ${
                isDocked ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'
              }`}
            >
              <span className="whitespace-nowrap">From Noise</span>
              <span className="whitespace-nowrap">
                to <span className="bg-gradient-to-r from-[#D97706] via-[#EA580C] to-[#9A3412] bg-clip-text text-transparent inline-block drop-shadow-[0_2px_10px_rgba(217,119,6,0.22)]">Narrative.</span>
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className={`text-[18px] font-normal leading-[1.5] text-[#475569] max-w-[460px] mb-8 tracking-[-0.01em] transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] delay-200 ${
                isDocked ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
              }`}
            >
              Real-time social media intelligence for a more informed tomorrow.
            </p>

            {/* Feature Micro-Pills with Subtle Hover Feedback */}
            <div
              className={`flex items-center gap-4 mb-9 flex-wrap transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] delay-300 ${
                isDocked ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
              }`}
            >
              <div className="group/pill flex items-center gap-3 transition-transform duration-150 hover:-translate-y-0.5 cursor-default">
                <div className="w-[40px] h-[40px] rounded-xl bg-[#F59E0B]/12 flex items-center justify-center border border-[#F59E0B]/25 shadow-[0_2px_6px_rgba(245,158,11,0.08)] shrink-0 transition-all duration-150 group-hover/pill:scale-105 group-hover/pill:border-[#F59E0B]/50">
                  <Eye className="w-4 h-4 text-[#D97706]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-brand text-[13.5px] font-bold text-[#111727] leading-tight">Monitor</span>
                  <span className="text-[11.5px] font-medium text-[#8591A5] leading-tight">Real-time activity</span>
                </div>
              </div>

              <div className="group/pill flex items-center gap-3 transition-transform duration-150 hover:-translate-y-0.5 cursor-default">
                <div className="w-[40px] h-[40px] rounded-xl bg-[#F59E0B]/12 flex items-center justify-center border border-[#F59E0B]/25 shadow-[0_2px_6px_rgba(245,158,11,0.08)] shrink-0 transition-all duration-150 group-hover/pill:scale-105 group-hover/pill:border-[#F59E0B]/50">
                  <BarChart3 className="w-4 h-4 text-[#D97706]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-brand text-[13.5px] font-bold text-[#111727] leading-tight">Understand</span>
                  <span className="text-[11.5px] font-medium text-[#8591A5] leading-tight">Context & patterns</span>
                </div>
              </div>

              <div className="group/pill flex items-center gap-3 transition-transform duration-150 hover:-translate-y-0.5 cursor-default">
                <div className="w-[40px] h-[40px] rounded-xl bg-[#F59E0B]/12 flex items-center justify-center border border-[#F59E0B]/25 shadow-[0_2px_6px_rgba(245,158,11,0.08)] shrink-0 transition-all duration-150 group-hover/pill:scale-105 group-hover/pill:border-[#F59E0B]/50">
                  <Lightbulb className="w-4 h-4 text-[#D97706]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-brand text-[13.5px] font-bold text-[#111727] leading-tight">Anticipate</span>
                  <span className="text-[11.5px] font-medium text-[#8591A5] leading-tight">What's emerging</span>
                </div>
              </div>
            </div>

            {/* CTAs with Restrained Interactions */}
            <div
              className={`flex items-center gap-4 mb-10 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] delay-400 ${
                isDocked ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
              }`}
            >
              <Link
                to="/overview"
                className="group font-brand text-[15px] font-medium text-white bg-[#181D24] hover:bg-[#111727] active:scale-[0.985] active:translate-y-0 px-7 py-3.5 rounded-full shadow-[0_10px_22px_rgba(24,29,36,0.22)] hover:shadow-[0_14px_28px_rgba(24,29,36,0.3)] hover:-translate-y-0.5 transition-all inline-flex items-center gap-2.5"
              >
                <span>Open Dashboard</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                to="/emerging-trends"
                className="font-brand text-[15px] font-medium text-[#111727] bg-white/85 hover:bg-white active:scale-[0.985] active:translate-y-0 border border-[rgba(226,221,208,0.85)] px-7 py-3.5 rounded-full shadow-[0_4px_14px_rgba(112,128,176,0.06)] hover:-translate-y-0.5 transition-all"
              >
                Learn More
              </Link>
            </div>

            {/* Trust Shield Badge */}
            <div
              className={`flex items-center gap-2 text-[13px] font-medium text-[#8591A5] transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] delay-500 ${
                isDocked ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#8591A5] shrink-0" />
              <span>Built for a safer, more informed world.</span>
            </div>
          </div>

          {/* Right Hero: 3D Globe */}
          <div className="relative w-full flex items-center justify-center select-none">
            
            {/* Constrained Globe Frame (500x500px aspect-square container) */}
            <div
              ref={heroSlotRef}
              className="relative w-full max-w-[480px] sm:max-w-[520px] aspect-square flex items-center justify-center"
            >
              {/* Globe Wrapper gliding smoothly from viewport center to hero column */}
              <div
                className={`relative w-full h-full flex items-center justify-center ${
                  isSettled ? 'z-10' : 'z-40'
                }`}
                style={{
                  transform: isDocked
                    ? 'translate3d(0, 0, 0) scale(1)'
                    : `translate3d(${centerOffset.x}px, ${centerOffset.y}px, 0) scale(1.15)`,
                  transition: isTransitioning
                    ? 'transform 1300ms cubic-bezier(0.16, 1, 0.3, 1)'
                    : 'none',
                  willChange: 'transform',
                }}
              >
                <LandingGlobe introPhase={introPhase} />
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
};
