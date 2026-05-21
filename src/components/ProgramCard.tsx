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
    <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 border border-slate-100 overflow-hidden flex flex-col">

      {/* Card header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-900 leading-snug mb-1">
          {program.streetName}
        </h2>
        <p className="text-sm text-slate-500">
          Registered Legal Entity:{' '}
          <span className="font-medium text-slate-600">{program.legalLicenseName}</span>
        </p>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">
            {facilityDetails.decryptedProgramType}
          </span>
<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-slate-300 text-slate-600 bg-white">
            Service Code: {fundingMechanics.stateBillingCode}
          </span>
          {facilityDetails.licensedCapacity && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-slate-200 text-slate-500 bg-slate-50">
              Licensed Capacity: {facilityDetails.licensedCapacity}
            </span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="px-6 py-4 flex-1 flex flex-col gap-4">

        {/* AI-Powered Summary */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
            ✨ <span>AI-Powered Summary</span>
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">{facilityDetails.programFocus}</p>
        </div>

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

        {/* Funding & Administration block */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span>💰</span> Funding &amp; Administration
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Agency:</span>
              {fundingMechanics.localAdministeringAgency}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Billing Code:</span>
              {fundingMechanics.stateBillingCode}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
              <span className="font-semibold">Required Doc:</span>
              {fundingMechanics.requiredFundingDocument}
            </span>
            {fundingMechanics.transportationAvailability && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">🚌 Transport:</span>
                {fundingMechanics.transportationAvailability}
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
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 border border-blue-200 text-blue-600 hover:bg-blue-50 active:bg-blue-100 font-semibold text-sm rounded-xl transition-colors duration-150 cursor-pointer"
          >
            🗺️ View on Map
          </button>
          {hasWebsite ? (
            <a
              href={contact.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-colors duration-150 shadow-sm"
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
              <span>💬</span> AI-Aggregated Community Sentiment
              <span className="text-xs font-normal text-slate-400">
                ({qualitativeInsights.parentReviews.length})
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
                    <span className="mt-0.5 text-blue-400 shrink-0">•</span>
                    <span>{review}</span>
                  </li>
                ))}
              </ul>
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
