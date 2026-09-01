import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, Book, CreditCard, ShieldCheck, Mail, MessageSquare, ArrowRight, BatteryCharging, Zap, Smartphone, Moon, WifiOff, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';

const FAQS = [
  {
    category: 'exams',
    question: 'How do I study offline?',
    answer: 'Scholars Resort automatically caches your selected subjects when you start a practice session online. You can turn off your internet data and continue practicing. Once you reconnect to the internet, your scores and session data will automatically sync to our servers.'
  },
  {
    category: 'billing',
    question: 'How long does manual payment verification take?',
    answer: 'After you upload your payment receipt via the Pricing page, our administrators review and activate your account within 5-15 minutes during operating hours. You will receive an in-app notice and an email confirmation at admitwise2@gmail.com.'
  },
  {
    category: 'ai_tutor',
    question: 'How does the AI Tutor work?',
    answer: 'The AI Smart Tutor provides 24/7 step-by-step problem resolution, customized weak-topic drills, and automated study plan recommendations based on your performance analytics.'
  },
  {
    category: 'billing',
    question: 'What are the payment terms and conditions?',
    answer: 'Payment is a one-time ₦3,000 fee for lifetime full access to all subjects, CBT mocks, AI tutor, and novel breakdown. Ensure you use your registered email/name in the transfer narration to Moniepoint MCB (9032517376 - Olamide Olanrewaju Abdulmuiz). Fees are non-refundable once account access is granted.'
  },
  {
    category: 'exams',
    question: 'How does the JAMB 8-button calculator work?',
    answer: 'Our CBT simulator replicates the exact 8-button calculator used in official UTME exams (+, -, *, /, C, ., =, sqrt). Keyboard shortcuts A, B, C, D are enabled for quick answer selection, N for Next, P for Previous, and S for Submit.'
  }
];

export default function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredFaqs = FAQS.filter(faq => {
    const matchesCategory = !activeCategory || faq.category === activeCategory;
    const matchesSearch = !searchQuery || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <Navbar />
      
      <main className="flex-grow pt-24 pb-16 px-6 relative z-10">
        <div className="max-w-4xl mx-auto space-y-10">
          
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground tracking-tight">
              How can we help you?
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Search our knowledge base or browse categories below to find instant answers regarding Scholars Resort.
            </p>
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for answers (e.g. offline, payment, calculator)..." 
                className="pl-12 h-14 bg-card border-border text-foreground text-base rounded-full w-full shadow-sm focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Interactive Category Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card 
              onClick={() => setActiveCategory(activeCategory === 'exams' ? null : 'exams')}
              className={`border transition-all cursor-pointer shadow-md ${
                activeCategory === 'exams' 
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30' 
                  : 'bg-card text-card-foreground border-border hover:border-primary/50'
              }`}
            >
              <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <Book className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="font-bold text-foreground text-base">Exams & Practice</h3>
                <p className="text-xs text-muted-foreground">CBT simulator, 8-button calculator, and offline sync</p>
              </CardContent>
            </Card>

            <Card 
              onClick={() => setActiveCategory(activeCategory === 'billing' ? null : 'billing')}
              className={`border transition-all cursor-pointer shadow-md ${
                activeCategory === 'billing' 
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30' 
                  : 'bg-card text-card-foreground border-border hover:border-primary/50'
              }`}
            >
              <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-green-500" />
                </div>
                <h3 className="font-bold text-foreground text-base">Billing & Payments</h3>
                <p className="text-xs text-muted-foreground">Receipt uploads, terms, and account activation</p>
              </CardContent>
            </Card>

            <Card 
              onClick={() => setActiveCategory(activeCategory === 'ai_tutor' ? null : 'ai_tutor')}
              className={`border transition-all cursor-pointer shadow-md ${
                activeCategory === 'ai_tutor' 
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30' 
                  : 'bg-card text-card-foreground border-border hover:border-primary/50'
              }`}
            >
              <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-purple-500" />
                </div>
                <h3 className="font-bold text-foreground text-base">AI Tutor & Study Tools</h3>
                <p className="text-xs text-muted-foreground">Step-by-step explanations, study plans, and weak topic drills</p>
              </CardContent>
            </Card>
          </div>

          {/* FAQs List */}
          <Card className="bg-card text-card-foreground border-border shadow-lg">
            <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold font-display text-foreground">Frequently Asked Questions</CardTitle>
                <CardDescription className="text-muted-foreground">Click any question below to reveal detailed answer.</CardDescription>
              </div>
              {activeCategory && (
                <button 
                  onClick={() => setActiveCategory(null)}
                  className="text-xs font-bold text-primary hover:underline bg-primary/10 px-3 py-1.5 rounded-lg"
                >
                  Show All FAQS
                </button>
              )}
            </CardHeader>
            <CardContent className="p-6">
              <div className="w-full space-y-4">
                {filteredFaqs.length > 0 ? (
                  filteredFaqs.map((faq, index) => (
                    <details key={index} className="border-b border-border pb-4 group">
                      <summary className="cursor-pointer text-left font-bold text-foreground hover:text-primary transition-colors text-base list-none flex justify-between items-center py-2">
                        {faq.question}
                        <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <p className="text-muted-foreground text-sm leading-relaxed mt-2 p-4 rounded-xl bg-muted/30 border border-border">
                        {faq.answer}
                      </p>
                    </details>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground space-y-2">
                    <p className="font-bold text-foreground">No matching FAQ found for "{searchQuery}".</p>
                    <p className="text-xs">Try searching for keywords like "payment", "offline", or "calculator".</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Battery Saver Pro-Tips Section */}
          <Card className="bg-card text-card-foreground border-amber-500/30 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <BatteryCharging className="w-48 h-48 text-amber-500" />
            </div>
            <CardHeader className="border-b border-border bg-amber-500/5 flex flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl md:text-2xl font-bold font-display text-foreground flex items-center gap-2">
                  Battery Saver Pro-Tips for Offline Mode
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Maximize your phone or tablet's battery life during 2-hour CBT mock sessions in Airplane mode.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <WifiOff className="w-4 h-4 text-emerald-500" /> 1. Turn On Airplane Mode
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Disabling Cellular Data, Wi-Fi, and Bluetooth stops radio antenna power spikes, extending battery life by up to 45% during intensive study sessions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Moon className="w-4 h-4 text-purple-500" /> 2. Enable Scholars Resort Dark Mode
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  On OLED / AMOLED smartphone screens, dark theme turns off individual screen pixels, reducing display energy draw while preventing eye fatigue.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Smartphone className="w-4 h-4 text-amber-500" /> 3. Lower Display Brightness (30-50%)
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Screen backlighting is the #1 power consumer on mobile devices. Lowering brightness to a comfortable indoor level significantly conserves energy.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" /> 4. Pre-Download Subject Packs First
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Download all subject packs from the <strong>Offline Packs</strong> tab beforehand so zero network requests are needed while answering practice questions.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Support Banner */}
          <Card className="bg-gradient-to-r from-primary/15 via-indigo-950/20 to-purple-950/15 border border-primary/30 shadow-xl">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-extrabold font-display text-foreground">Still need assistance?</h3>
              <p className="text-muted-foreground max-w-md mx-auto text-sm">
                Our team is ready to assist with account activation, technical questions, or payment verification.
              </p>
              <div className="flex justify-center gap-4 pt-2 flex-wrap">
                <a 
                  href="mailto:admitwise2@gmail.com" 
                  className="inline-flex items-center gap-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 h-11 px-6 transition-all"
                >
                  <Mail className="w-4 h-4" /> Email admitwise2@gmail.com
                </a>
                <Link 
                  to="/support" 
                  className="inline-flex items-center gap-2 rounded-xl text-sm font-bold border border-border bg-card text-foreground hover:bg-muted h-11 px-6 transition-all"
                >
                  <MessageSquare className="w-4 h-4 text-primary" /> Open Support Ticket <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
