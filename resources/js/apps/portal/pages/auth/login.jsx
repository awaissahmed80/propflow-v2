import AuthLayout from "@/portal/layouts/auth.layout";
import { useState } from 'react';
import { Head, router } from '@inertiajs/react'
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextLink } from "@/components/ui/text-link";

function Login() {
    const [processing, setProcessing] = useState(false);
    const { handleSubmit, register, watch, setValue, reset } = useForm({
        defaultValues: {
            email_address: '',
            password: '',
            remember: false,
        },
    });

    const onSubmit = (data) => {
        setProcessing(true);

        router.post('/login', data, {
            onSuccess: (page) => {
                if (page.props.status === 'authenticated' && page.props.redirect) {
                    window.location.assign(page.props.redirect);
                    return;
                }

                reset({
                    email_address: data.email_address,
                    password: '',
                    remember: data.remember,
                });
            },
            onError: (errors) => {
                toast.error(errors.message || errors.email_address || 'Invalid credentials');
            },
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <>
            <Head title="Login" />
            <h2 className="text-2xl mb-1 font-bold tracking-tight">Log in to your account</h2>
            <p className="text-foreground/50 mb-5">Good to see you again! Log in to get started.</p>
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="my-5 flex flex-col space-y-5">
                    <Input
                        type="email"
                        name="email_address"
                        label="Email Address"
                        size="lg"
                        startElement={<Icon name="mail-line"/>}
                        placeholder="e.g. john@email.com"
                        autoComplete="username"
                        {...register('email_address', { required: true })}
                    />
                    <Input.Password
                        label="Password"
                        name="password"
                        size="lg"
                        startElement={<Icon name="key-line"/>}
                        placeholder=""
                        autoComplete="current-password"
                        {...register('password', { required: true })}
                    />

                    <div className="flex flex-row items-center justify-between">
                        <Checkbox
                            checked={watch('remember') || false}
                            onCheckedChange={(checked) => setValue('remember', Boolean(checked))}
                        >
                            Remember Me
                        </Checkbox>
                        <TextLink className="text-base hover:underline hover:text-primary" href="/forgot-password">
                            Forgot Password?
                        </TextLink>
                    </div>

                    <Button type="submit" size="lg" disabled={processing}>
                        {processing ? 'Logging in...' : 'Login'}
                    </Button>
                </div>
            </form>
        </>
    );
}

Login.layout = (page) => <AuthLayout children={page} />;

export default Login;
