import path from 'path'; // Make sure to import path
import { fileURLToPath } from 'url'; // 1. Import this built-in utility
import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',                                 
                'resources/js/apps/auth/index.jsx', 
                'resources/js/apps/public/index.jsx',
                'resources/js/apps/portal/index.jsx'
            ],
            refresh: true,
            fonts: [
                bunny('Plus Jakarta Sans', {
                    // List all the weights you want to use
                    weights: [300, 400, 500, 600, 700, 800], 
                    
                    // Enable italic variants for the weights listed above
                    italics: true, 
                }),
            ],
        }),
        inertia({
            ssr: {
                entry: 'resources/js/ssr.jsx',
            },
        }),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ],
    resolve: {
        alias: {
            // Your existing alias            
            // 💡 Add your new portal alias here
            '@/portal': path.resolve(__dirname, './resources/js/apps/portal'),
        },
    },
    esbuild: {
        jsx: 'automatic',
    }
});
