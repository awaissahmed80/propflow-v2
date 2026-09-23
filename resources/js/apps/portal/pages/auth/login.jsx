import AuthLayout from "@/portal/layouts/auth.layout";
import { useEffect, useState } from "react";
import { Head, router } from "@inertiajs/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextLink } from "@/components/ui/text-link";

function Login({ status = null, workspaces = [], redirect = null }) {
    const [processing, setProcessing] = useState(false);
    const [selectingId, setSelectingId] = useState(null);
    const { handleSubmit, register, watch, setValue, reset } = useForm({
        defaultValues: {
            email_address: "",
            password: "",
            remember: false,
        },
    });

    useEffect(() => {
        if (status === "authenticated" && redirect) {
            window.location.assign(redirect);
        }
    }, [status, redirect]);

    const onSubmit = (data) => {
        setProcessing(true);

        router.post("/login", data, {
            onSuccess: (page) => {
                if (page.props.status === "authenticated" && page.props.redirect) {
                    window.location.assign(page.props.redirect);
                    return;
                }

                if (page.props.status === "select_workspace") {
                    return;
                }

                reset({
                    email_address: data.email_address,
                    password: "",
                    remember: data.remember,
                });
            },
            onError: (errors) => {
                toast.error(errors.message || errors.email_address || "Invalid credentials");
            },
            onFinish: () => setProcessing(false),
        });
    };

    const selectWorkspace = (tenantId) => {
        setSelectingId(tenantId);

        router.post(
            "/workspaces/select",
            { tenant_id: tenantId },
            {
                onSuccess: (page) => {
                    if (page.props.status === "authenticated" && page.props.redirect) {
                        window.location.assign(page.props.redirect);
                    }
                },
                onError: (errors) => {
                    toast.error(errors.tenant_id || errors.message || "Unable to open that workspace");
                },
                onFinish: () => setSelectingId(null),
            }
        );
    };

    if (status === "select_workspace") {
        return (
            <>
                <Head title="Choose workspace" />
                <h2 className="mb-1 text-2xl font-bold tracking-tight">Choose a workspace</h2>
                <p className="mb-5 text-foreground/50">
                    Your account belongs to more than one workspace. Select which one to open.
                </p>

                <div className="space-y-3">
                    {workspaces.map((workspace) => (
                        <button
                            key={workspace.id}
                            type="button"
                            disabled={selectingId !== null}
                            onClick={() => selectWorkspace(workspace.id)}
                            className="flex w-full items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-60"
                        >
                            <div className="min-w-0">
                                <div className="truncate font-medium text-foreground">
                                    {workspace.name}
                                </div>
                                {workspace.identifier ? (
                                    <div className="truncate text-sm text-muted-foreground">
                                        {workspace.identifier}
                                    </div>
                                ) : null}
                            </div>
                            <Icon
                                name={
                                    selectingId === workspace.id
                                        ? "loader-4-line"
                                        : "arrow-right-s-line"
                                }
                                className={
                                    selectingId === workspace.id
                                        ? "animate-spin text-lg text-muted-foreground"
                                        : "text-lg text-muted-foreground"
                                }
                            />
                        </button>
                    ))}
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="mt-6 w-full"
                    onClick={() => router.post("/logout")}
                >
                    Sign out
                </Button>
            </>
        );
    }

    return (
        <>
            <Head title="Login" />
            <h2 className="mb-1 text-2xl font-bold tracking-tight">Log in to your account</h2>
            <p className="mb-5 text-foreground/50">
                Propflow is invite-only. Use the email and password from your workspace invitation.
            </p>
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="my-5 flex flex-col space-y-5">
                    <Input
                        type="email"
                        name="email_address"
                        label="Email Address"
                        size="lg"
                        startElement={<Icon name="mail-line" />}
                        placeholder="e.g. john@email.com"
                        autoComplete="username"
                        {...register("email_address", { required: true })}
                    />
                    <Input.Password
                        label="Password"
                        name="password"
                        size="lg"
                        startElement={<Icon name="key-line" />}
                        placeholder=""
                        autoComplete="current-password"
                        {...register("password", { required: true })}
                    />

                    <div className="flex flex-row items-center justify-between">
                        <Checkbox
                            checked={watch("remember") || false}
                            onCheckedChange={(checked) => setValue("remember", Boolean(checked))}
                        >
                            Remember Me
                        </Checkbox>
                        <TextLink
                            className="text-base hover:underline hover:text-primary"
                            href="/forgot-password"
                        >
                            Forgot Password?
                        </TextLink>
                    </div>

                    <Button type="submit" size="lg" disabled={processing}>
                        {processing ? "Logging in..." : "Login"}
                    </Button>
                </div>
            </form>
        </>
    );
}

Login.layout = (page) => <AuthLayout children={page} />;

export default Login;
