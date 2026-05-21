import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  programName: string;
  fullAddress: string;
  onClose: () => void;
}

export default function MapModal({ programName, fullAddress, onClose }: Props) {
  const encoded = encodeURIComponent(fullAddress);
  const embedSrc = `https://maps.google.com/maps?q=${encoded}&output=embed&hl=en&z=15`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    // Prevent body scroll while open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Map for ${programName}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 leading-snug truncate">
              {programName}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{fullAddress}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
            aria-label="Close map"
          >
            ✕
          </button>
        </div>

        {/* Map iframe */}
        <div className="relative w-full" style={{ height: '420px' }}>
          <iframe
            title={`Map: ${programName}`}
            src={embedSrc}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400 text-center sm:text-left">
            Click and drag to explore · Scroll to zoom · Click pins for details
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors duration-150"
            >
              🗺️ Get Directions ↗
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors duration-150 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
