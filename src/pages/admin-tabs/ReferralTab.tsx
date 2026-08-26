import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Network, Users, Trophy, Percent, Link2 } from 'lucide-react';

export const ReferralTab = () => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stats
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('referrals')
      .select(`
        id, 
        converted, 
        created_at,
        referrer:profiles!referrer_id(id, full_name, email),
        referred:profiles!referred_id(id, full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReferrals(data);
      calculateStats(data);
      buildLeaderboard(data);
    }
    setLoading(false);
  };

  const calculateStats = (data: any[]) => {
    setTotalReferrals(data.length);
    const converted = data.filter(r => r.converted).length;
    setConversionRate(data.length > 0 ? (converted / data.length) * 100 : 0);
  };

  const buildLeaderboard = (data: any[]) => {
    const counts: Record<string, { name: string, count: number, converted: number }> = {};
    
    data.forEach(r => {
      const rid = r.referrer?.id;
      if (!rid) return;
      
      if (!counts[rid]) {
        counts[rid] = { name: r.referrer.full_name || 'Unknown', count: 0, converted: 0 };
      }
      counts[rid].count += 1;
      if (r.converted) counts[rid].converted += 1;
    });

    const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
    setLeaderboard(sorted);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" /> Referral Program
          </h2>
          <p className="text-slate-400">Track student referrals and reward top advocates.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI Cards */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-slate-400">Total Referrals</h3>
            <div className="text-2xl font-bold text-white mt-1">{totalReferrals}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Percent className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-slate-400">Conversion Rate</h3>
            <div className="text-2xl font-bold text-white mt-1">{conversionRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <Card className="md:col-span-1 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <Trophy className="w-5 h-5" /> Top Referrers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">No referrals yet.</div>
            ) : (
              <div className="space-y-4">
                {leaderboard.map((lb, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-500 text-black' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        {idx + 1}
                      </div>
                      <span className="font-semibold text-sm line-clamp-1">{lb.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{lb.count}</div>
                      <div className="text-[10px] text-green-500">{lb.converted} Paid</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Table */}
        <Card className="md:col-span-2 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle>Recent Referral Network</CardTitle>
            <CardDescription className="text-slate-400">Detailed list of who referred whom.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-950/50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Date</th>
                    <th className="px-4 py-3">Referrer</th>
                    <th className="px-4 py-3"></th>
                    <th className="px-4 py-3">Referred Student</th>
                    <th className="px-4 py-3 rounded-tr-lg">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading...</td></tr>
                  ) : referrals.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">No data found.</td></tr>
                  ) : referrals.slice(0, 10).map((ref) => (
                    <tr key={ref.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(ref.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">{ref.referrer?.full_name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500 line-clamp-1">{ref.referrer?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600"><Link2 className="w-4 h-4 mx-auto" /></td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">{ref.referred?.full_name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500 line-clamp-1">{ref.referred?.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          ref.converted ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {ref.converted ? 'Paid' : 'Free'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
