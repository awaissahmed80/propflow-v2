import { createInertiaApp } from '@inertiajs/react'
import createServer from '@inertiajs/react/server'
import ReactDOMServer from 'react-dom/server'

const pages = import.meta.glob('./apps/{portal,public,auth}/pages/**/*.jsx')

createServer((page) =>
    createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
        resolve: async (name) => {
            const candidates = [
                `./apps/portal/pages/${name}.jsx`,
                `./apps/public/pages/${name}.jsx`,
                `./apps/auth/pages/${name}.jsx`,
            ]

            for (const path of candidates) {
                const loader = pages[path]

                if (loader) {
                    const module = await loader()

                    return module.default ?? module
                }
            }

            throw new Error(`Page not found: ${name}`)
        },
        setup: ({ App, props }) => <App {...props} />,
    }),
)
