import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-primary/30">
      <Navbar />
      <main className="flex-grow pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white">Terms of Service</h1>
            <p className="text-slate-400">Last Updated: August 2026</p>
          </div>
          
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-8 prose prose-invert max-w-none text-slate-300">
              <h2 className="text-xl font-bold text-white mt-6 mb-4">1. Acceptance of Terms</h2>
              <p>By accessing and using Scholars Resort, you accept and agree to be bound by the terms and provision of this agreement. In addition, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.</p>
              
              <h2 className="text-xl font-bold text-white mt-6 mb-4">2. Description of Service</h2>
              <p>Scholars Resort provides an online educational platform designed to prepare students for the JAMB UTME examination. This includes practice engines, AI tutors, and a digital library.</p>
              
              <h2 className="text-xl font-bold text-white mt-6 mb-4">3. User Registration</h2>
              <p>You may be required to register with the Site. You agree to keep your password confidential and will be responsible for all use of your account and password. We reserve the right to remove, reclaim, or change a username you select if we determine, in our sole discretion, that such username is inappropriate, obscene, or otherwise objectionable.</p>
              
              <h2 className="text-xl font-bold text-white mt-6 mb-4">4. Payment & Subscriptions</h2>
              <p>Access to premium features requires a subscription. Payments are verified manually by administrators. Refunds are subject to our discretion and are generally not provided for partially used subscription periods.</p>
              
              <h2 className="text-xl font-bold text-white mt-6 mb-4">5. Intellectual Property</h2>
              <p>All content included on the Site, such as text, graphics, logos, images, as well as the compilation thereof, and any software used on the Site, is the property of Scholars Resort or its suppliers and protected by copyright and other laws that protect intellectual property and proprietary rights.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
