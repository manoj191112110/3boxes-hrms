'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';
import { useAuthStore } from '@/store/authStore';

export default function CatalogPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  // Use authStore — fixes "no token provided" + missing employeeId for Buy flow.
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const employeeId = user?.employee?.employeeId || null;

  const load = useCallback(async (cat: string): Promise<void> => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const url = `/api/marketplace/products${cat ? `?category=${cat}` : ''}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json().catch(() => ({}));
      setProducts(d.products || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Auto-seed demo data on first load if catalog is empty
  const { seeded } = useAutoSeedDemo('marketplace', () => load(category));

  const [retriedFetchUser, setRetriedFetchUser] = useState(false);
  useEffect(() => {
    if (token && !user?.employee && !retriedFetchUser) {
      setRetriedFetchUser(true);
      fetchUser();
    }
    load(category);
  }, [category, load, seeded, token, user, fetchUser, retriedFetchUser]);

  async function buy(p: any) {
    if (!employeeId) { alert('No employee context — please log in as a user with an Employee profile.'); return; }
    if (!token) { alert('Not authenticated'); return; }
    // For demo: use first wallet bucket of allowed category
    const wr = await fetch(`/api/wallet?employeeId=${employeeId}`, { headers: { Authorization: `Bearer ${token}` } });
    const wallet = (await wr.json()).wallet;
    const allowed = p.allowedBuckets.split(',').map((s: any) => s.trim());
    const bucket = wallet?.buckets?.find((b: any) => allowed.includes(b.category));
    if (!bucket) { alert(`No eligible bucket. Allowed: ${p.allowedBuckets}`); return; }
    if (!confirm(`Buy ${p.name} for ${p.currency} ${p.corporatePrice} from ${bucket.category} bucket?`)) return;
    const r = await fetch('/api/marketplace/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ employeeId, productId: p.id, qty: 1, walletBucketId: bucket.id }) });
    if (r.ok) { const o = await r.json(); alert(`✓ Order placed! Code: ${o.order.fulfillmentRef}`); }
    else { const e = await r.json().catch(() => ({})); alert(e.error || 'Order failed'); }
  }
  const cats = ['', 'voucher', 'gift_card', 'physical_goods', 'digital_goods', 'course', 'insurance_topup'];
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Corporate Catalog</h1>
        <p className="text-sm text-gray-600 mt-1">White-labeled · API integrations · Corporate vs public pricing (REQ-SHP-01/02/03)</p>
      </div>
      <div className="flex gap-2">
        {cats.map(c => <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1 text-sm rounded ${category === c ? 'bg-green-600 text-white' : 'bg-gray-100'}`}>{c || 'All'}</button>)}
      </div>
      {loading ? <div className="text-gray-500">Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(p => (
            <div key={p.id} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded mb-3 flex items-center justify-center text-4xl">🎁</div>
              <h3 className="font-semibold text-sm">{p.name}</h3>
              <p className="text-xs text-gray-500 mb-2">{p.providerName} · {p.category}</p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xs text-gray-400 line-through">{p.currency} {p.publicPrice}</span>
                <span className="text-lg font-bold text-green-600">{p.currency} {p.corporatePrice}</span>
              </div>
              <div className="text-xs text-gray-500 mb-3">Buckets: {p.allowedBuckets}</div>
              <button onClick={() => buy(p)} className="w-full px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">Buy Now</button>
            </div>
          ))}
          {products.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">No products in catalog. Add products as super_admin.</div>}
        </div>
      )}
    </div>
  );
}
