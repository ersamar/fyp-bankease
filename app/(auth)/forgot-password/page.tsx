'use client'

import Image from 'next/image';
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { createRecovery } from '@/lib/actions/user.actions'

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
})

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>

const ForgotPasswordPage = () => {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true)
    try {
      await createRecovery(data.email)
      toast.success("Recovery email sent! Check your inbox.")
      router.push('/sign-in')
    } catch (error: any) {
      toast.error(error.message || "Failed to send recovery email.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="flex-center flex-col items-center justify-center px-20 py-12 w-full mx-auto">
      
      <div className="w-full max-w-md mb-6">
        <Link href="/" className="cursor-pointer flex items-center gap-1 mb-4">
          <Image
            src="/icons/logo.png"
            width={34}
            height={34}
            alt="BankEase logo"
          />
          <h1 className="text-26 font-ibm-plex-serif font-bold text-black-1">BankEase</h1>
        </Link>

        <h1 className="text-30 font-semibold text-white mt-8">Forgot Password</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full max-w-md">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-white">
            Email
          </label>
          <Input
            type="email"
            id="email"
            {...register("email")}
            className="w-full max-w-md"
          />
          {errors.email?.message && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#191919] text-white hover:opacity-90 max-w-md"
        >
          {isLoading ? "Sending..." : "Send Recovery Email"}
        </Button>
      </form>

      <div className="mt-6 w-full max-w-md flex justify-center items-center gap-2">
        <p className="text-sm text-white">Remember password?</p>
        <Link
          href="/sign-in"
          className="text-sm text-[#191919] hover:underline"
        >
          Back to Login
        </Link>
      </div>
    </section>
  )
}

export default ForgotPasswordPage
