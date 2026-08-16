'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useState } from 'react';
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import CustomInput from './CustomInput';
import { authFormSchema } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getLoggedInUser, signIn, signUp } from '@/lib/actions/user.actions';
import PlaidLink from './PlaidLink';

const AuthForm = ({ type }: { type: string }) => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const formSchema = authFormSchema(type);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: '',
      ...(type === 'sign-up' && {
        firstName: "",
        lastName: "",
        address1: "",
        city: "",
        state: "",
        postalCode: "",
        dateOfBirth: "",
        ssn: "",
        confirmPassword: "",
      })
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true);

    try {
      if (type === 'sign-up') {
        const userData = {
          firstName: String(data.firstName),
          lastName: String(data.lastName),
          address1: String(data.address1),
          city: String(data.city),
          state: String(data.state),
          postalCode: String(data.postalCode),
          dateOfBirth: String(data.dateOfBirth),
          ssn: String(data.ssn),
          email: data.email,
          password: data.password
        };

        await signUp(userData);
        toast.success('Account created successfully!');
        window.location.href = '/';
      }

      if (type === 'sign-in') {
        const response = await signIn({
          email: data.email,
          password: data.password,
        });
        if (response) {
          toast.success('Logged in successfully!');
          window.location.href = '/';
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="auth-form">
      <header className='flex flex-col gap-5 md:gap-8'>
        <Link href="/" className="cursor-pointer flex items-center gap-1">
          <Image
            src="/icons/logo.png"
            width={34}
            height={34}
            alt="BankEase logo"
          />
          <h1 className="text-26 font-ibm-plex-serif font-bold text-black-1">BankEase</h1>
        </Link>

        <div className="flex flex-col gap-1 md:gap-3">
          <h1 className="text-24 lg:text-36 font-semibold text-gray-900">
            {user
              ? 'Link Account'
              : type === 'sign-in'
                ? 'Sign In'
                : 'Sign Up'
            }
            <p className="text-16 font-normal text-white">
              {user
                ? 'Link your account to get started'
                : 'Please enter your details'
              }
            </p>
          </h1>
        </div>
      </header>

      {user ? (
        <div className="flex flex-col gap-4">
          <PlaidLink user={user} variant="primary" />
        </div>
      ) : (
        <>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {type === 'sign-up' && (
                <>
                  <div className="flex gap-4 text-black">
                    <CustomInput control={form.control} name='firstName' label="First Name" placeholder='First name' />
                    <CustomInput control={form.control} name='lastName' label="Last Name" placeholder='Last name' />
                  </div>
                  <CustomInput control={form.control} name='address1' label="Address" placeholder='Address' />
                  <CustomInput control={form.control} name='city' label="City" placeholder='City' />
                  <div className="flex gap-4">
                    <CustomInput control={form.control} name='state' label="State" placeholder='NY/CA' />
                    <CustomInput control={form.control} name='postalCode' label="Postal Code" placeholder='11101' />
                  </div>
                  <div className="flex gap-4">
                    <CustomInput control={form.control} name='dateOfBirth' label="Date of Birth" placeholder='YYYY-MM-DD' />
                    <CustomInput control={form.control} name='ssn' label="SSN" placeholder='1234' />
                  </div>
                </>
              )}

              <CustomInput control={form.control} name='email' label="Email" placeholder='Email' />
              <CustomInput 
                control={form.control} 
                name='password' 
                label="Password" 
                placeholder='Password' 
                type="password" 
              />
              {type === 'sign-up' && (
                <CustomInput 
                  control={form.control} 
                  name='confirmPassword' 
                  label="Confirm Password" 
                  placeholder='Confirm Password' 
                  type="password" 
                />
              )}

              <div className="flex flex-col gap-4">
                <Button type="submit" disabled={isLoading} className="form-btn2">
                  {isLoading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" /> &nbsp;
                      Loading...
                    </>
                  ) : type === 'sign-in'
                    ? 'Sign In' : 'Sign Up'}
                </Button>
              </div>
            </form>
          </Form>

          {type === 'sign-in' && (
            <div className="flex justify-between items-center mt-2">
              <Link href="/forgot-password" className="text-14 text-blue-600 hover:underline">
                Forgot password?
              </Link>
              <div className="flex items-center gap-1">
                <p className="text-14 font-normal text-gray-600">
                  Don't have an account?
                </p>
                <Link href="/sign-up" className="form-link">
                  Sign up
                </Link>
              </div>
            </div>
          )}

          {type === 'sign-up' && (
            <footer className="flex justify-center gap-1">
              <p className="text-14 font-normal text-gray-600">
                Already have an account?
              </p>
              <Link href="/sign-in" className="form-link">
                Sign in
              </Link>
            </footer>
          )}
        </>
      )}
    </section>
  );
};

export default AuthForm;