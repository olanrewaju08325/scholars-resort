import { useState } from 'react';
import { FileQuestion, Image, Sparkles } from 'lucide-react';
import { QuestionBankTab } from './QuestionBankTab';
import { ImageQuestionManagerTab } from './ImageQuestionManagerTab';
import { ContentStudioTab } from './ContentStudioTab';

type SubView = 'questions' | 'image-questions' | 'content-studio';

export function QuestionBankContentStudioTab() {
  const [activeTab, setActiveTab] = useState<SubView>('questions');

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Navigation Sub-Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <FileQuestion className="w-7 h-7 text-primary" /> Question Bank & Content Studio
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage canonical question inventory, diagrams & images, and AI generation studio.
          </p>
        </div>

        {/* Sub-Tabs Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'questions'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <FileQuestion className="w-4 h-4" /> Question Inventory
          </button>
          <button
            onClick={() => setActiveTab('image-questions')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'image-questions'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Image className="w-4 h-4" /> Diagrams & Images
          </button>
          <button
            onClick={() => setActiveTab('content-studio')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'content-studio'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Sparkles className="w-4 h-4" /> AI Content Studio
          </button>
        </div>
      </div>

      {/* Render Active Sub-Module */}
      <div className="min-w-0 w-full">
        {activeTab === 'questions' && <QuestionBankTab />}
        {activeTab === 'image-questions' && <ImageQuestionManagerTab />}
        {activeTab === 'content-studio' && <ContentStudioTab />}
      </div>
    </div>
  );
}
