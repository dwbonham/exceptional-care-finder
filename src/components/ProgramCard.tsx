import { useState } from 'react';
import type { ProgramData } from '../types';

interface Props {
  program: ProgramData;
}

export default function ProgramCard({ program }: Props) {
  const [reviewsOpen, setReviewsOpen] = useState(false);

  const hasWebsite =
    program.websiteUrl &&
    program.websiteUrl.trim() !== '' &&
    program.websiteUrl.toLowerCase() !== 'n/a';

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
            {program.decryptedProgramType}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-slate-300 text-slate-600 bg-white">
            Service Code: {program.stateServiceCode}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="px-6 py-4 flex-1 flex flex-col gap-4">
        {/* AI-Powered Summary */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
            ✨ <span>AI-Powered Summary</span>
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">{program.programFocus}</p>
        </div>

        {/* Contact row */}
        <div className="flex flex-col gap-2 text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">📍</span>
            <span className="leading-snug">{program.address}</span>
          </div>
          {program.phone && program.phone.trim() !== '' && (
            <div className="flex items-center gap-2">
              <span className="shrink-0">📞</span>
              <a
                href={`tel:${program.phone.replace(/\D/g, '')}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {program.phone}
              </a>
            </div>
          )}
        </div>

        {/* Visit Website button */}
        {hasWebsite ? (
          <a
            href={program.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-colors duration-150 shadow-sm"
          >
            Visit Website
            <span className="text-xs opacity-80">↗</span>
          </a>
        ) : (
          <div className="mt-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 text-slate-400 font-semibold text-sm rounded-xl cursor-not-allowed">
            No Website Listed
          </div>
        )}
      </div>

      {/* Review Accordion */}
      {program.parentReviews && program.parentReviews.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setReviewsOpen((o) => !o)}
            className="w-full flex items-center justify-between px-6 py-4 text-left bg-slate-50 hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
            aria-expanded={reviewsOpen}
          >
            <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span>💬</span> Parent Feedback &amp; Insights
              <span className="text-xs font-normal text-slate-400">
                ({program.parentReviews.length})
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
                {program.parentReviews.map((review, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
                    <span className="mt-0.5 text-blue-400 shrink-0">•</span>
                    <span>{review}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
