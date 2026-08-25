import React from 'react';
import { AdaptiveLearningPathWidget } from '@/components/learningpath/AdaptiveLearningPathWidget';

export const AdaptiveLearningPathPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <AdaptiveLearningPathWidget />
    </div>
  );
};

export default AdaptiveLearningPathPage;
