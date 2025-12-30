/**
 * Admin Coupon Management
 * Story 5.7 - Coupon & Discount Code System
 *
 * AC#1: /admin/coupons with create/edit/deactivate
 * AC#2: Coupon fields management
 * AC#3: Restrictions configuration
 * AC#10: Analytics tracking
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  valid_from: string;
  valid_until: string | null;
  max_uses: number | null;
  used_count: number;
  min_plan: string | null;
  first_purchase_only: boolean;
  per_user_limit: number;
  email_locked: string | null;
  campaign_name: string | null;
  is_active: boolean;
  created_at: string;
}

const EMPTY_COUPON: Partial<Coupon> = {
  code: '',
  discount_type: 'percent',
  discount_value: 10,
  valid_from: new Date().toISOString().split('T')[0],
  valid_until: null,
  max_uses: null,
  min_plan: null,
  first_purchase_only: false,
  per_user_limit: 1,
  email_locked: null,
  campaign_name: '',
  is_active: true,
};

export default function CouponsPage() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon>>(EMPTY_COUPON);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    setIsAdmin(true);
    fetchCoupons();
  };

  const fetchCoupons = async () => {
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setCoupons(data);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    const couponData = {
      code: editingCoupon.code?.toUpperCase(),
      discount_type: editingCoupon.discount_type,
      discount_value: editingCoupon.discount_value,
      valid_from: editingCoupon.valid_from,
      valid_until: editingCoupon.valid_until || null,
      max_uses: editingCoupon.max_uses || null,
      min_plan: editingCoupon.min_plan || null,
      first_purchase_only: editingCoupon.first_purchase_only,
      per_user_limit: editingCoupon.per_user_limit || 1,
      email_locked: editingCoupon.email_locked || null,
      campaign_name: editingCoupon.campaign_name || null,
      is_active: editingCoupon.is_active,
    };

    if (editingCoupon.id) {
      // Update existing
      await supabase
        .from('coupons')
        .update(couponData)
        .eq('id', editingCoupon.id);
    } else {
      // Create new
      await supabase
        .from('coupons')
        .insert(couponData);
    }

    setShowModal(false);
    setEditingCoupon(EMPTY_COUPON);
    fetchCoupons();
  };

  const toggleActive = async (coupon: Coupon) => {
    await supabase
      .from('coupons')
      .update({ is_active: !coupon.is_active })
      .eq('id', coupon.id);

    fetchCoupons();
  };

  const openCreateModal = () => {
    setEditingCoupon(EMPTY_COUPON);
    setShowModal(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon({
      ...coupon,
      valid_from: coupon.valid_from?.split('T')[0],
      valid_until: coupon.valid_until?.split('T')[0] || '',
    });
    setShowModal(true);
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Coupon Management</h1>
          <button
            onClick={openCreateModal}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors"
          >
            Create Coupon
          </button>
        </div>

        {/* Coupons Table */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 text-sm bg-gray-800/50">
                  <th className="p-4">Code</th>
                  <th className="p-4">Discount</th>
                  <th className="p-4">Usage</th>
                  <th className="p-4">Valid Until</th>
                  <th className="p-4">Restrictions</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="border-t border-gray-800">
                    <td className="p-4">
                      <span className="font-mono font-bold text-purple-400">
                        {coupon.code}
                      </span>
                      {coupon.campaign_name && (
                        <p className="text-xs text-gray-500 mt-1">{coupon.campaign_name}</p>
                      )}
                    </td>
                    <td className="p-4">
                      {coupon.discount_type === 'percent'
                        ? `${coupon.discount_value}%`
                        : `₹${coupon.discount_value}`}
                    </td>
                    <td className="p-4">
                      {coupon.used_count}
                      {coupon.max_uses && ` / ${coupon.max_uses}`}
                    </td>
                    <td className="p-4 text-sm">
                      {coupon.valid_until
                        ? new Date(coupon.valid_until).toLocaleDateString()
                        : 'No expiry'}
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {coupon.min_plan && (
                          <span className="bg-gray-700 px-2 py-0.5 rounded text-xs">
                            {coupon.min_plan}+
                          </span>
                        )}
                        {coupon.first_purchase_only && (
                          <span className="bg-blue-700/50 px-2 py-0.5 rounded text-xs">
                            First only
                          </span>
                        )}
                        {coupon.email_locked && (
                          <span className="bg-yellow-700/50 px-2 py-0.5 rounded text-xs">
                            Email locked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        coupon.is_active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {coupon.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(coupon)}
                          className="text-purple-400 hover:text-purple-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(coupon)}
                          className={coupon.is_active
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-green-400 hover:text-green-300'
                          }
                        >
                          {coupon.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-6">
                {editingCoupon.id ? 'Edit Coupon' : 'Create Coupon'}
              </h2>

              <div className="space-y-4">
                {/* Code */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Coupon Code</label>
                  <input
                    type="text"
                    value={editingCoupon.code || ''}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, code: e.target.value.toUpperCase() })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 font-mono"
                    placeholder="WELCOME20"
                  />
                </div>

                {/* Discount Type & Value */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Discount Type</label>
                    <select
                      value={editingCoupon.discount_type || 'percent'}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, discount_type: e.target.value as 'percent' | 'fixed' })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                    >
                      <option value="percent">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      {editingCoupon.discount_type === 'percent' ? 'Percentage' : 'Amount (₹)'}
                    </label>
                    <input
                      type="number"
                      value={editingCoupon.discount_value || 0}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, discount_value: parseInt(e.target.value) })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                    />
                  </div>
                </div>

                {/* Validity */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Valid From</label>
                    <input
                      type="date"
                      value={editingCoupon.valid_from || ''}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, valid_from: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Valid Until (optional)</label>
                    <input
                      type="date"
                      value={editingCoupon.valid_until || ''}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, valid_until: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                    />
                  </div>
                </div>

                {/* Usage Limits */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Max Uses (optional)</label>
                    <input
                      type="number"
                      value={editingCoupon.max_uses || ''}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, max_uses: parseInt(e.target.value) || null })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                      placeholder="Unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Per User Limit</label>
                    <input
                      type="number"
                      value={editingCoupon.per_user_limit || 1}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, per_user_limit: parseInt(e.target.value) })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                    />
                  </div>
                </div>

                {/* Restrictions */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Minimum Plan</label>
                  <select
                    value={editingCoupon.min_plan || ''}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, min_plan: e.target.value || null })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                  >
                    <option value="">Any plan</option>
                    <option value="monthly">Monthly+</option>
                    <option value="quarterly">Quarterly+</option>
                    <option value="half-yearly">Half-Yearly+</option>
                    <option value="annual">Annual only</option>
                  </select>
                </div>

                {/* Checkboxes */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingCoupon.first_purchase_only || false}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, first_purchase_only: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">First purchase only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingCoupon.is_active ?? true}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </div>

                {/* Email Lock */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email Lock (optional)</label>
                  <input
                    type="email"
                    value={editingCoupon.email_locked || ''}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, email_locked: e.target.value || null })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                    placeholder="user@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Only this email can use the coupon</p>
                </div>

                {/* Campaign Name */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Campaign Name (optional)</label>
                  <input
                    type="text"
                    value={editingCoupon.campaign_name || ''}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, campaign_name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2"
                    placeholder="Summer Sale 2025"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 py-2 rounded-lg"
                >
                  {editingCoupon.id ? 'Save Changes' : 'Create Coupon'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
