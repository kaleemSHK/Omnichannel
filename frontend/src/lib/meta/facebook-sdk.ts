declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (res: { status: string; authResponse?: { accessToken: string } }) => void,
        opts: { scope: string },
      ) => void;
      AppEvents: { logPageView: () => void };
    };
    fbAsyncInit?: () => void;
    fbSDKLoaded?: boolean;
  }
}

const FB_SCOPES = [
  'pages_manage_metadata',
  'business_management',
  'pages_messaging',
  'instagram_basic',
  'pages_show_list',
  'pages_read_engagement',
  'instagram_manage_messages',
].join(',');

let sdkPromise: Promise<void> | null = null;

export function getFbAppId(): string {
  return (process.env.NEXT_PUBLIC_FB_APP_ID || '').trim();
}

export function loadFacebookSdk(appId: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser only'));
  if (!appId) return Promise.reject(new Error('NEXT_PUBLIC_FB_APP_ID is not configured'));

  if (window.fbSDKLoaded && window.FB) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        xfbml: true,
        version: process.env.NEXT_PUBLIC_FB_API_VERSION || 'v21.0',
        status: true,
      });
      window.fbSDKLoaded = true;
      window.FB?.AppEvents.logPageView();
      resolve();
    };

    const existing = document.getElementById('facebook-jssdk');
    if (existing) {
      if (window.fbSDKLoaded) resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'));
    document.body.appendChild(script);
  });

  return sdkPromise;
}

export function facebookLogin(appId: string): Promise<string> {
  return loadFacebookSdk(appId).then(
    () =>
      new Promise((resolve, reject) => {
        if (!window.FB) {
          reject(new Error('Facebook SDK not available'));
          return;
        }
        window.FB.login(
          response => {
            if (response.status === 'connected' && response.authResponse?.accessToken) {
              resolve(response.authResponse.accessToken);
              return;
            }
            reject(new Error('Facebook authorization was not completed'));
          },
          { scope: FB_SCOPES },
        );
      }),
  );
}
