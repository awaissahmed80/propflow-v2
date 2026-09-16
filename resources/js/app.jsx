import { createInertiaApp } from '@inertiajs/react';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// Kept as a minimal client stub. SSR uses resources/js/ssr.jsx.
// Portal/public/auth each have their own Vite entry under resources/js/apps/*.
createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    pages: './apps/portal/pages',
    progress: {
        color: '#4B5563',
    },
});
