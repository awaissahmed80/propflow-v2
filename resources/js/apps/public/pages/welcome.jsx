import { useEffect, useState } from "react";
import { Head, usePage } from "@inertiajs/react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const OFFERINGS = [
    { icon: "megaphone-line", title: "Marketing Automation", body: "Automate capture, nurture, WhatsApp, and campaign workflows." },
    { icon: "user-search-line", title: "Lead Management", body: "Score, assign, segment, and resolve CP conflicts in one place." },
    { icon: "sparkling-2-line", title: "AI Features", body: "Web bot, content writer, scoring, and insights that save hours." },
    { icon: "line-chart-line", title: "Sales Management", body: "Tasks, site visits, cost sheets, and pipeline customization." },
    { icon: "chat-smile-2-line", title: "Omni-channel", body: "WhatsApp, email, and telephony with live tracking and logs." },
    { icon: "building-2-line", title: "Inventory Management", body: "Grid & list views, bookings, blocking, and parking rules." },
    { icon: "file-list-3-line", title: "Post Sales", body: "Payments, milestones, demand notes, AOS, and handover." },
    { icon: "smartphone-line", title: "Mobile CRM", body: "Update leads, visits, and tasks from the field in real time." },
];

const WHY = [
    { icon: "stack-line", title: "Integrated CRM Solution", body: "Enquiry to possession in one system for stronger customer relationships." },
    { icon: "flashlight-line", title: "Easy to Use", body: "Built for every role on the sales floor—simple, crisp, and fast." },
    { icon: "robot-2-line", title: "AI Capabilities", body: "Assistants and scoring purpose-built for real estate conversations." },
    { icon: "home-gear-line", title: "Built For Real Estate", body: "Designed exclusively for developers, agents, and channel partners." },
    { icon: "timer-flash-line", title: "Low Setup Time", body: "Get started quickly with guided onboarding that respects your time." },
    { icon: "equalizer-line", title: "Highly Customizable", body: "Stages, rules, and fields that flex to how your team already sells." },
];

const DASHBOARDS = [
    {
        title: "Lead pipeline",
        body: "Kanban opportunities with heat, follow-ups, and stage movement your team can feel.",
        image: "/images/dash-kanban.png?v=portal",
    },
    {
        title: "Inventory control",
        body: "Unit grids, availability, bookings, and project health in one operational view.",
        image: "/images/dash-inventory.png?v=portal",
    },
    {
        title: "Revenue analytics",
        body: "Funnel conversion, sources, and KPI cards so leaders always know what to push.",
        image: "/images/dash-analytics.png?v=portal",
    },
];

const PLANS = [
    {
        id: "starter",
        name: "Starter",
        price: "49",
        period: "/user/mo",
        blurb: "For growing sales teams getting organised.",
        highlight: false,
        features: [
            "Up to 5 users",
            "25k leads / year",
            "Pipeline & tasks",
            "Inventory (200 units)",
            "Email support",
        ],
    },
    {
        id: "growth",
        name: "Growth",
        price: "79",
        period: "/user/mo",
        blurb: "For developers scaling multi-project sales.",
        highlight: true,
        features: [
            "Up to 15 users",
            "100k leads / year",
            "WhatsApp + assignment rules",
            "Inventory (1,000 units)",
            "AI content & web bot",
            "Priority support",
        ],
    },
    {
        id: "scale",
        name: "Scale",
        price: "Custom",
        period: "",
        blurb: "For enterprises with multi-city portfolios.",
        highlight: false,
        features: [
            "Unlimited users",
            "Custom lead volume",
            "Advanced post-sales",
            "SSO & dedicated CSM",
            "Custom integrations",
            "SLA & onboarding",
        ],
    },
];

const STATS = [
    { value: "120+", label: "Projects handled" },
    { value: "2.4M", label: "Leads managed" },
    { value: "18k", label: "Sales empowered" },
    { value: "22", label: "Markets present" },
];

const TESTIMONIALS = [
    {
        quote: "Propflow maps customers from enquiry to handover. The experience is crisp, and support moves as fast as our sales floor.",
        name: "Vishnuvardhan Reddy M",
        role: "CEO, Tranquillo",
    },
    {
        quote: "We mirrored our real workflows and saw productivity climb. Features that matter for developers—without the noise.",
        name: "Kishor Rao",
        role: "Lake City Hyderabad",
    },
    {
        quote: "Lead assignment, pipeline rules, and WhatsApp together changed how we close. Implementation was friendly and thorough.",
        name: "Mohammed H",
        role: "VP Sales, Tranquillo",
    },
];

const FAQS = [
    {
        q: "What is Propflow?",
        a: "Propflow is an AI-assisted CRM for real estate developers and channel partners—covering leads, inventory, sales, and post-sales in one place.",
    },
    {
        q: "How is pricing billed?",
        a: "Starter and Growth are billed per user monthly (or annually at a discount). Scale is quoted for larger portfolios and custom modules.",
    },
    {
        q: "Can we customize pipelines and fields?",
        a: "Yes. Stages, assignment rules, fields, and workflows adapt to how your organization already sells.",
    },
    {
        q: "Do we need third-party WhatsApp tools?",
        a: "No. Propflow includes built-in WhatsApp messaging for conversations and bulk outreach without a separate vendor stack.",
    },
    {
        q: "How fast can we go live?",
        a: "Most teams start within days with guided onboarding. Book a demo and we will map your setup path.",
    },
];

function useElevatedNav() {
    const [elevated, setElevated] = useState(false);

    useEffect(() => {
        const onScroll = () => setElevated(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return elevated;
}

function FaqItem({ item }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="border-b border-border">
            <button
                type="button"
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
            >
                <span className="text-base font-semibold text-foreground">{item.q}</span>
                <Icon
                    name={open ? "subtract-line" : "add-line"}
                    className="shrink-0 text-lg text-primary"
                />
            </button>
            <div
                className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
            >
                <div className="overflow-hidden">
                    <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
            </div>
        </div>
    );
}

export default function Welcome() {
    const { urls, name } = usePage().props;
    const brand = name || "Propflow";
    const authUrl = urls?.auth || "/";
    const contactEmail = urls?.contact_email || "hello@propflow.test";
    const elevated = useElevatedNav();

    return (
        <div className="min-h-screen bg-background text-foreground antialiased">
            <Head title="AI-Powered Real Estate CRM for Developers & Channel Partners">
                <meta
                    head-key="description"
                    name="description"
                    content="Propflow is a real estate CRM for developers and channel partners. Manage leads, inventory, sales, and post-sales from enquiry to handover."
                />
            </Head>

            <header
                className={cn(
                    "fixed inset-x-0 top-0 z-50 border-b transition-all duration-200",
                    elevated
                        ? "border-border bg-background/95 shadow-sm backdrop-blur"
                        : "border-transparent bg-background"
                )}
            >
                <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between px-5 sm:px-8">
                    <a href="/" className="flex items-center">
                        <img
                            src="/assets/images/propflow-logo-light.svg"
                            alt={brand}
                            className="h-8 w-auto"
                        />
                    </a>

                    <nav className="hidden items-center gap-7 text-sm font-medium text-foreground/80 md:flex">
                        <a href="#offerings" className="hover:text-primary">
                            Solutions
                        </a>
                        <a href="#dashboards" className="hover:text-primary">
                            Product
                        </a>
                        <a href="#pricing" className="hover:text-primary">
                            Pricing
                        </a>
                        <a href="#faq" className="hover:text-primary">
                            Resources
                        </a>
                    </nav>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <a
                            href={`mailto:${contactEmail}`}
                            className="hidden items-center gap-1.5 text-sm font-medium text-foreground/80 hover:text-primary sm:inline-flex"
                        >
                            <Icon name="phone-line" className="text-base" />
                            Contact Sales
                        </a>
                        <a
                            href="#demo"
                            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                        >
                            Book a Demo
                        </a>
                    </div>
                </div>
            </header>

            <main>
                <section className="relative overflow-hidden px-5 pt-28 pb-10 sm:px-8 sm:pt-32 sm:pb-16">
                    <div className="pointer-events-none absolute -top-24 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
                    <div className="pointer-events-none absolute top-40 right-[-6rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
                    <div className="pointer-events-none absolute top-52 left-[-4rem] h-64 w-64 rounded-full bg-accent/60 blur-3xl" />

                    <div className="relative mx-auto max-w-4xl text-center">
                        <div className="inline-flex items-center rounded-full border border-primary/40 bg-background px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-foreground uppercase">
                            Enquiry to handover, simplified
                        </div>
                        <h1 className="mt-5 text-4xl leading-[1.12] font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.35rem]">
                            AI-Powered{" "}
                            <span className="rounded-md bg-primary/15 px-1.5">Real Estate CRM</span>{" "}
                            For Developers and Channel Partners
                        </h1>
                        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                            Manage all of your company’s interactions with current and potential customers and bring
                            home more deals with Propflow—integrated real estate CRM.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                            <span className="inline-flex text-[#f5b301]">
                                <Icon name="star-fill" />
                                <Icon name="star-fill" />
                                <Icon name="star-fill" />
                                <Icon name="star-fill" />
                                <Icon name="star-fill" />
                            </span>
                            <span>100+ reviews from growing developer teams</span>
                        </div>
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                            <a
                                href="#demo"
                                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-primary/90"
                            >
                                Contact Sales
                            </a>
                            <a
                                href={authUrl}
                                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40"
                            >
                                Sign in
                            </a>
                        </div>
                    </div>

                    <div className="relative mx-auto mt-12 max-w-5xl sm:mt-16">
                        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_80px_-24px_rgba(56,71,208,0.28)]">
                            <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2.5">
                                <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                                <span className="size-2.5 rounded-full bg-[#febc2e]" />
                                <span className="size-2.5 rounded-full bg-[#28c840]" />
                                <span className="ml-3 rounded-md bg-background px-3 py-1 text-xs text-muted-foreground ring-1 ring-border">
                                    app.propflow.test/leads
                                </span>
                            </div>
                            <img
                                src="/images/dash-kanban.png?v=portal"
                                alt="Propflow lead pipeline dashboard"
                                className="w-full object-cover object-top"
                            />
                        </div>
                    </div>
                </section>

                <section id="offerings" className="bg-muted px-5 py-20 sm:px-8 sm:py-24">
                    <div className="mx-auto max-w-6xl">
                        <div className="mx-auto max-w-2xl text-center">
                            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                What we offer for Real Estate
                            </h2>
                            <p className="mt-3 text-base text-muted-foreground">
                                Everything from first enquiry to possession—built only for property sales teams.
                            </p>
                        </div>
                        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            {OFFERINGS.map((item) => (
                                <div
                                    key={item.title}
                                    className="rounded-2xl border border-border bg-background p-5 shadow-sm transition-shadow hover:shadow-md"
                                >
                                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
                                        <Icon name={item.icon} className="text-xl" />
                                    </div>
                                    <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="dashboards" className="bg-background px-5 py-20 sm:px-8 sm:py-24">
                    <div className="mx-auto max-w-6xl">
                        <div className="mx-auto max-w-2xl text-center">
                            <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                                Product screens
                            </p>
                            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                Dashboards your sales floor will actually use
                            </h2>
                        </div>

                        <div className="mt-14 space-y-16">
                            {DASHBOARDS.map((screen, index) => (
                                <div
                                    key={screen.title}
                                    className={cn(
                                        "grid items-center gap-8 lg:grid-cols-2 lg:gap-12",
                                        index % 2 === 1 && "lg:[&>*:first-child]:order-2"
                                    )}
                                >
                                    <div>
                                        <h3 className="text-2xl font-bold tracking-tight text-foreground">
                                            {screen.title}
                                        </h3>
                                        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                                            {screen.body}
                                        </p>
                                        <a
                                            href="#demo"
                                            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/90"
                                        >
                                            See it in a demo
                                            <Icon name="arrow-right-line" />
                                        </a>
                                    </div>
                                    <div className="overflow-hidden rounded-2xl border border-border bg-muted shadow-[0_18px_50px_-28px_rgba(56,71,208,0.35)]">
                                        <img
                                            src={screen.image}
                                            alt={screen.title}
                                            className="w-full object-cover object-top"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="pricing" className="bg-muted px-5 py-20 sm:px-8 sm:py-24">
                    <div className="mx-auto max-w-6xl">
                        <div className="mx-auto max-w-2xl text-center">
                            <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                                Pricing
                            </p>
                            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                Plans that grow with your sales team
                            </h2>
                            <p className="mt-3 text-base text-muted-foreground">
                                Transparent per-user pricing. Annual billing available on every plan.
                            </p>
                        </div>

                        <div className="mt-12 grid gap-5 lg:grid-cols-3">
                            {PLANS.map((plan) => (
                                <div
                                    key={plan.id}
                                    className={cn(
                                        "relative flex flex-col rounded-2xl border bg-background p-6 shadow-sm",
                                        plan.highlight
                                            ? "border-primary shadow-[0_16px_40px_-20px_rgba(56,71,208,0.45)]"
                                            : "border-border"
                                    )}
                                >
                                    {plan.highlight ? (
                                        <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold tracking-wide text-primary-foreground uppercase">
                                            Most popular
                                        </span>
                                    ) : null}
                                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
                                    <div className="mt-5 flex items-end gap-1">
                                        {plan.price === "Custom" ? (
                                            <span className="text-4xl font-bold tracking-tight text-foreground">
                                                Custom
                                            </span>
                                        ) : (
                                            <>
                                                <span className="text-4xl font-bold tracking-tight text-foreground">
                                                    ${plan.price}
                                                </span>
                                                <span className="pb-1 text-sm text-muted-foreground">{plan.period}</span>
                                            </>
                                        )}
                                    </div>
                                    <ul className="mt-6 flex-1 space-y-2.5">
                                        {plan.features.map((feature) => (
                                            <li
                                                key={feature}
                                                className="flex items-start gap-2 text-sm text-foreground/80"
                                            >
                                                <Icon
                                                    name="checkbox-circle-fill"
                                                    className="mt-0.5 text-base text-primary"
                                                />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                    <a
                                        href="#demo"
                                        className={cn(
                                            "mt-8 inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
                                            plan.highlight
                                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                                : "border border-border text-foreground hover:border-primary/50"
                                        )}
                                    >
                                        {plan.price === "Custom" ? "Talk to sales" : "Start free trial"}
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="why" className="bg-background px-5 py-20 sm:px-8 sm:py-24">
                    <div className="mx-auto max-w-6xl">
                        <div className="mx-auto max-w-2xl text-center">
                            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                Why Choose Propflow Real Estate CRM
                            </h2>
                        </div>
                        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {WHY.map((item) => (
                                <div key={item.title} className="rounded-2xl border border-border p-5">
                                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                                        <Icon name={item.icon} className="text-lg" />
                                    </div>
                                    <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="bg-primary px-5 py-16 text-primary-foreground sm:px-8">
                    <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 lg:grid-cols-4">
                        {STATS.map((stat) => (
                            <div key={stat.label}>
                                <div className="text-3xl font-bold tracking-tight sm:text-4xl">{stat.value}</div>
                                <div className="mt-1 text-sm text-primary-foreground/65">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="stories" className="bg-muted px-5 py-20 sm:px-8 sm:py-24">
                    <div className="mx-auto max-w-6xl">
                        <div className="mx-auto max-w-2xl text-center">
                            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                Success Stories from Our Customers
                            </h2>
                        </div>
                        <div className="mt-12 grid gap-5 lg:grid-cols-3">
                            {TESTIMONIALS.map((item) => (
                                <blockquote
                                    key={item.name}
                                    className="flex h-full flex-col rounded-2xl border border-border bg-background p-6 shadow-sm"
                                >
                                    <Icon name="double-quotes-l" className="text-2xl text-primary" />
                                    <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground/80">
                                        {item.quote}
                                    </p>
                                    <footer className="mt-6 border-t border-border pt-4">
                                        <div className="text-sm font-semibold text-foreground">{item.name}</div>
                                        <div className="text-xs text-muted-foreground">{item.role}</div>
                                    </footer>
                                </blockquote>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="faq" className="bg-background px-5 py-20 sm:px-8 sm:py-24">
                    <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                Frequently asked questions
                            </h2>
                            <p className="mt-3 text-base text-muted-foreground">
                                Everything you need before booking a walkthrough.
                            </p>
                        </div>
                        <div>
                            {FAQS.map((item) => (
                                <FaqItem key={item.q} item={item} />
                            ))}
                        </div>
                    </div>
                </section>

                <section id="demo" className="bg-muted px-5 py-20 sm:px-8 sm:py-24">
                    <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-background px-6 py-12 text-center shadow-sm sm:px-10">
                        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                            Ready to simplify enquiry to handover?
                        </h2>
                        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
                            Book a live demo of pipelines, inventory, and AI assists tailored to developers and channel
                            partners.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                            <a
                                href={`mailto:${contactEmail}`}
                                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                            >
                                Book a Demo
                            </a>
                            <a
                                href={authUrl}
                                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground"
                            >
                                Sign in to workspace
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="bg-primary px-5 py-14 text-primary-foreground sm:px-8">
                <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:flex-row lg:justify-between">
                    <div className="max-w-sm">
                        <div className="flex items-center">
                            <img
                                src="/assets/images/propflow-logo-light.svg"
                                alt={brand}
                                className="h-8 w-auto brightness-0 invert"
                            />
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-primary-foreground/65">
                            Build better customer relationships with Propflow—from first lead to final handover.
                        </p>
                        <a
                            href="#demo"
                            className="mt-5 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                            Book a Demo
                        </a>
                    </div>

                    <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
                        <div>
                            <div className="text-xs font-semibold tracking-[0.14em] text-primary-foreground/45 uppercase">
                                Product
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-primary-foreground/75">
                                <li>
                                    <a href="#offerings" className="hover:text-primary-foreground">
                                        Solutions
                                    </a>
                                </li>
                                <li>
                                    <a href="#dashboards" className="hover:text-primary-foreground">
                                        Dashboards
                                    </a>
                                </li>
                                <li>
                                    <a href="#pricing" className="hover:text-primary-foreground">
                                        Pricing
                                    </a>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <div className="text-xs font-semibold tracking-[0.14em] text-primary-foreground/45 uppercase">
                                Company
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-primary-foreground/75">
                                <li>
                                    <a href="#stories" className="hover:text-primary-foreground">
                                        Customers
                                    </a>
                                </li>
                                <li>
                                    <a href="#faq" className="hover:text-primary-foreground">
                                        FAQ
                                    </a>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <div className="text-xs font-semibold tracking-[0.14em] text-primary-foreground/45 uppercase">
                                Get in touch
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-primary-foreground/75">
                                <li>
                                    <a href={`mailto:${contactEmail}`} className="hover:text-primary-foreground">
                                        {contactEmail}
                                    </a>
                                </li>
                                <li>
                                    <a href={authUrl} className="hover:text-primary-foreground">
                                        Sign in
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="mx-auto mt-12 flex max-w-6xl flex-col gap-2 border-t border-primary-foreground/10 pt-6 text-xs text-primary-foreground/40 sm:flex-row sm:items-center sm:justify-between">
                    <span>© {new Date().getFullYear()} {brand}. All rights reserved.</span>
                    <span className="flex gap-4">
                        <a href="#faq" className="hover:text-primary-foreground/70">
                            Terms
                        </a>
                        <a href="#faq" className="hover:text-primary-foreground/70">
                            Privacy
                        </a>
                    </span>
                </div>
            </footer>
        </div>
    );
}
