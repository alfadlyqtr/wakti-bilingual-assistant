
import React from 'react';
import { useParams } from 'react-router-dom';
import EventView from '@/components/events/EventView';

export default function StandaloneEventPage() {
  return (
    <div className="min-h-screen bg-background">
      <EventView standalone={true} />
    </div>
  );
}
