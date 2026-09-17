import { Head, usePage } from "@inertiajs/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * @param {{
 *   status?: number,
 *   homeUrl?: string,
 *   portalUrl?: string,
 *   authUrl?: string,
 * }} props
 */
export default function NotFound({
    status = 404,
    homeUrl,
    portalUrl,
    authUrl,
}) {
    const { urls, name } = usePage().props;
    const brand = name || "Propflow";
    const home = homeUrl || urls?.home || "/";
    const portal = portalUrl || urls?.portal;
    const auth = authUrl || urls?.auth;

    const goBack = () => {
        if (typeof window !== "undefined" && window.history.length > 1) {
            window.history.back();
            return;
        }

        window.location.assign(home);
    };

    return (
        <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground antialiased">
            <Head title="Page not found" />

            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.18_255_/_0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,oklch(0.7_0.08_230_/_0.1),transparent_45%)] dark:bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.14_255_/_0.22),transparent_55%),radial-gradient(ellipse_at_bottom_right,oklch(0.4_0.08_230_/_0.14),transparent_45%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2] [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
            />

            <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
                <a href={home} className="inline-flex items-center gap-2.5">
                    <img
                        src="/assets/images/propflow-logo-light.svg"
                        alt={brand}
                        className="h-8 w-auto dark:hidden"
                    />
                    <img
                        src="/assets/images/propflow-logo-dark.svg"
                        alt={brand}
                        className="hidden h-8 w-auto dark:block"
                    />
                </a>
                {auth && home !== portal ? (
                    <a
                        href={auth}
                        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                        Sign in
                    </a>
                ) : (
                    <span className="text-sm text-muted-foreground">{brand}</span>
                )}
            </header>

            <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-16 pt-6 sm:px-8">
                <div className="mx-auto w-full max-w-xl text-center [animation:not-found-enter_0.55s_ease-out_both]">
                    <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-primary uppercase">
                        Error {status}
                    </p>

                    <p
                        aria-hidden
                        className="font-serif text-[clamp(6rem,22vw,10rem)] leading-none font-medium tracking-tight text-foreground/[0.08] select-none dark:text-foreground/[0.12]"
                    >
                        404
                    </p>

                    <h1 className="-mt-8 text-3xl font-semibold tracking-tight text-foreground sm:-mt-10 sm:text-4xl">
                        This page wandered off the map
                    </h1>

                    <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
                        The link may be broken, or the page may have moved. Head
                        home and continue from there.
                    </p>

                    <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <a
                            href={home}
                            className={cn(
                                buttonVariants({ size: "lg" }),
                                "min-w-40 px-6"
                            )}
                        >
                            <Icon name="home-line" className="text-base" />
                            Back to home
                        </a>
                        <Button
                            type="button"
                            size="lg"
                            variant="outline"
                            className="min-w-40 px-6"
                            onClick={goBack}
                        >
                            <Icon name="arrow-left-line" className="text-base" />
                            Go back
                        </Button>
                    </div>

                    {portal ? (
                        <p className="mt-8 text-sm text-muted-foreground">
                            Looking for your workspace?{" "}
                            <a
                                href={portal}
                                className="font-medium text-primary underline-offset-4 hover:underline"
                            >
                                Open the portal
                            </a>
                        </p>
                    ) : null}
                </div>
            </main>

            <footer className="relative z-10 px-5 pb-8 text-center text-xs text-muted-foreground sm:px-8">
                © {new Date().getFullYear()} {brand}
            </footer>

            <style>{`
                @keyframes not-found-enter {
                    from {
                        opacity: 0;
                        transform: translateY(0.75rem);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}
