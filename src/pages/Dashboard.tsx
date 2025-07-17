
import React from 'react';
import { NavigationHeader } from '@/components/navigation/NavigationHeader';
import { WidgetGrid } from '@/components/dashboard/WidgetGrid';

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's an overview of your tasks and activities.</p>
        </div>
        <WidgetGrid 
          widgets={[]}
          isDragging={false}
          onDragEnd={() => {}}
        />
      </main>
    </div>
  );
};

export default Dashboard;
