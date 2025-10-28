import { useEffect, useState } from 'react';
import { checkBrowserCompatibility, getRecommendedBrowsers } from '../lib/utils/browser-compat';
import type { BrowserCompatibility } from '../types';

interface BrowserCompatibilityScreenProps {
  onContinue?: () => void;
}

export function BrowserCompatibilityScreen({ onContinue }: BrowserCompatibilityScreenProps) {
  const [compat, setCompat] = useState<BrowserCompatibility | null>(null);

  useEffect(() => {
    const result = checkBrowserCompatibility();
    setCompat(result);
  }, []);

  if (!compat) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking browser compatibility...</p>
        </div>
      </div>
    );
  }

  const recommended = getRecommendedBrowsers();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{compat.isCompatible ? '✅' : '⚠️'}</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {compat.isCompatible ? 'Browser Compatible!' : 'Browser Not Supported'}
          </h1>
          <p className="text-lg text-gray-600">
            {compat.isCompatible
              ? 'Your browser supports all required features'
              : 'Your browser is missing some required features'}
          </p>
        </div>

        <div className="space-y-6">
          {/* Browser Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="font-semibold text-gray-900 mb-2">Browser Information</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Browser:</span>
                <span className="font-medium">{compat.browser} {compat.version}</span>
              </div>
            </div>
          </div>

          {/* API Support */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Required Features</h2>
            <div className="space-y-2">
              {Object.entries(compat.requiredAPIs).map(([api, supported]) => (
                <div key={api} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{api}</span>
                  <span className={`flex items-center gap-1 ${supported ? 'text-green-600' : 'text-red-600'}`}>
                    {supported ? (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Supported
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        Not Supported
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Browsers (if not compatible) */}
          {!compat.isCompatible && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h2 className="font-semibold text-blue-900 mb-3">Recommended Browsers</h2>
              <p className="text-sm text-blue-800 mb-3">
                Please use one of these browsers to access this application:
              </p>
              <div className="space-y-2">
                {recommended.map((browser) => (
                  <a
                    key={browser.name}
                    href={browser.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{browser.name}</div>
                      <div className="text-sm text-gray-600">Version {browser.version}</div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Why? Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="font-semibold text-gray-900 mb-2">Why is this required?</h2>
            <p className="text-sm text-gray-600">
              This application needs to save files directly to your computer, which requires the{' '}
              <span className="font-medium">File System Access API</span>. This feature is currently
              only available in Chromium-based browsers like Chrome, Edge, and Opera.
            </p>
          </div>

          {/* Continue Button (if compatible) */}
          {compat.isCompatible && (
            <button
              onClick={onContinue}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Continue to Application →
            </button>
          )}
        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          A47L - Fireflies Transcript Sync App v1.0.0 • made with heart by{' '}
          <a 
            href="https://atomic47.co" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Atomic 47 Labs Inc
          </a>
        </div>
      </div>
    </div>
  );
}

