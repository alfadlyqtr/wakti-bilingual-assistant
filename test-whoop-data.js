// Quick test to see what WHOOP data we're actually pulling
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hxauxozopvpzpdygoqwf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWhoopData() {
  console.log('🔍 TESTING WHOOP DATA EXTRACTION...\n');
  
  // Test sleep data
  const { data: sleepData, error: sleepError } = await supabase
    .from('whoop_sleep')
    .select('*')
    .limit(1);
    
  console.log('💤 SLEEP DATA SAMPLE:');
  console.log('Fields available:', sleepData?.[0] ? Object.keys(sleepData[0]) : 'No data');
  console.log('Sample data:', JSON.stringify(sleepData?.[0], null, 2));
  console.log('Error:', sleepError);
  
  // Test recovery data
  const { data: recoveryData, error: recoveryError } = await supabase
    .from('whoop_recovery')
    .select('*')
    .limit(1);
    
  console.log('\n❤️ RECOVERY DATA SAMPLE:');
  console.log('Fields available:', recoveryData?.[0] ? Object.keys(recoveryData[0]) : 'No data');
  console.log('Sample data:', JSON.stringify(recoveryData?.[0], null, 2));
  console.log('Error:', recoveryError);
  
  // Test workout data
  const { data: workoutData, error: workoutError } = await supabase
    .from('whoop_workouts')
    .select('*')
    .limit(1);
    
  console.log('\n🏋️ WORKOUT DATA SAMPLE:');
  console.log('Fields available:', workoutData?.[0] ? Object.keys(workoutData[0]) : 'No data');
  console.log('Sample data:', JSON.stringify(workoutData?.[0], null, 2));
  console.log('Error:', workoutError);
  
  // Test cycle data
  const { data: cycleData, error: cycleError } = await supabase
    .from('whoop_cycles')
    .select('*')
    .limit(1);
    
  console.log('\n🔄 CYCLE DATA SAMPLE:');
  console.log('Fields available:', cycleData?.[0] ? Object.keys(cycleData[0]) : 'No data');
  console.log('Sample data:', JSON.stringify(cycleData?.[0], null, 2));
  console.log('Error:', cycleError);
}

testWhoopData().catch(console.error);
