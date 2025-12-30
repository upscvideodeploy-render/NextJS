/**
 * Checkout Page
 * Story 5.2 - Payment Gateway Integration
 *
 * AC#2: Razorpay Checkout integration
 * AC#3: Payment flow: select plan → Subscribe → Razorpay modal → payment
 * AC#7: Failed payment handling
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_inr: number;
  duration_days: number;
  features: Record<string, unknown>;
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planSlug = searchParams.get('plan') || 'monthly';

  const [plan, setPlan] = useState<Plan | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    final_amount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadRazorpayScript();
    checkAuth();
    fetchPlan();
  }, [planSlug]);

  const loadRazorpayScript = () => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login?redirect=/checkout?plan=' + planSlug);
      return;
    }
    setUser(user);
  };

  const fetchPlan = async () => {
    const { data } = await supabase
      .from('plans')
      .select('*')
      .eq('slug', planSlug)
      .single();

    if (data) {
      setPlan(data);
    }
    setIsLoading(false);
  };

  const applyCoupon = async () => {
    if (!couponCode.trim() || !plan) return;

    setCouponError('');
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch('/api/payments/validate-coupon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        code: couponCode,
        planSlug: plan.slug,
        amount: plan.price_inr,
      }),
    });

    const result = await response.json();

    if (result.valid) {
      setAppliedCoupon({
        code: couponCode,
        discount: result.discount_amount,
        final_amount: result.final_amount,
      });
    } else {
      setCouponError(result.reason || 'Invalid coupon');
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const handlePayment = async () => {
    if (!plan || !user || isProcessing) return;

    setIsProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Create Razorpay order
      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          planSlug: plan.slug,
          couponCode: appliedCoupon?.code,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'UPSC PrepX-AI',
        description: `${plan.name} Subscription`,
        order_id: orderData.order.id,
        prefill: orderData.prefill,
        theme: {
          color: '#7c3aed',
        },
        handler: async (response: any) => {
          // Verify payment
          const verifyResponse = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify(response),
          });

          const verifyData = await verifyResponse.json();

          if (verifyData.success) {
            router.push('/settings/subscription?success=true');
          } else {
            alert('Payment verification failed. Please contact support.');
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', (response: any) => {
        alert(`Payment failed: ${response.error.description}`);
        setIsProcessing(false);
      });
      razorpay.open();

    } catch (error) {
      console.error('Payment error:', error);
      alert(error instanceof Error ? error.message : 'Payment failed');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Plan not found</h1>
          <button
            onClick={() => router.push('/pricing')}
            className="text-purple-400 hover:text-purple-300"
          >
            View all plans
          </button>
        </div>
      </div>
    );
  }

  const finalAmount = appliedCoupon?.final_amount ?? plan.price_inr;

  return (
    <div className="min-h-screen bg-gray-950 text-white py-12">
      <div className="max-w-lg mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">Complete Your Purchase</h1>

        {/* Order Summary */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="font-semibold">{plan.name}</p>
              <p className="text-sm text-gray-400">
                {plan.duration_days} days access
              </p>
            </div>
            <p className="text-lg">₹{plan.price_inr}</p>
          </div>

          {/* Coupon Input */}
          <div className="border-t border-gray-700 pt-4 mt-4">
            <label className="block text-sm text-gray-400 mb-2">
              Have a coupon code?
            </label>
            {appliedCoupon ? (
              <div className="flex items-center justify-between bg-green-900/20 border border-green-700 rounded-lg p-3">
                <div>
                  <p className="font-semibold text-green-400">{appliedCoupon.code}</p>
                  <p className="text-sm text-green-300">-₹{appliedCoupon.discount} discount</p>
                </div>
                <button
                  onClick={removeCoupon}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={applyCoupon}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
            {couponError && (
              <p className="text-red-400 text-sm mt-2">{couponError}</p>
            )}
          </div>

          {/* Total */}
          <div className="border-t border-gray-700 pt-4 mt-4">
            {appliedCoupon && (
              <div className="flex justify-between text-green-400 mb-2">
                <span>Discount</span>
                <span>-₹{appliedCoupon.discount}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>₹{finalAmount}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Includes 18% GST
            </p>
          </div>
        </div>

        {/* Pay Button */}
        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
            isProcessing
              ? 'bg-gray-700 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700'
          }`}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
              Processing...
            </span>
          ) : (
            `Pay ₹${finalAmount}`
          )}
        </button>

        {/* Security Notice */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p className="flex items-center justify-center gap-2">
            <span>🔒</span>
            Secured by Razorpay. PCI-DSS compliant.
          </p>
          <p className="mt-2">
            By proceeding, you agree to our{' '}
            <a href="/terms" className="text-purple-400 hover:text-purple-300">
              Terms of Service
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
