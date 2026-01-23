import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Format date to ICS format (YYYYMMDDTHHMMSSZ)
function formatDateToICS(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Format date to ICS date only (YYYYMMDD)
function formatDateOnlyToICS(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

// Escape special characters for ICS
function escapeICS(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Generate a unique ID for events
function generateUID(id: string, type: string): string {
  return `${type}-${id}@wakti.app`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    const token = url.searchParams.get("token");

    console.log('Request received:', { userId, token });

    if (!userId || !token) {
      return new Response("Missing user_id or token", { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" }
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    console.log('Environment check:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!supabaseKey,
      urlLength: supabaseUrl?.length,
      keyLength: supabaseKey?.length
    });
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify token
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("calendar_feed_token")
      .eq("id", userId)
      .single();

    console.log('Profile lookup:', { 
      found: !!profile, 
      error: profileError,
      errorMessage: profileError?.message,
      errorDetails: profileError?.details,
      errorHint: profileError?.hint
    });

    if (profileError || !profile) {
      return new Response(JSON.stringify({
        error: "User not found",
        debug: {
          profileError: profileError?.message,
          details: profileError?.details,
          hint: profileError?.hint
        }
      }), { 
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log('Token comparison:', { 
      received: token,
      receivedLength: token?.length,
      stored: profile.calendar_feed_token,
      storedLength: profile.calendar_feed_token?.length,
      match: profile.calendar_feed_token === token 
    });

    if (profile.calendar_feed_token !== token) {
      return new Response(JSON.stringify({
        error: "Invalid token",
        debug: {
          receivedLength: token?.length,
          storedLength: profile.calendar_feed_token?.length,
          receivedFirst10: token?.substring(0, 10),
          storedFirst10: profile.calendar_feed_token?.substring(0, 10)
        }
      }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Fetch all calendar data
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    // Fetch tasks from tr_tasks table
    const { data: tasks } = await supabase
      .from("tr_tasks")
      .select("*")
      .eq("user_id", userId)
      .gte("due_date", threeMonthsAgo.toISOString())
      .lte("due_date", oneYearFromNow.toISOString());

    // Fetch reminders from tr_reminders table
    const { data: reminders } = await supabase
      .from("tr_reminders")
      .select("*")
      .eq("user_id", userId)
      .gte("due_date", threeMonthsAgo.toISOString())
      .lte("due_date", oneYearFromNow.toISOString());

    // Fetch maw3d events
    const { data: maw3dEvents } = await supabase
      .from("maw3d_events")
      .select("*")
      .eq("user_id", userId)
      .gte("event_date", threeMonthsAgo.toISOString().split('T')[0])
      .lte("event_date", oneYearFromNow.toISOString().split('T')[0]);

    // Fetch events from events table (uses organizer_id and start_time)
    const { data: manualEntries } = await supabase
      .from("events")
      .select("*")
      .eq("organizer_id", userId)
      .gte("start_time", threeMonthsAgo.toISOString())
      .lte("start_time", oneYearFromNow.toISOString());

    // Fetch journal entries
    const { data: journalEntries } = await supabase
      .from("journal_calendar_view")
      .select("*")
      .eq("user_id", userId);

    // Build ICS content
    const events: string[] = [];

    // Add tasks
    if (tasks) {
      for (const task of tasks) {
        if (!task.due_date) continue;
        const dueDate = new Date(task.due_date);
        const uid = generateUID(task.id, "task");
        
        events.push(`BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDateToICS(now)}
DTSTART:${formatDateOnlyToICS(dueDate)}
DTEND:${formatDateOnlyToICS(new Date(dueDate.getTime() + 24 * 60 * 60 * 1000))}
SUMMARY:${escapeICS(task.title || 'Task')}
DESCRIPTION:${escapeICS(task.description || '')}
STATUS:${task.status === 'completed' ? 'COMPLETED' : 'NEEDS-ACTION'}
CATEGORIES:TASK
END:VEVENT`);
      }
    }

    // Add reminders (tr_reminders uses due_date, not reminder_time)
    if (reminders) {
      for (const reminder of reminders) {
        if (!reminder.due_date) continue;
        const reminderTime = new Date(reminder.due_date);
        const uid = generateUID(reminder.id, "reminder");
        
        events.push(`BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDateToICS(now)}
DTSTART:${formatDateToICS(reminderTime)}
DTEND:${formatDateToICS(new Date(reminderTime.getTime() + 30 * 60 * 1000))}
SUMMARY:${escapeICS(reminder.title || 'Reminder')}
DESCRIPTION:${escapeICS(reminder.notes || '')}
CATEGORIES:REMINDER
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:${escapeICS(reminder.title || 'Reminder')}
TRIGGER:-PT0M
END:VALARM
END:VEVENT`);
      }
    }

    // Add maw3d events
    if (maw3dEvents) {
      for (const event of maw3dEvents) {
        if (!event.event_date) continue;
        const eventDate = new Date(event.event_date);
        const uid = generateUID(event.id, "maw3d");
        
        let dtStart = formatDateOnlyToICS(eventDate);
        let dtEnd = formatDateOnlyToICS(new Date(eventDate.getTime() + 24 * 60 * 60 * 1000));
        
        // If event has specific time
        if (event.start_time) {
          const [hours, minutes] = event.start_time.split(':');
          eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          dtStart = formatDateToICS(eventDate);
          
          if (event.end_time) {
            const endDate = new Date(event.event_date);
            const [endHours, endMinutes] = event.end_time.split(':');
            endDate.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);
            dtEnd = formatDateToICS(endDate);
          } else {
            dtEnd = formatDateToICS(new Date(eventDate.getTime() + 60 * 60 * 1000));
          }
        }
        
        events.push(`BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDateToICS(now)}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${escapeICS(event.title || 'Maw3d Event')}
DESCRIPTION:${escapeICS(event.description || '')}
LOCATION:${escapeICS(event.location || '')}
CATEGORIES:MAW3D
END:VEVENT`);
      }
    }

    // Add events from events table (uses start_time timestamp)
    if (manualEntries) {
      for (const entry of manualEntries) {
        if (!entry.start_time) continue;
        const startDate = new Date(entry.start_time);
        const endDate = entry.end_time ? new Date(entry.end_time) : new Date(startDate.getTime() + 60 * 60 * 1000);
        const uid = generateUID(entry.id, "event");
        
        events.push(`BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDateToICS(now)}
DTSTART:${formatDateToICS(startDate)}
DTEND:${formatDateToICS(endDate)}
SUMMARY:${escapeICS(entry.title || 'Event')}
DESCRIPTION:${escapeICS(entry.description || '')}
CATEGORIES:EVENT
END:VEVENT`);
      }
    }

    // Add journal entries as all-day events
    if (journalEntries) {
      for (const journal of journalEntries) {
        if (!journal.date) continue;
        const journalDate = new Date(journal.date);
        const uid = generateUID(journal.date + '-' + userId, "journal");
        
        const moodEmoji = journal.mood_value === 5 ? '😊' : 
                         journal.mood_value === 4 ? '🙂' : 
                         journal.mood_value === 3 ? '😐' : 
                         journal.mood_value === 2 ? '😔' : '😢';
        
        events.push(`BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDateToICS(now)}
DTSTART;VALUE=DATE:${formatDateOnlyToICS(journalDate)}
DTEND;VALUE=DATE:${formatDateOnlyToICS(new Date(journalDate.getTime() + 24 * 60 * 60 * 1000))}
SUMMARY:${moodEmoji} Journal Entry
DESCRIPTION:Mood: ${journal.mood_value}/5
CATEGORIES:JOURNAL
END:VEVENT`);
      }
    }

    // Build full ICS file
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Wakti//Calendar Feed//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Wakti Calendar
X-WR-CALDESC:Your Wakti tasks, reminders, and events
${events.join('\n')}
END:VCALENDAR`;

    return new Response(icsContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=wakti-calendar.ics",
      },
    });

  } catch (error: unknown) {
    console.error("Error generating ICS feed:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`Error: ${message}`, { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" }
    });
  }
});
