import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine
} from 'recharts';
import { 
  BookOpen, BarChart3, Download, Search, AlertTriangle, CheckCircle2, 
  RefreshCw, TrendingUp, Layers, Sparkles, Filter, Database, ArrowUpDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OFFICIAL_JAMB_SUBJECTS, normalizeSubjectName } from '@/utils/subjectUtils';
import { toast } from 'sonner';

export interface SubjectCoverageItem {
  id: string;
  name: string;
  category: 'Sciences' | 'Arts & Humanities' | 'Commercial / Social Sciences' | 'General';
  currentCount: number;
  targetStandard: number; // Scholars Resort target (e.g. 400 or 600)
  coveragePercentage: number;
  status: 'optimal' | 'moderate' | 'critical'; // optimal: >=100%, moderate: >=50%, critical: <50%
  deficit: number;
}

export const SubjectCoverageDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [subjectsData, setSubjectsData] = useState<SubjectCoverageItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'count' | 'coverage' | 'name'>('count');
  const [sortAsc, setSortAsc] = useState(false);

  // Scholars Resort Target Standard:
  // English: 600 questions
  // Core Sciences/Math: 400 questions
  // Others: 300 questions
  const getTargetForSubject = (name: string): number => {
    const canonical = normalizeSubjectName(name).toLowerCase();
    if (canonical.includes('english')) return 600;
    if (['mathematics', 'physics', 'chemistry', 'biology'].includes(canonical)) return 400;
    return 300;
  };

  const getCategoryForSubject = (name: string): SubjectCoverageItem['category'] => {
    const canonical = normalizeSubjectName(name).toLowerCase();
    if (canonical.includes('english')) return 'General';
    if (['mathematics', 'physics', 'chemistry', 'biology', 'agricultural science', 'computer studies'].includes(canonical)) return 'Sciences';
    if (['economics', 'commerce', 'accounting', 'principles of accounts', 'geography', 'government'].includes(canonical)) return 'Commercial / Social Sciences';
    return 'Arts & Humanities';
  };

  const fetchCoverage = async () => {
    setLoading(true);
    try {
      // 1. Fetch all subjects
      const { data: dbSubjects } = await supabase.from('subjects').select('id, name, is_active').order('name');
      const subjectsList = dbSubjects || [];

      // 2. Fetch question distribution grouped by subject
      const { data: qData } = await supabase
        .from('questions')
        .select('subject_id')
        .limit(20000);

      const countsMap: Record<string, number> = {};
      subjectsList.forEach(s => {
        countsMap[s.id] = 0;
      });

      if (qData) {
        qData.forEach((q: any) => {
          if (q.subject_id && countsMap[q.subject_id] !== undefined) {
            countsMap[q.subject_id] += 1;
          }
        });
      }

      // Also ensure all official subjects are represented
      const combinedMap = new Map<string, SubjectCoverageItem>();

      subjectsList.forEach(s => {
        const target = getTargetForSubject(s.name);
        const count = countsMap[s.id] || 0;
        const coverage = Math.min(100, Math.round((count / target) * 100));
        let status: SubjectCoverageItem['status'] = 'critical';
        if (coverage >= 90) status = 'optimal';
        else if (coverage >= 40) status = 'moderate';

        combinedMap.set(normalizeSubjectName(s.name), {
          id: s.id,
          name: s.name,
          category: getCategoryForSubject(s.name),
          currentCount: count,
          targetStandard: target,
          coveragePercentage: coverage,
          status,
          deficit: Math.max(0, target - count)
        });
      });

      // Add any missing official subjects with 0 count
      OFFICIAL_JAMB_SUBJECTS.forEach(official => {
        const canonical = normalizeSubjectName(official.name);
        if (!combinedMap.has(canonical)) {
          const target = getTargetForSubject(official.name);
          combinedMap.set(canonical, {
            id: `missing_${official.name}`,
            name: official.name,
            category: getCategoryForSubject(official.name),
            currentCount: 0,
            targetStandard: target,
            coveragePercentage: 0,
            status: 'critical',
            deficit: target
          });
        }
      });

      setSubjectsData(Array.from(combinedMap.values()));
    } catch (err: any) {
      toast.error(`Failed loading subject coverage: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoverage();
  }, []);

  // Filtering and sorting
  const filteredSubjects = useMemo(() => {
    return subjectsData
      .filter(item => {
        const matchesSearch = String(item.name || '').toLowerCase().includes(String(searchQuery || '').toLowerCase());
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'count') diff = b.currentCount - a.currentCount;
        else if (sortBy === 'coverage') diff = b.coveragePercentage - a.coveragePercentage;
        else diff = a.name.localeCompare(b.name);
        return sortAsc ? -diff : diff;
      });
  }, [subjectsData, searchQuery, selectedCategory, sortBy, sortAsc]);

  // Aggregate stats
  const totalInDb = useMemo(() => subjectsData.reduce((a, b) => a + b.currentCount, 0), [subjectsData]);
  const totalTarget = useMemo(() => subjectsData.reduce((a, b) => a + b.targetStandard, 0), [subjectsData]);
  const optimalCount = useMemo(() => subjectsData.filter(s => s.status === 'optimal').length, [subjectsData]);
  const criticalCount = useMemo(() => subjectsData.filter(s => s.status === 'critical').length, [subjectsData]);

  // Top 10 chart data
  const chartData = useMemo(() => {
    return filteredSubjects.slice(0, 12).map(s => ({
      name: s.name.length > 14 ? s.name.substring(0, 12) + '...' : s.name,
      fullName: s.name,
      count: s.currentCount,
      target: s.targetStandard,
      coverage: s.coveragePercentage,
      deficit: s.deficit
    }));
  }, [filteredSubjects]);

  const handleExportDeficitTemplate = () => {
    const deficitRows = subjectsData
      .filter(s => s.deficit > 0)
      .map(s => `"${s.name}","${s.category}",${s.currentCount},${s.targetStandard},${s.deficit}`);
    
    const csvContent = "data:text/csv;charset=utf-8," + 
      ["Subject Name,Category,Current Questions,Target Standard,Deficit Needed", ...deficitRows].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `scholars_resort_subject_deficits_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Downloaded Subject Deficit Action Plan CSV!");
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="p-5 rounded-2xl bg-card/70 border border-border/60 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Scholars Resort Subject Coverage Standard
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live visual audit of database questions per subject benchmarked against the official Scholars Resort UTME standard.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCoverage}
              disabled={loading}
              className="gap-1.5 h-9 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Distribution
            </Button>

            <Button
              size="sm"
              onClick={handleExportDeficitTemplate}
              className="gap-1.5 h-9 text-xs bg-primary text-primary-foreground font-semibold shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              Export Deficit CSV
            </Button>
          </div>
        </div>

        {/* Global Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/40">
          <div className="p-3 rounded-xl bg-background/80 border border-border/50">
            <span className="text-[11px] text-muted-foreground block">Total Bank Questions</span>
            <span className="font-mono text-lg font-bold text-foreground mt-0.5 block">
              {totalInDb.toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-background/80 border border-border/50">
            <span className="text-[11px] text-muted-foreground block">Overall Readiness Standard</span>
            <span className="font-mono text-lg font-bold text-primary mt-0.5 block">
              {totalTarget > 0 ? Math.round((totalInDb / totalTarget) * 100) : 0}% ({totalInDb}/{totalTarget})
            </span>
          </div>

          <div className="p-3 rounded-xl bg-background/80 border border-border/50">
            <span className="text-[11px] text-muted-foreground block">Optimal / Ready Subjects</span>
            <span className="font-mono text-lg font-bold text-emerald-400 mt-0.5 block">
              {optimalCount} Subjects
            </span>
          </div>

          <div className="p-3 rounded-xl bg-background/80 border border-border/50">
            <span className="text-[11px] text-muted-foreground block">Needs Content Import</span>
            <span className="font-mono text-lg font-bold text-rose-400 mt-0.5 block">
              {criticalCount} Deficit
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Recharts Distribution Visualizer */}
      <Card className="border-border/60 bg-card/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Live Question Distribution vs Scholars Resort Target
              </CardTitle>
              <CardDescription className="text-xs">
                Green bars indicate optimal bank coverage; Amber/Red indicates content import deficit.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-64 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  angle={-30} 
                  textAnchor="end" 
                  interval={0} 
                  tick={{ fontSize: 11, fill: '#94a3b8' }} 
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-background/95 border border-border shadow-xl text-xs space-y-1">
                          <span className="font-bold text-foreground block">{data.fullName}</span>
                          <div className="flex justify-between gap-3 text-muted-foreground">
                            <span>Available Questions:</span>
                            <span className="font-bold text-primary">{data.count}</span>
                          </div>
                          <div className="flex justify-between gap-3 text-muted-foreground">
                            <span>Scholars Standard:</span>
                            <span className="font-bold text-foreground">{data.target}</span>
                          </div>
                          <div className="flex justify-between gap-3 text-muted-foreground">
                            <span>Coverage:</span>
                            <span className={`font-bold ${data.coverage >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {data.coverage}%
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={400} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: 'Target: 400', fill: '#60a5fa', fontSize: 10 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => {
                    const color = entry.coverage >= 90 ? '#10b981' : entry.coverage >= 40 ? '#f59e0b' : '#ef4444';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subjects by name..."
            className="pl-9 h-9 text-xs bg-card/60"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-card/60 border border-border/50 p-1 rounded-lg">
            {['all', 'Sciences', 'Arts & Humanities', 'Commercial / Social Sciences'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  selectedCategory === cat ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat === 'all' ? 'All Categories' : cat.split(' ')[0]}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (sortBy === 'count') setSortBy('coverage');
              else if (sortBy === 'coverage') setSortBy('name');
              else setSortBy('count');
            }}
            className="h-9 text-xs gap-1"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort: <span className="capitalize font-bold">{sortBy}</span>
          </Button>
        </div>
      </div>

      {/* Detailed Subject Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredSubjects.map(sub => {
          return (
            <Card key={sub.id} className="border-border/50 bg-card/60 hover:border-border transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="text-sm font-bold text-foreground">{sub.name}</h5>
                    <span className="text-[11px] text-muted-foreground block">{sub.category}</span>
                  </div>

                  <Badge className={
                    sub.status === 'optimal' 
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]' 
                      : sub.status === 'moderate'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px]'
                  }>
                    {sub.coveragePercentage}% READINESS
                  </Badge>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">{sub.currentCount} / {sub.targetStandard} Qs</span>
                    {sub.deficit > 0 ? (
                      <span className="text-rose-400">-{sub.deficit} needed</span>
                    ) : (
                      <span className="text-emerald-400">Target Met ✓</span>
                    )}
                  </div>
                  <Progress value={sub.coveragePercentage} className="h-2" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
