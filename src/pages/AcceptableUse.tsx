import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';

export default function AcceptableUse() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-primary/30">
      <Navbar />
      <main className="flex-grow pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white">Acceptable Use Policy</h1>
            <p className="text-slate-400">Last Updated: August 2026</p>
          </div>
          
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-8 prose prose-invert max-w-none text-slate-300">
              <h2 className="text-xl font-bold text-white mt-6 mb-4">1. Prohibited Activities</h2>
              <p>You may not access or use the Site for any purpose other than that for which we make the Site available. The Site may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.</p>
              
              <h2 className="text-xl font-bold text-white mt-6 mb-4">2. Account Sharing</h2>
              <p>Scholars Resort strictly prohibits account sharing. Your premium subscription is for your individual use only. The platform monitors active device sessions, and concurrent logins across multiple unauthorized devices may result in automatic account suspension.</p>
              
              <h2 className="text-xl font-bold text-white mt-6 mb-4">3. Content Scraping</h2>
              <p>Automated scraping, crawling, or downloading of the Question Bank, Mock Exams, or Digital Library materials is strictly forbidden. We actively monitor API usage and will permanently ban accounts found abusing our systems.</p>
              
              <h2 className="text-xl font-bold text-white mt-6 mb-4">4. Abuse of AI Tutor</h2>
              <p>The AI Tutor feature is designed for academic assistance. Using the AI Tutor to generate harmful, inappropriate, or non-academic content violates this policy and may lead to restricted access to AI features.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
