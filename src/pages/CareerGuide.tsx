import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Compass, BookOpen, GraduationCap, Target, CheckSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useLiveFetch } from '@/hooks/useLiveFetch';
import { DataLoading } from '@/components/DataLoading';

// Mock static data for V2
const CAREER_DATA = [
  {
    category: 'Medical & Health Sciences',
    courses: [
      { name: 'Medicine and Surgery', subjects: ['English', 'Biology', 'Chemistry', 'Physics'], requirements: '5 O\'Level credits including Math & English' },
      { name: 'Nursing Science', subjects: ['English', 'Biology', 'Chemistry', 'Physics'], requirements: '5 O\'Level credits including Math & English' },
      { name: 'Pharmacy', subjects: ['English', 'Biology', 'Chemistry', 'Physics'], requirements: '5 O\'Level credits including Math & English' },
    ]
  },
  {
    category: 'Engineering & Technology',
    courses: [
      { name: 'Computer Science', subjects: ['English', 'Mathematics', 'Physics', 'Chemistry'], requirements: '5 O\'Level credits including Math & English' },
      { name: 'Mechanical Engineering', subjects: ['English', 'Mathematics', 'Physics', 'Chemistry'], requirements: '5 O\'Level credits including Math & English' },
      { name: 'Electrical Engineering', subjects: ['English', 'Mathematics', 'Physics', 'Chemistry'], requirements: '5 O\'Level credits including Math & English' },
    ]
  },
  {
    category: 'Arts & Humanities',
    courses: [
      { name: 'Law', subjects: ['English', 'Literature in English', 'Government', 'CRS/IRS'], requirements: '5 O\'Level credits including Lit & English' },
      { name: 'Mass Communication', subjects: ['English', 'Literature in English', 'Government', 'Any other Arts/Social Science'], requirements: '5 O\'Level credits including Math & English' },
    ]
  },
  {
    category: 'Social & Management Sciences',
    courses: [
      { name: 'Accounting', subjects: ['English', 'Mathematics', 'Economics', 'Government/Commerce'], requirements: '5 O\'Level credits including Math, English & Economics' },
      { name: 'Economics', subjects: ['English', 'Mathematics', 'Economics', 'Government'], requirements: '5 O\'Level credits including Math, English & Economics' },
    ]
  }
];

const CareerGuide = () => {
  const [activeView, setActiveView] = useState<'guide' | 'syllabus'>('guide');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Live syllabus state loaded from Supabase topics via useLiveFetch
  const { data: rawSyllabus, loading: loadingSyllabus } = useLiveFetch<any[]>(
    async () => {
      const { data, error } = await supabase
        .from('topics')
        .select('id, name, subject_id, subjects(name)')
        .limit(15);
      if (error) throw error;
      return data || [];
    },
    { contextName: 'CareerGuideSyllabus', fallbackData: [] }
  );

  const [localChecked, setLocalChecked] = useState<Record<string, boolean>>({});

  const toggleSyllabusItem = (id: string) => {
    setLocalChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const syllabus = (rawSyllabus || []).map((t: any) => ({
    id: t.id || t.name,
    topic: t.name || 'Core Topic',
    subject: t.subjects?.name || 'General',
    done: !!localChecked[t.id || t.name]
  }));

  const filteredData = CAREER_DATA.map(category => ({
    ...category,
    courses: category.courses.filter(course => 
      course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.subjects.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  })).filter(category => category.courses.length > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
        <Link to="/dashboard" className="flex items-center gap-2 text-xl font-bold font-display">
          <img src="/scholar.jpg" alt="Scholars Resort Logo" className="h-6 w-6 rounded-sm object-cover" />
          <span>Scholars Resort</span>
        </Link>
        <nav className="flex gap-4">
          <Button variant="ghost" asChild>
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full">
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Compass className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-4">Career Guide & School Finder</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Discover the exact JAMB subject combinations and O'Level requirements needed for your dream course across Nigerian Universities.
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-8">
           <Button variant={activeView === 'guide' ? 'default' : 'outline'} onClick={() => setActiveView('guide')} className="gap-2">
             <Target className="w-4 h-4" /> Course Matcher
           </Button>
           <Button variant={activeView === 'syllabus' ? 'default' : 'outline'} onClick={() => setActiveView('syllabus')} className="gap-2">
             <CheckSquare className="w-4 h-4" /> Syllabus Tracker
           </Button>
        </div>

        {activeView === 'guide' ? (
          <>
            <div className="relative max-w-2xl mx-auto mb-12">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search for a course (e.g., Law, Computer Science) or subject..."
                className="pl-10 h-14 text-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-12">
              {filteredData.length === 0 ? (
                <div className="text-center p-12 border border-dashed border-border rounded-lg text-muted-foreground">
                  No courses found matching "{searchTerm}". Try a different keyword.
                </div>
              ) : (
                filteredData.map((category, idx) => (
                  <div key={idx}>
                    <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-2 pb-2 border-b border-border/50">
                      <GraduationCap className="h-6 w-6 text-primary" />
                      {category.category}
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                      {category.courses.map((course, cIdx) => (
                        <Card key={cIdx} className="bg-card/40 border-border hover:border-primary/50 transition-colors">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-xl text-primary">{course.name}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                <BookOpen className="h-4 w-4" /> Required JAMB Subjects
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {course.subjects.map((sub, sIdx) => (
                                  <span key={sIdx} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="pt-3 border-t border-border/50">
                              <h4 className="text-sm font-semibold text-muted-foreground mb-1">O'Level Requirements</h4>
                              <p className="text-sm">{course.requirements}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
             <Card className="bg-card">
               <CardHeader>
                 <CardTitle>JAMB Syllabus Tracker</CardTitle>
                 <CardDescription>Tick off topics as you study to monitor your completion rate.</CardDescription>
               </CardHeader>
               <CardContent>
                 {loadingSyllabus ? (
                   <DataLoading message="Loading JAMB Syllabus..." subtext="Fetching core subjects and topics from Supabase..." />
                 ) : syllabus.length === 0 ? (
                   <div className="text-center py-12 text-muted-foreground">No syllabus topics found.</div>
                 ) : (
                   <div className="space-y-3">
                     {syllabus.map((item) => (
                       <div key={item.id} className="flex items-center gap-4 p-3 border border-border rounded-md hover:bg-muted/30 transition-colors">
                         <input 
                           type="checkbox" 
                           checked={item.done} 
                           onChange={() => toggleSyllabusItem(item.id)}
                           className="w-5 h-5 text-primary accent-primary cursor-pointer" 
                         />
                         <div>
                           <p className={`font-semibold ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.topic}</p>
                           <p className="text-xs text-muted-foreground uppercase">{item.subject}</p>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </CardContent>
             </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default CareerGuide;
