import type { ReactNode } from 'react';

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
      {children}
    </a>
  );
}

interface NotItem {
  label: string;
  detail: ReactNode;
}

const NOT_ITEMS: NotItem[] = [
  {
    label: 'Adults whose disability began after age 18',
    detail: (
      <>
        The <A href="https://www.dds.ca.gov/services/lanterman-act/">Lanterman Act</A> only covers
        disabilities that originated before age 18. Adults who acquired a disability through a brain
        injury, stroke, MS, or other adult-onset condition are not eligible for Regional Center
        funding and are not served by the programs in this database. These individuals typically
        access services through county Behavioral Health, the{' '}
        <A href="https://www.dor.ca.gov/">Department of Rehabilitation</A>, or Medi-Cal waiver
        programs.
      </>
    ),
  },
  {
    label: 'Medical day programs (CBAS / formerly ADHC)',
    detail: (
      <>
        Programs requiring on-site medical oversight — tube feeding, wound care, nursing staff —
        are called{' '}
        <A href="https://www.aging.ca.gov/Providers_and_Partners/Community-Based_Adult_Services/CBAS_Providers/">
          Community-Based Adult Services (CBAS)
        </A>{' '}
        centers. They are licensed by the{' '}
        <A href="https://www.cdph.ca.gov/">CA Department of Public Health</A> (not CCLD) and funded
        through Medi-Cal managed care, not Regional Centers. A Lanterman-eligible individual can
        attend a CBAS center if their RC places it in their IPP, but those programs are in a
        separate state database and are not included here. Contact your Regional Center directly if
        your family member needs medical-level support during the day.
      </>
    ),
  },
  {
    label: '"Programs Without Walls" and community-based vendors',
    detail: (
      <>
        Some RC-funded day services — including many{' '}
        <A href="https://www.dds.ca.gov/initiatives/sdp/">Self-Determination Program</A> providers
        — operate in community settings (parks, job sites, community centers) without a fixed
        facility. These programs are vendored directly by individual Regional Centers and don't
        appear in any public state database. They're real and often excellent, but they're invisible
        to this site.
      </>
    ),
  },
  {
    label: 'Department of Rehabilitation (DOR) vocational programs',
    detail: (
      <>
        <A href="https://www.dor.ca.gov/">CA Department of Rehabilitation</A> funds
        employment-focused, time-limited services for adults with any disability seeking competitive
        work. These are not ongoing day programs and serve a different goal. The{' '}
        <A href="https://rrd.dor.ca.gov/">Rehabilitation Resources Directory</A> lists DOR-funded
        providers, but there is no public API or data export available.
      </>
    ),
  },
  {
    label: 'County Behavioral Health day programs',
    detail: (
      <>
        County-run day treatment programs for adults with serious mental illness are not included.
        These serve a different population and no statewide database exists — each county manages
        its own provider network through{' '}
        <A href="https://www.dhcs.ca.gov/services/Pages/BHS.aspx">
          DHCS Behavioral Health Services
        </A>
        .
      </>
    ),
  },
  {
    label: 'Private-pay programs',
    detail: (
      <>
        Programs that operate outside the RC/DDS system and charge families directly are not in
        this database.{' '}
        <A href="https://www.cdss.ca.gov/inforesources/community-care-licensing">
          CCLD licensing
        </A>{' '}
        alone does not indicate RC vendorization — a licensed program must separately apply to be
        enrolled as a Regional Center vendor.
      </>
    ),
  },
  {
    label: 'States and counties not yet covered',
    detail:
      'The site currently covers California only, within two counties. Counties and states not yet in the database will show no results.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 40%, #3b82f6 75%, #60a5fa 100%)',
        }}
      >
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10" style={{ background: 'rgba(255,255,255,0.3)' }} />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-10" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 rounded-full px-4 py-1.5 mb-5">
            <span className="text-yellow-300 text-sm">✦</span>
            <span className="text-white/90 text-sm font-medium tracking-wide">About This Site</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
            California Adult Day Program Finder
          </h1>
          <p className="text-lg text-blue-100 leading-relaxed max-w-xl mx-auto">
            A searchable directory of state-licensed Adult Day Programs for adults with developmental disabilities — built for families navigating the Regional Center system.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">

        {/* Who benefits most */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <span className="text-xl">🎯</span>
            <h2 className="text-lg font-bold text-slate-800">Who This Site Is For</h2>
          </div>
          <div className="px-6 py-5 space-y-4 text-slate-600 text-sm leading-relaxed">
            <p>
              This site is built for{' '}
              <strong className="text-slate-800">
                parents and caregivers of adults with intellectual and developmental disabilities (IDD)
              </strong>{' '}
              who are eligible for services under California's{' '}
              <A href="https://www.dds.ca.gov/services/lanterman-act/">Lanterman Act</A>.
            </p>
            <p>You'll get the most out of this site if your family member:</p>
            <ul className="space-y-2 ml-1">
              {[
                'Has a qualifying diagnosis — Autism, Cerebral Palsy, Intellectual Disability, Epilepsy, or a closely related condition',
                'Has a disability that began before age 18',
                'Is already enrolled with a Regional Center, or is beginning the eligibility process',
                'Needs a structured daytime program (skills training, vocational, behavioral, social)',
                'Relies on Regional Center funding (IPP) to pay for services',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* What IS in the database */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <span className="text-xl">✅</span>
            <h2 className="text-lg font-bold text-slate-800">What's in This Database</h2>
          </div>
          <div className="px-6 py-5 space-y-4 text-slate-600 text-sm leading-relaxed">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="font-semibold text-slate-700 mb-1">Program type</div>
                <div>
                  Adult Day Programs licensed by{' '}
                  <A href="https://www.cdss.ca.gov/inforesources/community-care-licensing">
                    CA Community Care Licensing (CCLD)
                  </A>{' '}
                  — the state agency that regulates non-medical day programs for adults with
                  developmental disabilities.
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="font-semibold text-slate-700 mb-1">License status</div>
                <div>
                  Active licenses only. Programs with revoked or inactive licenses are excluded.
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="font-semibold text-slate-700 mb-1">Funding path</div>
                <div>
                  Programs that accept{' '}
                  <A href="https://www.dds.ca.gov/rc/">Regional Center</A> /{' '}
                  <A href="https://www.dds.ca.gov/">DDS</A> funding via an Individual Program Plan
                  (IPP). All programs shown are state-funded for eligible clients.
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="font-semibold text-slate-700 mb-1">Geographic coverage</div>
                <div>
                  Currently: Riverside County and Alameda County, California. Expanding to all CA
                  counties via an automated weekly pipeline.
                </div>
              </div>
            </div>
            <p className="text-slate-500 text-xs pt-1">
              Program data is sourced from the{' '}
              <A href="https://data.chhs.ca.gov/dataset/ccl-facilities">
                California CCLD licensing database
              </A>{' '}
              and enriched with AI-assisted research from public web sources. Data is updated on a
              weekly automated schedule.
            </p>
          </div>
        </section>

        {/* What is NOT in the database */}
        <section className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 flex items-center gap-3" style={{ background: '#fef2f2' }}>
            <span className="text-xl">⚠️</span>
            <h2 className="text-lg font-bold text-slate-800">What's NOT in This Database</h2>
          </div>
          <div className="px-6 py-5 space-y-4 text-sm leading-relaxed">
            <p className="text-slate-500">
              Understanding what this site <em>doesn't</em> cover is just as important as knowing
              what it does. The gaps below are intentional — they represent different funding
              systems, different licensing agencies, or populations this site isn't designed to
              serve.
            </p>
            <div className="space-y-3">
              {NOT_ITEMS.map(({ label, detail }) => (
                <details key={label} className="group border border-slate-100 rounded-xl overflow-hidden">
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors list-none">
                    <span className="text-red-400 shrink-0">✕</span>
                    <span className="font-medium text-slate-700 text-sm">{label}</span>
                    <span className="ml-auto text-slate-400 text-xs group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <div className="px-4 py-3 text-slate-500 text-sm leading-relaxed border-t border-slate-100">
                    {detail}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Known data limitations */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <span className="text-xl">📊</span>
            <h2 className="text-lg font-bold text-slate-800">Known Data Limitations</h2>
          </div>
          <div className="px-6 py-5 text-sm leading-relaxed">
            <div className="space-y-3">
              {[
                {
                  label: 'Capacity is licensed capacity, not current enrollment',
                  detail: 'The number shown is the maximum the state license allows — not how many spots are open today. Always call the program to ask about current availability and waitlists.',
                },
                {
                  label: 'Vendor IDs and transportation are not yet verified',
                  detail: 'Vendor IDs (the code your RC uses to authorize payment) and transportation availability are placeholders for some programs. Contact your Regional Center service coordinator to confirm current vendor status.',
                },
                {
                  label: 'AI-generated summaries are based on public web information',
                  detail: 'Program descriptions and parent review bullets are generated by AI from publicly available sources — program websites, news articles, parent forums. They are not verified by the programs themselves. Always speak directly with a program before making placement decisions.',
                },
                {
                  label: 'Contact info may lag real-world changes',
                  detail: 'Phone numbers and addresses come from the state licensing database, updated weekly. Programs can change phone numbers or move without immediately updating their state license. Call before visiting.',
                },
              ].map(({ label, detail }) => (
                <div key={label} className="flex gap-3 py-3 border-b border-slate-50 last:border-0">
                  <span className="text-amber-400 shrink-0 mt-0.5">!</span>
                  <div>
                    <div className="font-medium text-slate-700 mb-0.5">{label}</div>
                    <div className="text-slate-500">{detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Data sources */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <span className="text-xl">🔗</span>
            <h2 className="text-lg font-bold text-slate-800">Data Sources</h2>
          </div>
          <div className="px-6 py-5 text-sm leading-relaxed">
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="font-semibold text-slate-700">
                    <A href="https://www.cdss.ca.gov/inforesources/community-care-licensing">
                      CA Community Care Licensing Division (CCLD)
                    </A>
                  </div>
                  <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 shrink-0">Weekly automated pull</span>
                </div>
                <div className="text-slate-500">
                  Primary data source. Provides program names, addresses, phone numbers, licensed
                  capacity, and license status for all Adult Day Programs in California. Raw dataset
                  available on the{' '}
                  <A href="https://data.chhs.ca.gov/dataset/ccl-facilities">CHHS Open Data Portal</A>.
                  Facility-level search available at the{' '}
                  <A href="https://www.ccld.dss.ca.gov/carefacilitysearch/">CCLD Facility Search</A>.
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="font-semibold text-slate-700">
                    <A href="https://ai.google.dev/">Google Gemini AI</A> (web enrichment)
                  </div>
                  <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 shrink-0">Run once per new program</span>
                </div>
                <div className="text-slate-500">
                  Enriches raw CCLD records with display names, website URLs, hours of operation,
                  languages, program focus descriptions, and parent review summaries sourced from
                  public web pages. Searches public program websites, news, and parent forums only
                  — not Yelp or Google Reviews.
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="font-semibold text-slate-700">
                    <A href="https://developers.google.com/maps/documentation/geocoding/">
                      Google Maps Geocoding API
                    </A>
                  </div>
                  <span className="text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 shrink-0">Run once per new program</span>
                </div>
                <div className="text-slate-500">
                  Converts street addresses to map coordinates for the map view.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Medical support callout */}
        <section className="rounded-2xl border border-blue-200 overflow-hidden" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}>
          <div className="px-6 py-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">🏥</span>
              <div>
                <h2 className="text-base font-bold text-blue-900 mb-2">
                  Does Your Loved One Need Medical Support During the Day?
                </h2>
                <p className="text-blue-800 text-sm leading-relaxed mb-3">
                  If your family member requires tube feeding, wound care, IV medications, or
                  on-site nursing oversight, the programs on this site are not designed for that
                  level of care. These are non-medical day programs.
                </p>
                <p className="text-blue-800 text-sm leading-relaxed">
                  <strong>What to do:</strong> Contact your{' '}
                  <A href="https://www.dds.ca.gov/rc/">Regional Center</A> service coordinator and
                  ask specifically about{' '}
                  <A href="https://www.aging.ca.gov/Providers_and_Partners/Community-Based_Adult_Services/CBAS_Providers/">
                    CBAS (Community-Based Adult Services)
                  </A>{' '}
                  centers — California's medical adult day program model. Your RC can authorize and
                  fund a CBAS placement through your IPP if medically warranted.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Feedback */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <span className="text-xl">💬</span>
            <h2 className="text-lg font-bold text-slate-800">Missing a Program? Found an Error?</h2>
          </div>
          <div className="px-6 py-5 text-sm leading-relaxed text-slate-600 space-y-2">
            <p>
              If you know of an active, RC-vendored Adult Day Program that doesn't appear here, or
              if you spot incorrect information about a listed program, please reach out. Programs
              are added automatically from the state licensing database, but enrichment data
              (names, websites, summaries) can contain errors.
            </p>
            <p>
              Submit an issue or correction via{' '}
              <A href="https://github.com/dwbonham/exceptional-care-finder/issues">
                GitHub Issues
              </A>.
            </p>
          </div>
        </section>

        {/* Disclaimer */}
        <div className="text-center text-xs text-slate-400 leading-relaxed pb-4">
          This site is an independent resource and is not affiliated with the{' '}
          <A href="https://www.dds.ca.gov/">California Department of Developmental Services</A>,
          any Regional Center, or any program listed. Information is provided for informational
          purposes only and does not constitute legal, medical, or financial advice. Always verify
          program details directly before making placement decisions.
        </div>

      </div>
    </div>
  );
}
