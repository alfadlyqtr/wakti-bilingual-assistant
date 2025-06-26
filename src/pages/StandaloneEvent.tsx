
import React from 'react';
import { useParams } from 'react-router-dom';
import EventView from '@/components/events/EventView';
import Maw3dEventView from '@/components/maw3d/Maw3dEventView';

export default function StandaloneEventPage() {
  const { id } = useParams();
  
  // Check if this is a Maw3d event (shortId starts with maw3d_)
  const isMaw3dEvent = id && id.startsWith('maw3d_');
  
  if (isMaw3dEvent) {
    // For Maw3d events, render the dedicated Maw3dEventView component
    return <Maw3dEventView standalone={true} />;
  }
  
  // For regular events, render the EventView component
  return (
    <div className="min-h-screen bg-background">
      <EventView standalone={true} />
    </div>
  );
}
