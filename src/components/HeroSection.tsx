import { allPrograms } from '../data/programs';

interface Props {
  selectedState: string;
  selectedCounty: string;
}

export default function HeroSection({ selectedState, selectedCounty }: Props) {
  const programCount = allPrograms.length;

  const locationLabel =
    selectedCounty && selectedState
      ? `${selectedCounty} County, ${selectedState}`
      : selectedState
      ? selectedState
      : null;

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
            {locationLabel
              ? `${locationLabel} · Regional Center Funded`
              : 'California · Regional Center Funded'}
          </span>
        </div>

        {/* Dynamic Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-5">
          {locationLabel ? (
            <>
              Adult Day Programs in{' '}
              <span className="text-blue-200">{locationLabel}</span>
            </>
          ) : (
            <>
              California{' '}
              <span className="text-blue-200">Adult Day Program Finder</span>
            </>
          )}
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-blue-100 leading-relaxed max-w-2xl mx-auto mb-8">
          Find day programs for adults with autism, Down syndrome, cerebral palsy, and
          intellectual disabilities — funded through California's Regional Center system
          at no cost to your family.
        </p>

        {/* Trust indicators */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-blue-200 text-sm">
          <span className="flex items-center gap-1.5">
            <span>🛡️</span> CCLD-Licensed Providers
          </span>
          <span className="flex items-center gap-1.5">
            <span>💰</span> No Cost to Families
          </span>
          <span className="flex items-center gap-1.5">
            <span>📍</span> {programCount.toLocaleString()} Programs Statewide
          </span>
        </div>
      </div>
    </div>
  );
}
