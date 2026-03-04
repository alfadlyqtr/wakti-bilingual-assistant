import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CVData {
  personalInfo: {
    fullName: string;
    fullNameAr?: string;
    email: string;
    phone: string;
    location: string;
    locationAr?: string;
    linkedin?: string;
    website?: string;
    summary: string;
    summaryAr?: string;
    jobTitle: string;
    jobTitleAr?: string;
  };
  experience: Array<{
    id: string;
    company: string;
    companyAr?: string;
    position: string;
    positionAr?: string;
    location: string;
    locationAr?: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
    descriptionAr?: string;
    bullets: string[];
    bulletsAr?: string[];
  }>;
  education: Array<{
    id: string;
    institution: string;
    institutionAr?: string;
    degree: string;
    degreeAr?: string;
    field: string;
    fieldAr?: string;
    startDate: string;
    endDate: string;
    gpa?: string;
  }>;
  skills: Array<{
    id: string;
    name: string;
    nameAr?: string;
    level: number;
  }>;
  languages: Array<{
    id: string;
    name: string;
    nameAr?: string;
    proficiency: string;
    proficiencyAr?: string;
  }>;
  certifications: Array<{
    id: string;
    name: string;
    nameAr?: string;
    issuer: string;
    issuerAr?: string;
    date: string;
  }>;
}

const CV_EXTRACTION_PROMPT = `You are a CV/Resume extraction expert. Analyze the uploaded CV image or document and extract ALL information into a structured JSON format.

IMPORTANT: Extract EXACTLY what you see. Do not make up or assume any information.

Return a JSON object with this EXACT structure:
{
  "personalInfo": {
    "fullName": "extracted name",
    "email": "extracted email",
    "phone": "extracted phone",
    "location": "extracted location/city",
    "linkedin": "linkedin URL if present",
    "website": "website URL if present",
    "summary": "professional summary if present",
    "jobTitle": "current or target job title"
  },
  "experience": [
    {
      "id": "exp_1",
      "company": "company name",
      "position": "job title",
      "location": "job location",
      "startDate": "start date (e.g., Jan 2020)",
      "endDate": "end date or Present",
      "current": true/false,
      "description": "job description if any",
      "bullets": ["achievement 1", "achievement 2"]
    }
  ],
  "education": [
    {
      "id": "edu_1",
      "institution": "university/school name",
      "degree": "degree type (e.g., Bachelor's, Master's)",
      "field": "field of study",
      "startDate": "start year",
      "endDate": "end year",
      "gpa": "GPA if mentioned"
    }
  ],
  "skills": [
    {
      "id": "skill_1",
      "name": "skill name",
      "level": 3
    }
  ],
  "languages": [
    {
      "id": "lang_1",
      "name": "language name",
      "proficiency": "Native/Fluent/Intermediate/Basic"
    }
  ],
  "certifications": [
    {
      "id": "cert_1",
      "name": "certification name",
      "issuer": "issuing organization",
      "date": "date obtained"
    }
  ]
}

For skill levels, estimate 1-5 based on context (5=Expert, 4=Advanced, 3=Intermediate, 2=Basic, 1=Beginner).

If a field is not found in the CV, use an empty string "" or empty array [].

RESPOND ONLY WITH THE JSON OBJECT, NO OTHER TEXT.`;

const CHAT_SYSTEM_PROMPT = `You are Wakti CV Builder Assistant - a friendly, professional AI that helps users create outstanding CVs/resumes.

Your role:
1. Help users build their CV through natural conversation
2. Ask clarifying questions to get better information
3. Suggest improvements to make their CV more impactful
4. Convert casual descriptions into professional bullet points
5. Support both English and Arabic (respond in the language the user uses)

Guidelines:
- Be encouraging and supportive
- Use action verbs for achievements (Led, Developed, Increased, Managed, etc.)
- Quantify achievements when possible (increased sales by 30%, managed team of 10)
- Keep bullet points concise but impactful
- Tailor language to the industry/role

When the user shares information, acknowledge it and ask follow-up questions to get more details.
Always be ready to help improve or rewrite any section.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log('CV Builder: Received request');
    
    let body;
    try {
      body = await req.json();
      console.log('CV Builder: Parsed body, action:', body?.action);
    } catch (parseError) {
      console.error('CV Builder: Failed to parse request body:', parseError);
      throw new Error('Invalid request body');
    }
    
    const { action, imageData, mimeType, messages, language } = body;

    if (!GEMINI_API_KEY) {
      console.error('CV Builder: GEMINI_API_KEY not found');
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Action: extract - Extract CV data from image/PDF
    if (action === 'extract') {
      if (!imageData) {
        throw new Error('No image data provided');
      }

      console.log('CV Builder: Received file with mimeType:', mimeType);
      console.log('CV Builder: Image data length:', imageData?.length || 0);

      // Normalize mime type
      let normalizedMimeType = mimeType || 'image/jpeg';
      if (normalizedMimeType === 'image/jpg') {
        normalizedMimeType = 'image/jpeg';
      }
      
      // For PDFs, we need to use a different model or approach
      // Gemini 1.5 Pro handles PDFs better than Flash
      const model = normalizedMimeType === 'application/pdf' 
        ? 'gemini-1.5-pro' 
        : 'gemini-1.5-flash';
      
      console.log('CV Builder: Using model:', model);
      console.log('CV Builder: Processing', normalizedMimeType);

      const requestBody = {
        contents: [{
          parts: [
            { text: CV_EXTRACTION_PROMPT },
            {
              inline_data: {
                mime_type: normalizedMimeType,
                data: imageData
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        }
      };

      console.log('CV Builder: Sending request to Gemini...');

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error for CV extraction:', errorText);
        console.error('Gemini API status:', response.status);
        
        // Try to parse error for more details
        let errorMessage = `Gemini API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson?.error?.message || errorText.substring(0, 200);
        } catch {
          errorMessage = errorText.substring(0, 200);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Parse the JSON from the response
      let cvData: CVData;
      try {
        // Remove markdown code blocks if present
        const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        cvData = JSON.parse(jsonStr);
      } catch (_e) {
        console.error('Failed to parse CV data:', text);
        throw new Error('Failed to parse extracted CV data');
      }

      // Generate a friendly summary message
      const isArabic = language === 'ar';
      const summaryMessage = generateExtractionSummary(cvData, isArabic);

      // Log AI usage for CV extraction
      await logAIFromRequest(req, {
        functionName: "cv-builder-ai",
        provider: "google",
        model: model,
        inputText: "CV Extraction",
        outputText: summaryMessage,
        durationMs: Date.now() - startTime,
        status: "success",
        metadata: { action: "extract", mime_type: normalizedMimeType }
      });

      return new Response(
        JSON.stringify({
          success: true,
          cvData,
          message: summaryMessage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: chat - Continue conversation to build/refine CV
    if (action === 'chat') {
      const chatMessages = messages || [];
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: CHAT_SYSTEM_PROMPT }]
              },
              ...chatMessages.map((msg: { role: string; content: string }) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
              }))
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Gemini API error:', error);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Log AI usage for CV chat
      await logAIFromRequest(req, {
        functionName: "cv-builder-ai",
        provider: "google",
        model: "gemini-1.5-flash",
        inputText: chatMessages.map((m: { content: string }) => m.content).join("\n"),
        outputText: text,
        durationMs: Date.now() - startTime,
        status: "success",
        metadata: { action: "chat", message_count: chatMessages.length }
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: text
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: unknown) {
    console.error('CV Builder AI error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    // Log AI usage error
    await logAIFromRequest(req, {
      functionName: "cv-builder-ai",
      provider: "google",
      model: "gemini-1.5-flash",
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function generateExtractionSummary(cvData: CVData, isArabic: boolean): string {
  const { personalInfo, experience, education, skills } = cvData;
  
  if (isArabic) {
    let summary = `لقد حللت سيرتك الذاتية! 📄✨\n\nإليك ما استخرجته:\n\n`;
    
    summary += `**المعلومات الشخصية:**\n`;
    summary += `• الاسم: ${personalInfo.fullName || '[غير موجود]'}\n`;
    summary += `• البريد: ${personalInfo.email || '[غير موجود]'}\n`;
    summary += `• الهاتف: ${personalInfo.phone || '[غير موجود]'}\n`;
    if (personalInfo.location) summary += `• الموقع: ${personalInfo.location}\n`;
    if (personalInfo.jobTitle) summary += `• المسمى الوظيفي: ${personalInfo.jobTitle}\n`;
    
    if (experience.length > 0) {
      summary += `\n**الخبرات العملية:** (${experience.length} وظائف)\n`;
      experience.slice(0, 3).forEach(exp => {
        summary += `• ${exp.position} في ${exp.company}\n`;
      });
      if (experience.length > 3) summary += `• ... و ${experience.length - 3} وظائف أخرى\n`;
    }
    
    if (education.length > 0) {
      summary += `\n**التعليم:** (${education.length})\n`;
      education.forEach(edu => {
        summary += `• ${edu.degree} - ${edu.institution}\n`;
      });
    }
    
    if (skills.length > 0) {
      summary += `\n**المهارات:** ${skills.length} مهارة\n`;
      summary += `• ${skills.slice(0, 5).map(s => s.name).join('، ')}`;
      if (skills.length > 5) summary += ` و ${skills.length - 5} أخرى`;
      summary += '\n';
    }
    
    summary += `\nهل تريد أن أبدأ بملء السيرة الذاتية بهذه المعلومات؟ أو هل تريد تعديل أي شيء أولاً؟`;
    
    return summary;
  }
  
  let summary = `I've analyzed your CV! 📄✨\n\nHere's what I extracted:\n\n`;
  
  summary += `**Personal Information:**\n`;
  summary += `• Name: ${personalInfo.fullName || '[Not found]'}\n`;
  summary += `• Email: ${personalInfo.email || '[Not found]'}\n`;
  summary += `• Phone: ${personalInfo.phone || '[Not found]'}\n`;
  if (personalInfo.location) summary += `• Location: ${personalInfo.location}\n`;
  if (personalInfo.jobTitle) summary += `• Job Title: ${personalInfo.jobTitle}\n`;
  
  if (experience.length > 0) {
    summary += `\n**Work Experience:** (${experience.length} positions)\n`;
    experience.slice(0, 3).forEach(exp => {
      summary += `• ${exp.position} at ${exp.company}\n`;
    });
    if (experience.length > 3) summary += `• ... and ${experience.length - 3} more positions\n`;
  }
  
  if (education.length > 0) {
    summary += `\n**Education:** (${education.length})\n`;
    education.forEach(edu => {
      summary += `• ${edu.degree} - ${edu.institution}\n`;
    });
  }
  
  if (skills.length > 0) {
    summary += `\n**Skills:** ${skills.length} skills identified\n`;
    summary += `• ${skills.slice(0, 5).map(s => s.name).join(', ')}`;
    if (skills.length > 5) summary += ` and ${skills.length - 5} more`;
    summary += '\n';
  }
  
  summary += `\nWould you like me to fill in the CV with this information? Or would you like to modify anything first?`;
  
  return summary;
}
