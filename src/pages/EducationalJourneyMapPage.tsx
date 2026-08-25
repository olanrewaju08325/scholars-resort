import React from 'react';
import { EducationalJourneyMap } from '@/components/journey/EducationalJourneyMap';

export const EducationalJourneyMapPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      <EducationalJourneyMap />
    </div>
  );
};

export default EducationalJourneyMapPage;
