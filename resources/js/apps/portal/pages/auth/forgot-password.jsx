import AuthLayout from "@/portal/layouts/auth.layout";
import { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react'
import { useForm } from 'react-hook-form';
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextLink } from "@/components/ui/text-link";

function ForgotPassword() {

    const { handleSubmit, register, watch, setValue, reset } = useForm()    

    const onSubmit = (data) => {

    }

    return(
        <>
            <Head title="Login" />
            <h2 className="text-2xl mb-1 font-bold tracking-tight">Forgot Password?</h2>
            <p className="text-foreground/50 mb-5">Enter your email address below and we'll help you reset your password to get back into PropFlow.</p>
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="my-5 flex flex-col space-y-5">   
                    <Input 
                        type="email" 
                        name="email_address"
                        label="Email Address" 
                        size="lg"                                                
                        startElement={<Icon name="mail-line"/>} 
                        placeholder="Registered email address..." 
                        {...register('email_address')}
                    />
                    
                    <Button size="lg">Submit</Button>

                    <div className="flex flex-row items-center justify-start">                        
                        <TextLink  href="/"><i className="ri-arrow-left-line"></i> Back to Login</TextLink>
                    </div>

                    
                </div>
            </form>
        </>
    )
}

ForgotPassword.layout = (page) => <AuthLayout children={page} />;

export default ForgotPassword