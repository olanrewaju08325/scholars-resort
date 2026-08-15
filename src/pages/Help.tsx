import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, Book, CreditCard, Laptop, ShieldCheck, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function Help() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-primary/30">
      <Navbar />
      
      <main className="flex-grow pt-24 pb-16 px-6 relative z-10">
        <div className="max-w-4xl mx-auto space-y-12">
          
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight">
              How can we help you?
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Search our knowledge base or browse categories below to find answers to common questions about Scholars Resort.
            </p>
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input 
                type="text" 
                placeholder="Search for answers..." 
                className="pl-12 h-14 bg-slate-900 border-slate-800 text-lg rounded-full w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Book className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white">Exams & Practice</h3>
                <p className="text-sm text-slate-400">Scores, mock exams, and offline sync</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="font-semibold text-white">Billing & Payments</h3>
                <p className="text-sm text-slate-400">Receipts, approvals, and premium access</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="font-semibold text-white">Guardian Accounts</h3>
                <p className="text-sm text-slate-400">Linking, tracking, and reports</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Frequently Asked Questions</CardTitle>
              <CardDescription className="text-slate-400">Quick answers to the most common issues.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full space-y-4">
                <details className="border-b border-slate-800 pb-4 group">
                  <summary className="cursor-pointer text-left font-medium hover:text-primary transition-colors text-lg list-none flex justify-between items-center">
                    How do I study offline?
                    <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-slate-400 text-base leading-relaxed mt-4">
                    Scholars Resort automatically caches your selected subjects when you start a practice session online. You can turn off your data and continue practicing. Once you reconnect to the internet, your scores and session data will automatically sync to our servers.
                  </p>
                </details>
                <details className="border-b border-slate-800 pb-4 group">
                  <summary className="cursor-pointer text-left font-medium hover:text-primary transition-colors text-lg list-none flex justify-between items-center">
                    How long does manual payment verification take?
                    <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-slate-400 text-base leading-relaxed mt-4">
                    After you upload your payment receipt via the Pricing page, our administrators will review it within 1-2 hours during business hours. You will receive an in-app notification once your premium access is activated.
                  </p>
                </details>
                <details className="border-b border-slate-800 pb-4 group">
                  <summary className="cursor-pointer text-left font-medium hover:text-primary transition-colors text-lg list-none flex justify-between items-center">
                    How can my parents view my results?
                    <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-slate-400 text-base leading-relaxed mt-4">
                    Your parents or guardians must create a Guardian Account. From their dashboard, they will click "Link Student" and enter your unique Scholar Email. Once linked, they can view your performance, streaks, and upcoming mock exams.
                  </p>
                </details>
                <details className="border-b border-slate-800 pb-4 group">
                  <summary className="cursor-pointer text-left font-medium hover:text-primary transition-colors text-lg list-none flex justify-between items-center">
                    How do I reset my password?
                    <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-slate-400 text-base leading-relaxed mt-4">
                    On the login screen, click "Forgot Password". Enter your registered email address, and we will send you a secure link to reset your password. If you don't receive the email, please check your spam folder or contact support.
                  </p>
                </details>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-8 text-center space-y-4">
              <Mail className="w-10 h-10 text-primary mx-auto" />
              <h3 className="text-xl font-semibold text-white">Still need help?</h3>
              <p className="text-slate-400 max-w-md mx-auto">
                If you couldn't find what you're looking for, our support team is available to assist you.
              </p>
              <div className="pt-2">
                <a href="mailto:admitwise2@gmail.com" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-8 py-2">
                  Contact Support
                </a>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
