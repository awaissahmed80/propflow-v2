import { createInertiaApp, router } from '@inertiajs/react';
import { Provider } from 'react-redux'
import { AlertProvider } from '@/portal/contexts/alert.context';
import { AppStore } from '@/portal/store';
import RootLayout from '@/portal/layouts/root.layout';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
import { initializeTheme } from '@/hooks/use-appearance';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

if (import.meta.env.VITE_REVERB_APP_KEY) {
    window.Pusher = Pusher;
    window.Echo = new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost: import.meta.env.VITE_REVERB_HOST,
        wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
        wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
        forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
        enabledTransports: ['ws', 'wss'],
        authEndpoint: '/broadcasting/auth',
        auth: {
            headers: {
                'X-XSRF-TOKEN': decodeURIComponent(
                    document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)?.[1] || '',
                ),
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        },
    });
}

function redirectToAuth(authUrl) {
    if (!authUrl) {
        return;
    }

    window.location.assign(authUrl);
}

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) => {
        // 1. Force the error components to ALWAYS load from the public folder
        if (name.startsWith('errors/')) {
            // alert("hello there");
            return resolvePageComponent(
                `../public/pages/${name}.jsx`, // or .jsx depending on your extension
                import.meta.glob('../public/pages/**/*.jsx') // or .jsx
            );
        }

        // 2. Your standard resolution logic for portal or public pages
        return resolvePageComponent(`./pages/${name}.jsx`, import.meta.glob('./pages/**/*.jsx'));
    },
    setup({ el, App, props }) {
        const authUrl = props.initialPage?.props?.urls?.auth;

        router.on('httpException', (event) => {
            const status = event.detail?.response?.status;

            if (status === 401 || status === 419) {
                event.preventDefault();
                redirectToAuth(authUrl);
            }
        });

        router.on('networkError', () => {
            // Session cookies cleared mid-visit can fail cross-origin XHR to auth.
            if (!document.cookie.includes('XSRF-TOKEN=')) {
                redirectToAuth(authUrl);
            }
        });

        const root = createRoot(el);

        root.render(
            <Provider store={AppStore}>                
                <RootLayout>
                    <AlertProvider>                        
                        <App {...props} />                        
                    </AlertProvider>
                </RootLayout>                
            </Provider>
        );
    },
    progress: false,
});

// This will set light / dark mode on load...
initializeTheme();
