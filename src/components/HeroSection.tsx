import { useState } from 'react';

export default function HeroSection() {
  const [zip, setZip] = useState('');

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 40%, #3b82f6 75%, #60a5fa 100%)',
      }}
    >
      {/* Decorative background circles */}
      <div
        className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10"
        style={{ background: 'rgba(255,255,255,0.3)' }}
      />
      <div
        className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-10"
        style={{ background: 'rgba(255,255,255,0.2)' }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
        {/* Tag line */}
        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 rounded-full px-4 py-1.5 mb-6">
          <span className="text-yellow-300 text-sm">✦</span>
          <span className="text-white/90 text-sm font-medium tracking-wide">
            Riverside County · State-Funded Programs
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-5">
          Riverside County<br />
          <span className="text-blue-200">Exceptional Care</span> Finder
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-blue-100 leading-relaxed max-w-2xl mx-auto mb-10">
          Find state-funded day programs and vocational training for your loved ones.
          Real programs, real reviews, right in your community.
        </p>

        {/* Zip code search bar (visual prototype) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xl mx-auto">
          <div className="relative flex-1 w-full">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              📍
            </span>
            <input
              type="text"
              placeholder="Enter your ZIP code (e.g. 92880)"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              maxLength={5}
              className="w-full pl-11 pr-4 py-4 rounded-xl text-slate-800 text-base font-medium bg-white shadow-lg border border-white/60 focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-slate-400"
            />
          </div>
          <button
            type="button"
            className="w-full sm:w-auto px-8 py-4 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-semibold text-base rounded-xl shadow-lg transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            Search Programs
          </button>
        </div>

        {/* Trust indicators */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-blue-200 text-sm">
          <span className="flex items-center gap-1.5">
            <span>🛡️</span> State-Verified Providers
          </span>
          <span className="flex items-center gap-1.5">
            <span>✨</span> AI-Powered Summaries
          </span>
          <span className="flex items-center gap-1.5">
            <span>💬</span> Real Parent Reviews
          </span>
        </div>
      </div>
    </div>
  );
}
