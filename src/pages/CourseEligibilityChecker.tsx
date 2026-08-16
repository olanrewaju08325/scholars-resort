import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, GraduationCap, CheckCircle2, AlertTriangle, BookOpen, Building2, HelpCircle, Sparkles } from 'lucide-react';

interface CourseData {
  course: string;
  category: string;
  jambSubjects: string[];
  olevelCredits: string[];
  universities: { name: string; cutoff: number }[];
  advice: string;
}

const COURSE_DATABASE: CourseData[] = [
  {
    course: "Medicine & Surgery",
    category: "Medical & Health Sciences",
    jambSubjects: ["Use of English", "Biology", "Chemistry", "Physics"],
    olevelCredits: ["English Language", "Mathematics", "Biology", "Chemistry", "Physics"],
    universities: [
      { name: "University of Lagos (UNILAG)", cutoff: 285 },
      { name: "University of Ibadan (UI)", cutoff: 290 },
      { name: "Obafemi Awolowo University (OAU)", cutoff: 280 },
      { name: "Ahmadu Bello University (ABU)", cutoff: 275 },
      { name: "University of Nigeria Nsukka (UNN)", cutoff: 282 },
    ],
    advice: "Must score 280+ in UTME. All 5 O'Level credits must be in one sitting for top federal universities."
  },
  {
    course: "Computer Science",
    category: "Sciences & Technology",
    jambSubjects: ["Use of English", "Mathematics", "Physics", "Chemistry or Economics or Biology"],
    olevelCredits: ["English Language", "Mathematics", "Physics", "Chemistry", "One other science subject"],
    universities: [
      { name: "University of Lagos (UNILAG)", cutoff: 260 },
      { name: "Federal University of Technology Akure (FUTA)", cutoff: 250 },
      { name: "University of Ibadan (UI)", cutoff: 265 },
      { name: "University of Ilorin (UNILORIN)", cutoff: 245 },
    ],
    advice: "Mathematics and Physics are non-negotiable JAMB requirements for Computer Science across all Nigerian universities."
  },
  {
    course: "Law (Common Law / Islamic Law)",
    category: "Law & Humanities",
    jambSubjects: ["Use of English", "Literature in English", "Government or History", "CRK/IRS or Economics"],
    olevelCredits: ["English Language", "Mathematics", "Literature in English", "Government/History", "One Arts/Social Science subject"],
    universities: [
      { name: "University of Lagos (UNILAG)", cutoff: 275 },
      { name: "University of Ibadan (UI)", cutoff: 280 },
      { name: "Lagos State University (LASU)", cutoff: 260 },
      { name: "Ahmadu Bello University (ABU)", cutoff: 255 },
    ],
    advice: "Literature in English is strictly compulsory for Law in JAMB and WAEC. Mathematics credit is required by JAMB."
  },
  {
    course: "Nursing Science",
    category: "Medical & Health Sciences",
    jambSubjects: ["Use of English", "Biology", "Chemistry", "Physics"],
    olevelCredits: ["English Language", "Mathematics", "Biology", "Chemistry", "Physics"],
    universities: [
      { name: "University of Ibadan (UI)", cutoff: 270 },
      { name: "Obafemi Awolowo University (OAU)", cutoff: 265 },
      { name: "University of Benin (UNIBEN)", cutoff: 258 },
    ],
    advice: "Highly competitive course. Target at least 260+ in UTME to guarantee admission."
  },
  {
    course: "Accounting & Finance",
    category: "Commercial & Management",
    jambSubjects: ["Use of English", "Mathematics", "Economics", "Commerce or Government or Accounting"],
    olevelCredits: ["English Language", "Mathematics", "Economics", "Financial Accounting or Commerce", "One Social Science subject"],
    universities: [
      { name: "University of Lagos (UNILAG)", cutoff: 250 },
      { name: "University of Benin (UNIBEN)", cutoff: 240 },
      { name: "University of Ilorin (UNILORIN)", cutoff: 235 },
    ],
    advice: "Mathematics and Economics are strictly mandatory in JAMB for Accounting."
  }
];

export const CourseEligibilityChecker = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<CourseData>(COURSE_DATABASE[0]);

  const filteredCourses = COURSE_DATABASE.filter(c =>
    c.course.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-8 rounded-2xl bg-gradient-to-r from-emerald-900/40 via-teal-900/30 to-blue-900/20 border border-emerald-500/30 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-slate-950 uppercase tracking-wider">
          <GraduationCap className="w-3.5 h-3.5" /> Official JAMB Brochure & Brochure Checker
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-foreground">
          JAMB Course Eligibility & O'Level Combination Checker
        </h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Verify your required 4 JAMB subjects, WAEC/NECO O'Level credit requirements, and university cut-off marks to prevent UTME subject disqualification.
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search & Course Selector */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3.5" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search course (e.g. Law, Medicine)..."
              className="pl-9 bg-card border-border"
            />
          </div>

          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {filteredCourses.map((item, idx) => (
              <Card
                key={idx}
                onClick={() => setSelectedCourse(item)}
                className={`cursor-pointer border transition-all ${
                  selectedCourse.course === item.course
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-md ring-1 ring-emerald-500/30'
                    : 'border-border bg-card hover:border-emerald-500/40'
                }`}
              >
                <CardContent className="p-4">
                  <p className="text-xs font-extrabold text-emerald-500 uppercase tracking-wider">{item.category}</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{item.course}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Requirements Detail Display */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card shadow-xl">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    {selectedCourse.category}
                  </span>
                  <CardTitle className="text-2xl font-bold font-display text-foreground mt-1">
                    {selectedCourse.course}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Mandatory 4 JAMB Subjects */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" /> Required 4 JAMB/UTME Subjects
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {selectedCourse.jambSubjects.map((sub, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-card border border-border text-center font-bold text-xs text-foreground shadow-sm">
                      {sub}
                    </div>
                  ))}
                </div>
              </div>

              {/* O'Level WAEC/NECO Credit Requirements */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Required O'Level Credit Passes (5 Minimum)
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedCourse.olevelCredits.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-semibold text-foreground bg-card p-2 rounded-lg border border-border">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Target Universities & Historic Cut-Off Marks */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-500 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> Historical University UTME Cut-off Marks
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedCourse.universities.map((u, i) => (
                    <div key={i} className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground truncate">{u.name}</span>
                      <span className="px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 font-extrabold text-xs shrink-0">
                        {u.cutoff}+ UTME
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expert Brochure Advice */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs space-y-1">
                <p className="font-extrabold flex items-center gap-1.5 uppercase">
                  <AlertTriangle className="w-4 h-4" /> Official Brochure Warning & Advice:
                </p>
                <p className="leading-relaxed font-medium">{selectedCourse.advice}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
