import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-primary/30">
      <Navbar />
      <main className="flex-grow pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white">Privacy Policy</h1>
            <p className="text-slate-400">Last Updated: August 2026</p>
          </div>
          
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-8 prose prose-invert max-w-none text-slate-300">
              <h2 className="text-xl font-bold text-white mt-6 mb-4">1. Information We Collect</h2>
              <p>We collect personal information that you voluntarily provide to us when you register on the Site, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Site, or otherwise when you contact us. This includes your name, email address, and academic preferences.</p>
              
              <h2 className="text-xl font-bold text-white mt-6 mb-4">2. How We Use Your Information</h2>
              <p>We use personal information collected via our Site for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.</p>
              <ul>
                <li>To facilitate account creation and logon process.</li>
                <li>To send administrative information to you.</li>
                <li>To fulfill and manage your subscription orders.</li>
                <li>To track academic progress and provide targeted AI recommendations.</li>
              </ul>
              
              <h2 className="text-xl font-bold text-white mt-6 mb-4">3. Data Sharing</h2>
              <p>We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations.</p>
              
              <h2 className="text-xl font-bold text-white mt-6 mb-4">4. Data Security</h2>
              <p>We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process, including Row Level Security (RLS) on our databases.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
