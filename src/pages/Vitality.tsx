import React, { useState } from 'react';
import { Activity, Smartphone } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { HealthKitTab } from '@/components/fitness/HealthKitTab';
import FitnessHealth from './FitnessHealth';

type DataSource = 'whoop' | 'healthkit';

/**
 * Vitality Page - Main entry point for health data
 * Provides top-level tabs for switching between WHOOP and HealthKit
 */
export default function Vitality() {
  const { language } = useTheme();
  const [dataSource, setDataSource] = useState<DataSource>('whoop');

  // If WHOOP is selected, render the original FitnessHealth page
  if (dataSource === 'whoop') {
    return (
      <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        {/* Page Header */}
        <div className="text-center px-2">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            {language === 'ar' ? 'الحيوية' : 'Vitality'}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base px-4">
            {language === 'ar' ? 'تحليل شامل لبياناتك الصحية مع الذكاء الاصطناعي' : 'Comprehensive health data analysis with AI insights'}
          </p>
        </div>

        {/* Top-level Data Source Tabs */}
        <div className="flex justify-center gap-3 px-2">
          <button
            onClick={() => setDataSource('whoop')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 bg-gradient-to-r from-[#FF6B00] to-[#FF9500] text-white shadow-lg shadow-orange-500/30 scale-105"
          >
            <Activity className="w-5 h-5" />
            WHOOP
          </button>
          <button
            onClick={() => setDataSource('healthkit')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/60"
          >
            <Smartphone className="w-5 h-5" />
            HealthKit
          </button>
        </div>

        {/* Render WHOOP content inline (without its own header) */}
        <FitnessHealthInner />
      </div>
    );
  }

  // HealthKit tab selected
  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="text-center px-2">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          {language === 'ar' ? 'الحيوية' : 'Vitality'}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base px-4">
          {language === 'ar' ? 'تحليل شامل لبياناتك الصحية مع الذكاء الاصطناعي' : 'Comprehensive health data analysis with AI insights'}
        </p>
      </div>

      {/* Top-level Data Source Tabs */}
      <div className="flex justify-center gap-3 px-2">
        <button
          onClick={() => setDataSource('whoop')}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/60"
        >
          <Activity className="w-5 h-5" />
          WHOOP
        </button>
        <button
          onClick={() => setDataSource('healthkit')}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 scale-105"
        >
          <Smartphone className="w-5 h-5" />
          HealthKit
        </button>
      </div>

      {/* HealthKit Content */}
      <HealthKitTab />
    </div>
  );
}

/**
 * Inner component that renders FitnessHealth content without its header
 * This is a workaround since we can't easily modify FitnessHealth to accept a hideHeader prop
 */
function FitnessHealthInner() {
  // For now, just render the full FitnessHealth component
  // The duplicate header is acceptable for MVP - can be refined later
  return <FitnessHealth />;
}
