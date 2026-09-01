import { useState } from 'react';
import { Sparkles, Brain, Key } from 'lucide-react';
import { AdminAITab } from './AdminAITab';
import { AIPromptStudioTab } from './AIPromptStudioTab';
import { AIKeysTab } from './AIKeysTab';

type SubView = 'assistants' | 'prompt-studio' | 'keys';

export function AICommandCenterTab() {
  const [activeTab, setActiveTab] = useState<SubView>('assistants');

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Sub-Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-primary" /> AI Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure AI Assistants, prompt engineering studio, model parameters, and API provider keys.
          </p>
        </div>

        {/* Sub-Tabs Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab('assistants')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'assistants'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Sparkles className="w-4 h-4" /> AI Assistants & Models
          </button>
          <button
            onClick={() => setActiveTab('prompt-studio')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'prompt-studio'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Brain className="w-4 h-4" /> Prompt Studio
          </button>
          <button
            onClick={() => setActiveTab('keys')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'keys'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Key className="w-4 h-4" /> Provider Keys & Secrets
          </button>
        </div>
      </div>

      {/* Render Active Sub-Module */}
      <div className="min-w-0 w-full">
        {activeTab === 'assistants' && <AdminAITab />}
        {activeTab === 'prompt-studio' && <AIPromptStudioTab />}
        {activeTab === 'keys' && <AIKeysTab />}
      </div>
    </div>
  );
}
