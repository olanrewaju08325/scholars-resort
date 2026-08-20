import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CreditCard, TrendingUp, DollarSign, Download, Filter, Users } from 'lucide-react';
import { toast } from 'sonner';

export const RevenueReportingTab = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  
  // Stats
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [arps, setArps] = useState(0); // Average revenue per student
  const [planBreakdown, setPlanBreakdown] = useState({ lifetime: 0, yearly: 0, unknown: 0 });

  const calculateStats = useCallback((data: any[]) => {
    let rev = 0;
    let pending = 0;
    let lifetime = 0;
    let yearly = 0;
    let unknown = 0;

    // Group by month
    const monthlyMap: Record<string, number> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach(m => monthlyMap[m] = 0);

    // Get unique paid students for ARPS
    const paidStudents = new Set();

    data.forEach(payment => {
      if (payment.status === 'approved') {
        rev += payment.amount;
        paidStudents.add(payment.user_id);
        
        // Plan breakdown
        if (payment.plan_type === 'lifetime') lifetime += payment.amount;
        else if (payment.plan_type === 'yearly') yearly += payment.amount;
        else unknown += payment.amount;

        // Month grouping (assuming current year for simplicity)
        const date = new Date(payment.created_at);
        const monthName = months[date.getMonth()];
        monthlyMap[monthName] += payment.amount;
      } else if (payment.status === 'pending') {
        pending += payment.amount;
      }
    });

    setTotalRevenue(rev);
    setPendingAmount(pending);
    setArps(paidStudents.size > 0 ? rev / paidStudents.size : 0);
    setPlanBreakdown({ lifetime, yearly, unknown });

    const chartData = months.map(m => ({
      name: m,
      Revenue: monthlyMap[m]
    }));
    setMonthlyData(chartData);
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('manual_payments')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPayments(data);
      calculateStats(data);
    }
    setLoading(false);
  }, [calculateStats]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const exportCSV = () => {
    try {
      const headers = ['Date,Student,Email,Amount,Plan,Status,Reference'];
      const rows = payments.map(p => 
        `${new Date(p.created_at).toLocaleDateString()},"${p.profiles?.full_name || ''}","${p.profiles?.email || ''}",${p.amount},${p.plan_type},${p.status},${p.reference || ''}`
      );
      
      const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "scholars_resort_revenue.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV exported successfully");
    } catch (err) {
      toast.error("Failed to export CSV");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-500" /> Revenue & Financial Reporting
          </h2>
          <p className="text-slate-400">Track platform income, average revenue, and payment history.</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2 border-slate-700 bg-slate-900">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-slate-400">Total Approved Revenue</h3>
            <div className="text-2xl font-bold text-white mt-1">{formatNaira(totalRevenue)}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <CreditCard className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-slate-400">Pending Approvals</h3>
            <div className="text-2xl font-bold text-white mt-1">{formatNaira(pendingAmount)}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-slate-400">Avg Revenue Per Student</h3>
            <div className="text-2xl font-bold text-white mt-1">{formatNaira(arps)}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-sm font-medium text-slate-400">Revenue by Plan</h3>
            </div>
            <div className="space-y-3 mt-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Lifetime</span>
                  <span className="font-bold">{formatNaira(planBreakdown.lifetime)}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${totalRevenue > 0 ? (planBreakdown.lifetime/totalRevenue)*100 : 0}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Yearly</span>
                  <span className="font-bold">{formatNaira(planBreakdown.yearly)}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalRevenue > 0 ? (planBreakdown.yearly/totalRevenue)*100 : 0}%` }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Monthly Revenue Trend</CardTitle>
          <CardDescription className="text-slate-400">Approved payments over the current year.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} tickFormatter={(value) => `₦${value/1000}k`} />
                <Tooltip 
                  cursor={{fill: '#1e293b'}} 
                  contentStyle={{backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc', borderRadius: '8px'}}
                  formatter={(value) => [formatNaira(Number(value)), 'Revenue']}
                />
                <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      {/* Table Section */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" className="text-slate-400"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-950/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Date</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3 rounded-tr-lg">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">Loading...</td></tr>
                ) : payments.slice(0, 10).map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(payment.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{payment.profiles?.full_name}</div>
                      <div className="text-xs text-slate-500">{payment.profiles?.email}</div>
                    </td>
                    <td className="px-4 py-3 capitalize">{payment.plan_type}</td>
                    <td className="px-4 py-3 font-medium">{formatNaira(payment.amount)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{payment.reference || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        payment.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        payment.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {payment.status}
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
  );
};
