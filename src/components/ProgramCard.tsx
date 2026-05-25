import { useState } from 'react';
import type { ProgramData } from '../types';
import MapModal from './MapModal';

interface Props {
  program: ProgramData;
}

export default function ProgramCard({ program }: Props) {
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const { location, contact, facilityDetails, fundingMechanics, qualitativeInsights } = program;

  const hasWebsite =
    contact.websiteUrl &&
    contact.websiteUrl.trim() !== '' &&
    contact.websiteUrl.toLowerCase() !== 'n/a';

  const fullAddress = `${location.street}, ${location.city}, ${location.state} ${location.zipCode}`;

  return (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 border border-stone-100 border-l-4 border-l-[#C2410C] overflow-hidden flex flex-col">

      {/* Card header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100">
        <h2 className="font-display text-xl font-semibold text-[#1C1917] leading-snug mb-1">
          {program.streetName}
        </h2>
        <p className="text-sm text-slate-500">
          Licensed as:{' '}
          <span className="font-medium text-slate-600">{program.legalLicenseName}</span>
        </p>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">
            {facilityDetails.decryptedProgramType}
          </span>
          {facilityDetails.selfDeterminationAccepted === 'Yes' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
              ✓ Self-Determination
            </span>
          )}
          {facilityDetails.licensedCapacity && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-slate-200 text-slate-500 bg-slate-50">
              Licensed Capacity: {facilityDetails.licensedCapacity}
            </span>
          )}
          {facilityDetails.yearEstablished && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-slate-200 text-slate-500 bg-slate-50">
              Est. {facilityDetails.yearEstablished}
            </span>
          )}
        </div>

        {/* Population specialization — who this program is designed for */}
        {facilityDetails.populationSpecialization && facilityDetails.populationSpecialization.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {facilityDetails.populationSpecialization.map((pop) => (
              <span key={pop} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                {pop}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-6 py-4 flex-1 flex flex-col gap-4">

        {/* Program Summary — only shown when content exists */}
        {facilityDetails.programFocus && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-1 flex items-center gap-1">
              ✨ <span>Program Summary</span>
            </p>
            <p className="text-xs text-slate-400 mb-2">Summarized from the program's public website and CCLD license record using Gemini.</p>
            <p className="text-sm text-slate-700 leading-relaxed">{facilityDetails.programFocus}</p>
          </div>
        )}

        {/* Schedule and organization */}
        {(facilityDetails.daysOfOperation || facilityDetails.hoursOfOperation || facilityDetails.parentOrganization) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            {facilityDetails.daysOfOperation && (
              <span><span className="font-semibold text-slate-700">Days:</span> {facilityDetails.daysOfOperation}</span>
            )}
            {facilityDetails.hoursOfOperation && (
              <span><span className="font-semibold text-slate-700">Hours:</span> {facilityDetails.hoursOfOperation}</span>
            )}
            {facilityDetails.parentOrganization && (
              <span><span className="font-semibold text-slate-700">Part of:</span> {facilityDetails.parentOrganization}</span>
            )}
          </div>
        )}

        {/* Facility details — age, languages, features */}
        {(facilityDetails.minimumAge != null || facilityDetails.languagesSupported?.length || facilityDetails.facilityFeatures?.length) && (
          <div className="flex flex-wrap gap-2">
            {facilityDetails.minimumAge != null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-50 border border-violet-200 text-xs text-violet-700">
                <span className="font-semibold">Age:</span> {facilityDetails.minimumAge}+
              </span>
            )}
            {facilityDetails.languagesSupported?.map((lang) => (
              <span key={lang} className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-600">
                🌐 {lang}
              </span>
            ))}
            {facilityDetails.facilityFeatures?.map((feat) => (
              <span key={feat} className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-600">
                ✓ {feat}
              </span>
            ))}
          </div>
        )}

        {/* Activities */}
        {facilityDetails.activitiesOffered && facilityDetails.activitiesOffered.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Daily Activities</p>
            <div className="flex flex-wrap gap-2">
              {facilityDetails.activitiesOffered.map((activity) => (
                <span key={activity} className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  {activity}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Funding & Administration block */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span>💰</span> Funding &amp; Administration
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {fundingMechanics.coveringAgencies.map((agency) => (
              <span key={agency} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Regional Center:</span>
                {agency}
              </span>
            ))}
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-700"
              title="Individual Program Plan — the authorized plan your Regional Center writes with you. This service must be listed in your IPP before funding is approved."
            >
              <span className="font-semibold">Requires:</span>
              {fundingMechanics.requiredFundingDocument}
            </span>
            {fundingMechanics.transportationAvailability && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">🚌 Transport:</span>
                {fundingMechanics.transportationAvailability}
              </span>
            )}
            {fundingMechanics.transportationServiceArea && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Service Area:</span>
                {fundingMechanics.transportationServiceArea}
              </span>
            )}
            {fundingMechanics.acceptsPrivatePay && fundingMechanics.acceptsPrivatePay !== 'Unknown' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Private Pay:</span>
                {fundingMechanics.acceptsPrivatePay}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {fundingMechanics.financialCoverageNote}
          </p>
        </div>

        {/* Contact row */}
        <div className="flex flex-col gap-2 text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">📍</span>
            <span className="leading-snug">{fullAddress}</span>
          </div>
          {contact.phone && contact.phone.trim() !== '' && (
            <div className="flex items-center gap-2">
              <span className="shrink-0">📞</span>
              <a
                href={`tel:${contact.phone.replace(/\D/g, '')}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {contact.phone}
              </a>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-auto flex gap-3">
          <button
            onClick={() => setMapOpen(true)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 border border-[#C2410C]/25 text-[#C2410C] hover:bg-[#FEF2EE] active:bg-[#FDE8E0] font-ui font-semibold text-sm rounded-xl transition-colors duration-150 cursor-pointer"
          >
            🗺️ View on Map
          </button>
          {hasWebsite ? (
            <a
              href={contact.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#C2410C] hover:bg-[#A33509] active:bg-[#8A2E07] text-white font-ui font-semibold text-sm rounded-xl transition-colors duration-150 shadow-sm"
            >
              Website <span className="text-xs opacity-80">↗</span>
            </a>
          ) : (
            <div className="flex-1 inline-flex items-center justify-center px-4 py-3 bg-slate-100 text-slate-400 font-semibold text-sm rounded-xl cursor-not-allowed">
              No Website
            </div>
          )}
        </div>
      </div>

      {/* Review Accordion */}
      {qualitativeInsights.parentReviews.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setReviewsOpen((o) => !o)}
            className="w-full flex items-center justify-between px-6 py-4 text-left bg-slate-50 hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
            aria-expanded={reviewsOpen}
          >
            <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span>💬</span> Community Reputation
              <span className="text-xs font-normal text-slate-400">
                · {qualitativeInsights.parentReviews.length} note{qualitativeInsights.parentReviews.length !== 1 ? 's' : ''} from public sources
              </span>
            </span>
            <span
              className={`text-slate-400 text-sm transition-transform duration-200 ${
                reviewsOpen ? 'rotate-180' : ''
              }`}
            >
              ▾
            </span>
          </button>

          {reviewsOpen && (
            <div className="bg-slate-50 px-6 pb-5">
              <ul className="space-y-3 pt-1">
                {qualitativeInsights.parentReviews.map((review, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed"
                  >
                    <span className="mt-0.5 text-[#C2410C] shrink-0">•</span>
                    <span>{review}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-200 leading-relaxed">
                Gathered by Gemini from public web sources — organizational websites, news articles, and nonprofit filings. Review platforms (Yelp, Google Reviews) are excluded per their terms of service.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Map modal — portals to document.body to escape overflow:hidden */}
      {mapOpen && (
        <MapModal
          programName={program.streetName}
          fullAddress={fullAddress}
          onClose={() => setMapOpen(false)}
        />
      )}
    </div>
  );
}
