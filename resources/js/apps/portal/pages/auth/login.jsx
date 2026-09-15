import AuthLayout from "@/portal/layouts/auth.layout";
import { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react'
import { useForm } from 'react-hook-form';
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextLink } from "@/components/ui/text-link";

function Login() {

    const { handleSubmit, register, watch, setValue, reset } = useForm()    

    const onSubmit = (data) => {
        window.location.href = `https://portal.propflow.test`
    }

    return(
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
                        {...register('email_address')}
                    />
                    <Input.Password                    
                        label="Password" 
                        name="password"
                        size="lg"
                        startElement={<Icon name="key-line"/>} 
                        placeholder="" 
                        {...register('password')}
                    />

                    <div className="flex flex-row items-center justify-between">
                        <Checkbox checked={watch('remember') || false} onCheckedChange={(e) => setValue('remember',e)}>Remember Me </Checkbox>
                        <TextLink  className="text-base hover:underline hover:text-primary" href="/forgot-password">Forgot Password?</TextLink>
                    </div>

                    <Button type="submit" size="lg">Login</Button>
                </div>
            </form>
        </>
    )
}

Login.layout = (page) => <AuthLayout children={page} />;

export default Login