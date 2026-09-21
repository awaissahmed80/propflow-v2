import { Link } from "@inertiajs/react"

export default function AuthLayout ({ children }) {
    return(
        <div className="h-dvh flex overflow-y-hidden">            
            <div className="flex flex-1 lg:flex-[0.75]  relative items-center justify-center">                
                <div className="absolute flex flex-col min-h-full  inset-0 overflow-y-auto">
                    <div className="flex flex-row items-center justify-center lg:justify-start">
                    <div className="py-8 px-5">
                        <Link href="/">                            
                            <img className="h-10 block dark:hidden" src="/assets/images/propflow-logo-light.svg" alt="Propflow" />
                            <img className="h-10 hidden dark:block lg:mx-0" src="/assets/images/propflow-logo-dark.svg" alt="Propflow" />
                        </Link>
                    </div>
                    </div>
                    <div className="w-full flex  justify-center flex-col flex-1 max-w-110 p-5 mx-auto">
                        {children}
                    </div>
                    <div className="p-5 w-full max-w-245 mx-auto ">
                        <div className="flex text-sm fex-row items-center space-x-5">
                            <a href="/">Terms & Conditions</a>
                            <a href="/">Privacy Policy</a>
                            <a href="/">Help</a>
                        </div>
                    </div>
                </div>
            </div>
            <div className="relative hidden overflow-hidden bg-card lg:flex lg:flex-1 items-center justify-center px-10 py-12 xl:px-14">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-28 -right-20 size-80 rounded-full bg-white/10 blur-3xl"
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-slate-300/10 blur-3xl"
                />

                <div className="relative z-10 flex h-full w-full max-w-3xl flex-col justify-center">
                    <h2 className="mb-3 text-4xl font-bold tracking-tight text-primary-foreground text-balance xl:text-5xl">
                        Manage every lead in one place
                    </h2>
                    <p className="mb-8 max-w-lg text-base leading-relaxed text-primary-foreground/80 text-pretty xl:text-lg">
                        Propflow is a Leads Management System for Real Estate Projects.
                        Bring website, campaign, and portal inquiries into a single pipeline.
                    </p>
                    <img
                        src="/assets/images/leads-management-flowchart.svg"
                        alt="Lead sources flowing into the Propflow leads dashboard"
                        className="w-full max-w-none self-stretch"
                    />
                </div>
            </div>
        </div>
    )
}