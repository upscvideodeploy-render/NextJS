/**
 * Admin Coupon Management Dashboard
 * Story 5.7 - Coupon & Discount Code System
 *
 * AC#2: Admin panel to create coupons
 * AC#3: Coupon listing with usage analytics
 * AC#7: Coupon analytics (usage, conversion rate)
 */

'use client';

import { useState, useEffect } from 'react';
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
  campaign_name: string | null;
  is_active: boolean;
  usage_count?: number;
  usage_percent?: number;
  is_expired?: boolean;
  is_maxed_out?: boolean;
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percent' as 'percent' | 'fixed',
    discount_value: '',
    valid_until: '',
    max_uses: '',
    campaign_name: '',
    first_purchase_only: false,
    per_user_limit: '1'
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch('/api/admin/coupons', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      setCoupons(data.coupons || []);
    }
    setIsLoading(false);
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        code: formData.code.toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: parseInt(formData.discount_value),
        valid_until: formData.valid_until || null,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        campaign_name: formData.campaign_name || null,
        first_purchase_only: formData.first_purchase_only,
        per_user_limit: parseInt(formData.per_user_limit)
      }),
    });

    if (response.ok) {
      setShowCreateModal(false);
      setFormData({
        code: '',
        discount_type: 'percent',
        discount_value: '',
        valid_until: '',
        max_uses: '',
        campaign_name: '',
        first_purchase_only: false,
        per_user_limit: '1'
      });
      fetchCoupons();
    } else {
      const error = await response.json();
      alert(`Error: ${error.error}`);
    }
  };

  const toggleCouponStatus = async (couponId: string, currentStatus: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(`/api/admin/coupons/${couponId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ is_active: !currentStatus }),
    });

    if (response.ok) {
      fetchCoupons();
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading coupons...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Coupon Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Create Coupon
        </button>
      </div>

      {/* Coupons Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valid Until</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {coupons.map((coupon) => (
              <tr key={coupon.id}>
                <td className="px-6 py-4">
                  <span className="font-mono font-bold">{coupon.code}</span>
                </td>
                <td className="px-6 py-4">
                  {coupon.discount_type === 'percent'
                    ? `${coupon.discount_value}%`
                    : `₹${coupon.discount_value}`}
                </td>
                <td className="px-6 py-4">
                  {coupon.valid_until
                    ? new Date(coupon.valid_until).toLocaleDateString()
                    : 'No expiry'}
                </td>
                <td className="px-6 py-4">
                  <div>
                    <span>{coupon.usage_count || coupon.used_count || 0}</span>
                    {coupon.max_uses && <span> / {coupon.max_uses}</span>}
                  </div>
                  {coupon.usage_percent !== undefined && coupon.usage_percent > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${coupon.usage_percent}%` }}
                      />
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">{coupon.campaign_name || '-'}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      coupon.is_expired
                        ? 'bg-red-100 text-red-800'
                        : coupon.is_maxed_out
                        ? 'bg-yellow-100 text-yellow-800'
                        : coupon.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {coupon.is_expired
                      ? 'Expired'
                      : coupon.is_maxed_out
                      ? 'Max Used'
                      : coupon.is_active
                      ? 'Active'
                      : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleCouponStatus(coupon.id, coupon.is_active)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                    disabled={coupon.is_expired || coupon.is_maxed_out}
                  >
                    {coupon.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {coupons.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No coupons found. Create your first coupon to get started.
          </div>
        )}
      </div>

      {/* Create Coupon Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Create New Coupon</h2>

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Coupon Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="SUMMER25"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Discount Type *</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percent' | 'fixed' })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="percent">Percentage</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Discount Value *</label>
                  <input
                    type="number"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder={formData.discount_type === 'percent' ? '20' : '100'}
                    min="1"
                    max={formData.discount_type === 'percent' ? '100' : undefined}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Max Uses</label>
                  <input
                    type="number"
                    value={formData.max_uses}
                    onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Unlimited"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={formData.campaign_name}
                  onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Summer Sale 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Per User Limit</label>
                <input
                  type="number"
                  value={formData.per_user_limit}
                  onChange={(e) => setFormData({ ...formData, per_user_limit: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="1"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.first_purchase_only}
                  onChange={(e) => setFormData({ ...formData, first_purchase_only: e.target.checked })}
                  className="mr-2"
                  id="first-purchase"
                />
                <label htmlFor="first-purchase" className="text-sm">First-time subscribers only</label>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
