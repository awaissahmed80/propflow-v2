import AuthLayout from "@/portal/layouts/auth.layout";
import { useEffect, useState } from "react";
import { Head, router } from "@inertiajs/react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";

function AcceptInvite({
    invitation,
    invalid = false,
    message = null,
    existing_account = false,
    authenticated_as_invitee = false,
    status,
    redirect,
}) {
    const [processing, setProcessing] = useState(false);
    const { handleSubmit, register, control, reset } = useForm({
        defaultValues: {
            first_name: invitation?.first_name || "",
            last_name: invitation?.last_name || "",
            phone_number: invitation?.phone_number || "",
            password: "",
            password_confirmation: "",
        },
    });

    useEffect(() => {
        if (status === "accepted" && redirect) {
            window.location.assign(redirect);
        }
    }, [status, redirect]);

    

    const onSubmit = (data) => {

        console.log('Data', data)
        if (!invitation?.token) {
            return;
        }

        setProcessing(true);

        router.post(`/invites/${invitation.token}`, data, {
            onSuccess: (page) => {
                if (page.props.status === "accepted" && page.props.redirect) {
                    window.location.assign(page.props.redirect);
                    return;
                }
            },
            onError: (errors) => {
                toast.error(
                    errors.message ||
                        errors.token ||
                        errors.password ||
                        errors.first_name ||
                        "Unable to accept this invitation"
                );
            },
            onFinish: () => setProcessing(false),
        });
    };

    if (invalid) {
        return (
            <>
                <Head title="Invitation" />
                <h2 className="mb-1 text-2xl font-bold tracking-tight">Invitation unavailable</h2>
                <p className="mb-5 text-foreground/50">
                    {message || "This invitation is invalid or has expired."}
                </p>
                <Button type="button" onClick={() => router.visit("/")}>
                    Back to login
                </Button>
            </>
        );
    }

    return (
        <>
            <Head title="Accept invitation" />
            <h2 className="mb-1 text-2xl font-bold tracking-tight">Join {invitation?.workspace}</h2>
            <p className="mb-5 text-foreground/50">
                {existing_account ? (
                    <>
                        Confirm your Propflow account for{" "}
                        <span className="font-medium text-foreground">{invitation?.email}</span> to
                        become active in this workspace.
                    </>
                ) : (
                    <>
                        Finish your invite for{" "}
                        <span className="font-medium text-foreground">{invitation?.email}</span>.
                        Propflow has no public signup — this link is the only way to create your
                        account.
                    </>
                )}
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {!existing_account ? (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="First name"
                                name="first_name"
                                size="lg"
                                autoComplete="given-name"
                                {...register("first_name", { required: true })}
                            />
                            <Input
                                label="Last name"
                                name="last_name"
                                size="lg"
                                autoComplete="family-name"
                                {...register("last_name", { required: true })}
                            />
                        </div>

                        <Controller
                            name="phone_number"
                            control={control}
                            render={({ field }) => (
                                <PhoneInput
                                    label="Phone"
                                    size="lg"
                                    value={field.value}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                />
                            )}
                        />

                        <Input.Password
                            label="Password"
                            name="password"
                            size="lg"
                            autoComplete="new-password"
                            startElement={<Icon name="lock-password-line" />}
                            {...register("password", { required: true, minLength: 8 })}
                        />

                        <Input.Password
                            label="Confirm password"
                            name="password_confirmation"
                            size="lg"
                            autoComplete="new-password"
                            startElement={<Icon name="lock-password-line" />}
                            {...register("password_confirmation", { required: true })}
                        />
                    </>
                ) : !authenticated_as_invitee ? (
                    <Input.Password
                        label="Account password"
                        name="password"
                        size="lg"
                        autoComplete="current-password"
                        startElement={<Icon name="lock-password-line" />}
                        {...register("password", { required: true })}
                    />
                ) : null}

                <Button type="submit" size="lg" className="w-full" loading={processing}>
                    Accept invitation
                </Button>
            </form>
        </>
    );
}

AcceptInvite.layout = (page) => <AuthLayout children={page} />;

export default AcceptInvite;
