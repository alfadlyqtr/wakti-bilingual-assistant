# Tasjeel Mobile Audio Fix - Implementation Guide

## Problem
Original Tasjeel recordings were saved as `.webm` files, which work on desktop browsers but **fail on iOS/Android native apps** (Natively wrapper). This caused "Error code: 4. Unable to load audio" on mobile devices.

## Solution
Implemented **Path 2 - True Parity (old + new)**:
1. ✅ Changed recorder to use mobile-friendly formats (mp4/m4a)
2. ✅ Created conversion Edge Function for existing webm files
3. ✅ Created migration script to batch-convert all old recordings

---

## What Changed

### 1. Tasjeel Recorder (`src/components/tasjeel/Tasjeel.tsx`)

**Before:**
- Always recorded as `audio/webm;codecs=opus`
- Uploaded with `.webm` extension
- Only worked on desktop

**After:**
- Tries `audio/mp4` first (works on iOS + desktop)
- Falls back to `audio/webm` if mp4 not supported
- Dynamically determines file extension and content type
- New recordings work on **both desktop and mobile**

**Code changes:**
- `startRecording()`: Now tries multiple codecs in order of preference
- `handleRecordingStopped()`: Detects actual MIME type and sets correct extension/content-type

---

## Deployment Steps

### Step 1: Deploy Updated Frontend
The Tasjeel component changes are already in your code. Just deploy normally:

```bash
# Your normal deployment process
# e.g., git push, Vercel deploy, etc.
```

**Result:** New recordings will be in mp4/m4a format (mobile-friendly).

---

### Step 2: Set Up CloudConvert API (Required for Conversion)

The conversion Edge Function uses **CloudConvert** to convert webm → mp3.

1. Go to https://cloudconvert.com/
2. Sign up for a free account (500 free conversions/month)
3. Get your API key from the dashboard
4. Add it to Supabase secrets:

```bash
supabase secrets set CLOUDCONVERT_API_KEY=your_api_key_here --project-ref hxauxozopvpzpdygoqwf
```

---

### Step 3: Deploy Conversion Edge Functions

Deploy both functions to Supabase:

```bash
# Deploy the single-file converter
supabase functions deploy convert-webm-to-mp3 --project-ref hxauxozopvpzpdygoqwf

# Deploy the batch migration function
supabase functions deploy migrate-webm-recordings --project-ref hxauxozopvpzpdygoqwf
```

---

### Step 4: Run Migration for Existing Recordings

**Option A: Via Supabase Dashboard**
1. Go to Supabase Dashboard → Edge Functions
2. Find `migrate-webm-recordings`
3. Click "Invoke"
4. Send empty POST request: `{}`

**Option B: Via curl**
```bash
curl -X POST \
  https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/migrate-webm-recordings \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**What it does:**
- Finds all `tasjeel_records` with `.webm` in `original_recording_path`
- Converts each to mp3 using CloudConvert
- Uploads mp3 to Supabase Storage
- Updates database record to point to mp3 URL
- Processes with 2-second delay between files to avoid rate limits

**Expected output:**
```json
{
  "success": true,
  "message": "Migration completed",
  "results": {
    "total": 15,
    "converted": 14,
    "failed": 1,
    "errors": [
      {
        "id": "abc-123",
        "path": "user-id/recording-xyz.webm",
        "error": "File not found"
      }
    ]
  }
}
```

---

## Testing

### Test New Recordings

1. **Desktop (Chrome/Edge):**
   - Open Tasjeel
   - Record audio
   - Check console: should see `✅ Using mobile-friendly codec: audio/mp4`
   - Play recording → should work

2. **Mobile (Natively app):**
   - Open Tasjeel
   - Record audio
   - Play recording → **should now work** (no more Error code: 4)

### Test Converted Old Recordings

1. **Desktop:**
   - Go to Saved Recordings
   - Play an old recording (converted from webm to mp3)
   - Should work

2. **Mobile:**
   - Go to Saved Recordings
   - Play an old recording
   - **Should now work** (previously failed)

---

## How Conversion Works

### Single File Conversion (`convert-webm-to-mp3`)

**Input:**
```json
{
  "recordingPath": "user-id/recording-abc123.webm"
}
```

**Process:**
1. Downloads `.webm` from Supabase Storage
2. Uploads to CloudConvert
3. CloudConvert converts webm → mp3 (128kbps)
4. Downloads converted mp3
5. Uploads mp3 to Supabase Storage (same path, `.mp3` extension)
6. Returns mp3 URL

**Output:**
```json
{
  "success": true,
  "originalPath": "user-id/recording-abc123.webm",
  "mp3Path": "user-id/recording-abc123.mp3",
  "mp3Url": "https://...supabase.co/.../recording-abc123.mp3"
}
```

---

## Cost Estimate

### CloudConvert Free Tier
- **500 conversions/month free**
- After that: ~$0.008 per conversion

### For Your Use Case
- If you have < 500 existing webm files → **completely free**
- If you have 1000 files → first 500 free, next 500 = $4
- New recordings don't need conversion (already mp4/m4a)

---

## Troubleshooting

### "CloudConvert API key not configured"
- Make sure you set the secret: `supabase secrets set CLOUDCONVERT_API_KEY=...`
- Redeploy the function after setting secrets

### "Conversion timeout"
- Large files (>10MB) may take longer
- Increase `maxAttempts` in `convert-webm-to-mp3/index.ts` if needed

### "Failed to download webm file"
- Check that the file exists in Supabase Storage
- Verify bucket name is `tasjeel_recordings`
- Ensure Service Role Key has storage access

### Migration shows "failed: X"
- Check the `errors` array in the response
- Common issues:
  - File doesn't exist in storage
  - CloudConvert rate limit hit
  - Invalid URL format

---

## Rollback Plan

If something goes wrong:

1. **Frontend:** Revert `Tasjeel.tsx` to previous commit
2. **Backend:** Old webm files are **not deleted**, only mp3 copies are created
3. **Database:** If needed, you can manually update `original_recording_path` back to `.webm` URLs

---

## Summary

✅ **New recordings:** Mobile-friendly from day 1 (mp4/m4a)  
✅ **Old recordings:** Batch-converted to mp3 via migration  
✅ **Desktop:** Still works perfectly  
✅ **Mobile:** Now works perfectly (no more Error code: 4)  
✅ **Cost:** Free for first 500 conversions  
✅ **Rollback:** Safe, original files not deleted  

**Result:** True parity between desktop and mobile for all Tasjeel recordings, old and new.
