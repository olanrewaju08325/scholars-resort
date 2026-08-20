import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Gift, Copy, Trash2, Plus, Users, Percent, Search } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';

export const ScholarshipTab = () => {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Search Student for direct grant
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundStudent, setFoundStudent] = useState<any>(null);

  // Form State
  const [codeName, setCodeName] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState(10);
  const [maxUses, setMaxUses] = useState(100);

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCodes(data);
    }
    setLoading(false);
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeName.trim()) {
      toast.error('Code name is required.');
      return;
    }

    try {
      const { error } = await supabase
        .from('discount_codes')
        .insert([{
          code: codeName.toUpperCase(),
          discount_type: discountType,
          discount_value: discountValue,
          max_uses: maxUses
        }]);
      
      if (error) {
        if (error.code === '23505') throw new Error('Code already exists.');
        throw error;
      }
      
      toast.success('Discount code created successfully!');
      setCodeName('');
      setDiscountValue(10);
      setMaxUses(100);
      setIsFormOpen(false);
      fetchCodes();
    } catch (err: any) {
      toast.error(`Error creating code: ${err.message}`);
    }
  };

  const handleDelete = (id: string) => {
    confirmAction(
      "Delete Code",
      "Are you sure you want to delete this discount code?",
      async () => {
        const { error } = await supabase.from('discount_codes').delete().eq('id', id);
        if (error) {
          toast.error(`Failed to delete: ${error.message}`);
        } else {
          toast.success("Code deleted.");
          fetchCodes();
        }
      },
      { destructive: true }
    );
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard!");
  };

  const searchStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    try {
      const { data: students, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
        .eq('role', 'student')
        .limit(1);

      if (error) throw error;

      if (!students || students.length === 0) {
        toast.error("Student not found");
        setFoundStudent(null);
      } else {
        setFoundStudent(students[0]);
      }
    } catch (err: any) {
      toast.error(`Search failed: ${err.message}`);
    }
    setSearching(false);
  };

  const grantScholarship = async () => {
    if (!foundStudent) return;
    
    confirmAction(
      "Grant Scholarship Access",
      `Are you sure you want to grant free lifetime access to ${foundStudent.full_name}?`,
      async () => {
        try {
          const { error } = await supabase.from('subscriptions').insert({
            user_id: foundStudent.id,
            plan_id: 'lifetime',
            status: 'active',
            start_date: new Date().toISOString(),
          });
          
          if (error) throw error;
          
          toast.success(`Access granted to ${foundStudent.full_name}!`);
          setFoundStudent(null);
          setSearchTerm('');
        } catch (err: any) {
          toast.error(`Failed to grant access: ${err.message}`);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary shrink-0" /> Scholarships & Discounts
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">Manage promotional codes and direct scholarship grants.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Direct Scholarship Grant */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-purple-400" /> Direct Scholarship Grant</CardTitle>
            <CardDescription className="text-slate-400">Find a student and instantly grant them free premium access.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={searchStudent} className="flex gap-2 mb-4">
              <Input 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder="Search by name or email..." 
                className="bg-slate-950 border-slate-800"
              />
              <Button type="submit" disabled={searching} className="bg-slate-800 hover:bg-slate-700">
                <Search className="w-4 h-4" />
              </Button>
            </form>

            {foundStudent && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
                <div>
                  <div className="font-bold">{foundStudent.full_name}</div>
                  <div className="text-xs text-slate-400">{foundStudent.email}</div>
                </div>
                <Button onClick={grantScholarship} className="bg-purple-600 hover:bg-purple-700">
                  Grant Access
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Discount Code */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Percent className="w-5 h-5 text-green-400" /> Discount Codes</CardTitle>
              <CardDescription className="text-slate-400">Generate codes for marketing campaigns.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsFormOpen(!isFormOpen)} className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-1" /> New Code
            </Button>
          </CardHeader>
          <CardContent>
            {isFormOpen && (
              <form onSubmit={handleCreateCode} className="space-y-4 p-4 bg-slate-950 border border-slate-800 rounded-lg mb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code (e.g. JAMB2025)</label>
                  <Input 
                    value={codeName} 
                    onChange={(e) => setCodeName(e.target.value.toUpperCase())} 
                    className="bg-slate-900 border-slate-700 font-mono"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <select 
                      value={discountType} 
                      onChange={(e) => setDiscountType(e.target.value)} 
                      className="w-full h-10 bg-slate-900 border border-slate-700 rounded-md px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat Amount (₦)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Value</label>
                    <Input 
                      type="number"
                      value={discountValue} 
                      onChange={(e) => setDiscountValue(Number(e.target.value))} 
                      className="bg-slate-900 border-slate-700"
                      min="1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max Uses</label>
                    <Input 
                      type="number"
                      value={maxUses} 
                      onChange={(e) => setMaxUses(Number(e.target.value))} 
                      className="bg-slate-900 border-slate-700"
                      min="1"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)} className="text-slate-400">Cancel</Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90">Create Code</Button>
                </div>
              </form>
            )}

            {/* Code List */}
            {loading ? (
              <div className="text-center py-4 text-slate-500">Loading codes...</div>
            ) : codes.length === 0 ? (
              <div className="text-center py-6 text-slate-500 italic">No discount codes active.</div>
            ) : (
              <div className="space-y-3">
                {codes.map(code => (
                  <div key={code.id} className="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary tracking-wider">{code.code}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-white" onClick={() => copyCode(code.code)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {code.discount_type === 'percentage' ? `${code.discount_value}% OFF` : `₦${code.discount_value} OFF`} 
                        <span className="mx-2">•</span> 
                        {code.times_used} / {code.max_uses} used
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-950" onClick={() => handleDelete(code.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
