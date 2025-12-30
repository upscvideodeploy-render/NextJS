'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/app/providers/AuthProvider'
import { z } from 'zod'

// Full signup schema with terms agreement
const signupSchemaWithTerms = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  agreedToTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the terms' }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type SignupFormWithTerms = z.infer<typeof signupSchemaWithTerms>

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signUp } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showVerification, setShowVerification] = useState(false)
  const [referralCode, setReferralCode] = useState<string>('')

  // Check for referral code in URL (Story 5.10 AC#2)
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      setReferralCode(ref.toUpperCase())
    }
  }, [searchParams])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormWithTerms>({
    resolver: zodResolver(signupSchemaWithTerms),
  })

  const onSubmit = async (data: SignupFormWithTerms) => {
    setIsLoading(true)
    setError(null)

    try {
      await signUp(data.email, data.password, data.name, referralCode)
      setShowVerification(true)
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup')
    } finally {
      setIsLoading(false)
    }
  }

  if (showVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Check your email</h1>
            <p className="text-gray-400 mb-6">
              We've sent you a verification link. Please check your email and click the link to verify your account.
            </p>
            <Link href="/login" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all inline-block">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
            UPSC PrepX-AI
          </h1>
          <p className="text-gray-400">Create your account</p>
        </div>

        {/* Signup Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
          {/* Trial Banner */}
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-sm">
              <strong>7-Day Free Trial</strong> - Get full access to all features, no credit card required!
            </p>
          </div>

          {/* Referral Code Banner (Story 5.10 AC#2) */}
          {referralCode && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 text-sm">
                <strong>Referral Applied:</strong> Using code <span className="font-mono bg-green-500/20 px-2 py-1 rounded mx-1">{referralCode}</span>
              </p>
              <button
                type="button"
                onClick={() => setReferralCode('')}
                className="text-xs text-green-300 hover:text-green-200 mt-1 underline"
              >
                Remove code
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <input
                {...register('name')}
                type="text"
                id="name"
                className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg focus:outline-none focus:border-neon-blue text-white"
                placeholder="John Doe"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                id="email"
                className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg focus:outline-none focus:border-neon-blue text-white"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                {...register('password')}
                type="password"
                id="password"
                className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg focus:outline-none focus:border-neon-blue text-white"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                {...register('confirmPassword')}
                type="password"
                id="confirmPassword"
                className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg focus:outline-none focus:border-neon-blue text-white"
                placeholder="••••••••"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-400">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Terms */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  {...register('agreedToTerms')}
                  type="checkbox"
                  className="mt-1 w-4 h-4 rounded border-white/20 bg-slate-800/50 text-neon-blue focus:ring-neon-blue"
                />
                <span className="text-sm text-gray-400">
                  I agree to the Terms of Service and Privacy Policy
                </span>
              </label>
              {errors.agreedToTerms && (
                <p className="mt-1 text-sm text-red-400">{errors.agreedToTerms.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Sign In Link */}
          <p className="mt-6 text-center text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
