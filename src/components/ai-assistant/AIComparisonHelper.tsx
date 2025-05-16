
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';

export const AIComparisonHelper: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed top-2 left-0 right-0 z-50 flex justify-center gap-2 px-4">
      <Button 
        className="bg-blue-500 hover:bg-blue-600"
        onClick={() => navigate('/assistant')}
      >
        View Page Component
      </Button>
      <Button 
        className="bg-green-500 hover:bg-green-600"
        onClick={() => navigate('/ai-test')}
      >
        View Inner Component
      </Button>
    </div>
  );
};
