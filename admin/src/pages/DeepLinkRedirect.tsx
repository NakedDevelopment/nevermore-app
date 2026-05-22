import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAppLinkSettings } from '../lib/settings';
import type { AppLinkSettings } from '../lib/settings';
import authBg from '../assets/images/auth-bg.png';

type DeviceType = 'ios' | 'android' | 'desktop';
type PageState = 'loading' | 'redirecting' | 'coming-soon' | 'desktop-only';

const detectDevice = (): DeviceType => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  }
  if (/android/.test(userAgent)) {
    return 'android';
  }
  return 'desktop';
};

export const DeepLinkRedirect = () => {
  const location = useLocation();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [settings, setSettings] = useState<AppLinkSettings | null>(null);
  const deviceType = detectDevice();

  // Get the path without leading slash (e.g., "reset-password" or "invitation")
  const path = location.pathname.slice(1);

  useEffect(() => {
    const handleRedirect = async () => {
      // Desktop users see a message
      if (deviceType === 'desktop') {
        setPageState('desktop-only');
        return;
      }

      // Fetch settings
      const appSettings = await getAppLinkSettings();
      setSettings(appSettings);

      // Check if we have the necessary links
      const storeUrl = deviceType === 'ios' ? appSettings.appStoreUrl : appSettings.playStoreUrl;
      
      if (!appSettings.deepLinkUrl && !storeUrl) {
        setPageState('coming-soon');
        return;
      }

      setPageState('redirecting');

      // Try to open the app via deep link
      if (appSettings.deepLinkUrl) {
        const deepLink = `${appSettings.deepLinkUrl}${path}`;
        
        // Create a hidden iframe to attempt opening the app
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = deepLink;
        document.body.appendChild(iframe);

        // Set a timeout to redirect to store if app doesn't open
        const timeout = setTimeout(() => {
          document.body.removeChild(iframe);
          
          if (storeUrl) {
            window.location.href = storeUrl;
          } else {
            setPageState('coming-soon');
          }
        }, 2500);

        // Also try window.location for some devices
        setTimeout(() => {
          window.location.href = deepLink;
        }, 100);

        // Clean up on successful app open (page will be hidden)
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            clearTimeout(timeout);
          }
        });
      } else if (storeUrl) {
        // No deep link, go directly to store
        window.location.href = storeUrl;
      } else {
        setPageState('coming-soon');
      }
    };

    handleRedirect();
  }, [deviceType, path]);

  const getStoreUrl = () => {
    if (!settings) return null;
    return deviceType === 'ios' ? settings.appStoreUrl : settings.playStoreUrl;
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${authBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-[rgba(0,0,0,0.6)] backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-gray-700/50 text-center">
          {/* Loading State */}
          {pageState === 'loading' && (
            <>
              <div className="mb-6">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
              <h1 className="text-2xl font-normal text-white mb-4">
                Loading...
              </h1>
              <p className="text-gray-400">
                Please wait while we prepare your redirect.
              </p>
            </>
          )}

          {/* Redirecting State */}
          {pageState === 'redirecting' && (
            <>
              <div className="mb-6">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
              <h1 className="text-2xl font-normal text-white mb-4">
                Opening App...
              </h1>
              <p className="text-gray-400 mb-6">
                If the app doesn't open automatically, you'll be redirected to the {deviceType === 'ios' ? 'App Store' : 'Play Store'}.
              </p>
              {getStoreUrl() && (
                <button
                  onClick={() => window.location.href = getStoreUrl()!}
                  className="inline-block bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  Open {deviceType === 'ios' ? 'App Store' : 'Play Store'}
                </button>
              )}
            </>
          )}

          {/* Coming Soon State */}
          {pageState === 'coming-soon' && (
            <>
              <div className="mb-6">
                <svg className="w-20 h-20 mx-auto text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-normal text-white mb-4">
                Coming Soon
              </h1>
              <p className="text-gray-400">
                The Nevermore app will be available soon. Stay tuned for updates!
              </p>
            </>
          )}

          {/* Desktop Only State */}
          {pageState === 'desktop-only' && (
            <>
              <div className="mb-6">
                <svg className="w-20 h-20 mx-auto text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-normal text-white mb-4">
                Mobile Only
              </h1>
              <p className="text-gray-400">
                This process is supported only on mobile devices. Please open this link on your iPhone or Android device.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

