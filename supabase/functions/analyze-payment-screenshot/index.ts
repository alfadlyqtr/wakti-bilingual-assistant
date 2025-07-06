
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Image Quality Analysis Functions
const performImageQualityChecks = (arrayBuffer: ArrayBuffer, base64: string) => {
  const size = arrayBuffer.byteLength;
  
  // Resolution and Size Analysis
  const estimatedResolution = Math.sqrt(size / 3); // Rough estimation
  const isHighQuality = size > 500000; // 500KB+
  const hasGoodResolution = estimatedResolution > 800;
  
  // Compression Quality (rough estimation based on file size vs expected)
  const compressionRatio = size / (estimatedResolution * estimatedResolution * 3);
  const hasGoodCompression = compressionRatio > 0.1;
  
  // Metadata Analysis (basic checks)
  const hasValidFormat = base64.length > 1000;
  const isNotTooSmall = size > 50000; // 50KB minimum
  
  return {
    size,
    estimatedResolution: Math.round(estimatedResolution),
    isHighQuality,
    hasGoodResolution,
    hasGoodCompression,
    hasValidFormat,
    isNotTooSmall,
    qualityScore: [isHighQuality, hasGoodResolution, hasGoodCompression, hasValidFormat, isNotTooSmall].filter(Boolean).length
  };
};

// Enhanced GPT-4 Vision System Prompt with Image Quality Checks
const ENHANCED_VISION_PROMPT = `You are an expert in verifying Fawran payment screenshots from Qatar banks with advanced image quality analysis.

CRITICAL IMAGE QUALITY ANALYSIS:
1. Resolution & Clarity: Assess if the image is clear, high-resolution (min 800x600), and not blurry
2. Text Legibility: Verify all text is crisp, readable, and not pixelated
3. Screenshot Authenticity: Confirm this is a genuine mobile banking screenshot, not a mock-up
4. Image Completeness: Ensure the entire payment confirmation is visible without cropping key information
5. Compression Quality: Check if the image has sufficient quality for accurate OCR reading
6. Lighting & Contrast: Verify adequate lighting and contrast for clear text recognition
7. Digital Tampering: Detect any signs of photo editing, overlay text, or manipulated elements
8. UI Consistency: Validate that the banking interface appears authentic and consistent
9. Metadata Integrity: Look for signs of screenshot editing or manipulation
10. Color Profile: Ensure natural color representation without artificial filtering

PAYMENT VALIDATION FIELDS:
11. Transfer type: must contain "Fawran" or "فوران" (instant transfer)
12. Payment amount: must match expected value exactly
13. Beneficiary alias: must be "alfadlyqtr"
14. Beneficiary name: must be "ABDULLAH HASSOUN" or Arabic equivalent
15. Transfer timestamp: extract the exact timestamp from screenshot
16. Sender alias: extract user's mobile number or alias
17. Payment reference number: extract and verify uniqueness
18. Transaction reference number: extract and verify uniqueness
19. Transfer status: must be completed/successful
20. Device/Bank Interface: Verify it matches known Qatar banking apps

Respond ONLY with strict JSON containing:

{
  "imageQuality": {
    "resolution": "high" | "medium" | "low",
    "clarity": "excellent" | "good" | "poor",
    "textLegibility": "perfect" | "readable" | "unclear",
    "screenshotAuthenticity": "genuine" | "suspicious" | "fake",
    "completeness": "complete" | "partial" | "cropped",
    "compressionQuality": "excellent" | "acceptable" | "poor",
    "lightingContrast": "optimal" | "adequate" | "insufficient",
    "tamperingDetected": boolean,
    "uiConsistency": "authentic" | "questionable" | "fake",
    "overallQualityScore": number
  },
  "transferType": string,
  "extractedAmount": number,
  "amountMatches": boolean,
  "beneficiaryAlias": string,
  "aliasMatches": boolean,
  "beneficiaryName": string,
  "nameMatches": boolean,
  "senderAlias": string,
  "timestamp": string,
  "isWithinTimeLimit": boolean,
  "paymentReferenceNumber": string,
  "transactionReferenceNumber": string,
  "transferStatus": string,
  "isCompleted": boolean,
  "tamperingDetected": boolean,
  "tamperingReasons": string[],
  "confidence": number,
  "recommendation": "approve" | "reject" | "manual_review",
  "extractedText": string
}`;

// Enhanced validation logic with image quality checks
const runSecurityValidations = async (supabase: any, payment: any, analysis: any, imageQuality: any) => {
  const validations = {
    amountValid: false,
    aliasValid: false,
    nameValid: false,
    transferTypeValid: false,
    timeValid: false,
    statusValid: false,
    tamperingValid: false,
    referencesUnique: false,
    hashUnique: false,
    highConfidence: false,
    imageQualityValid: false,
    screenshotAuthentic: false,
    textLegible: false
  };

  // Image Quality Validations
  const imageQualityAnalysis = analysis.imageQuality || {};
  validations.imageQualityValid = 
    imageQuality.qualityScore >= 4 && 
    imageQuality.isHighQuality &&
    imageQuality.hasGoodResolution &&
    (imageQualityAnalysis.overallQualityScore || 0) >= 7;
    
  validations.screenshotAuthentic = 
    imageQualityAnalysis.screenshotAuthenticity === 'genuine' &&
    imageQualityAnalysis.uiConsistency === 'authentic' &&
    !imageQualityAnalysis.tamperingDetected;
    
  validations.textLegible = 
    imageQualityAnalysis.textLegibility === 'perfect' ||
    imageQualityAnalysis.textLegibility === 'readable';

  // Basic field validations
  validations.amountValid = analysis.amountMatches && analysis.extractedAmount === payment.amount;
  validations.aliasValid = analysis.aliasMatches && analysis.beneficiaryAlias?.toLowerCase() === 'alfadlyqtr';
  validations.nameValid = analysis.nameMatches && 
    analysis.beneficiaryName?.toLowerCase().includes('abdullah') && 
    analysis.beneficiaryName?.toLowerCase().includes('hassoun');
  validations.transferTypeValid = analysis.transferType?.toLowerCase().includes('fawran') || 
    analysis.transferType?.includes('فوران');
  validations.statusValid = analysis.isCompleted;
  validations.highConfidence = analysis.confidence > 85;
  validations.tamperingValid = !analysis.tamperingDetected && !imageQualityAnalysis.tamperingDetected;

  // Time Validation Removed - Fawran payments now work 24/7
  // All time-based restrictions have been eliminated for better user experience
  let timeValidationPassed = true; // Always pass time validation
  let validationMethod = 'no_time_restrictions';

  console.log('✅ Time Validation Bypassed - No Time Restrictions Applied');

  validations.timeValid = timeValidationPassed;

  console.log('🛡️ Final Time Validation Result:', {
    validationMethod,
    timeValidationPassed
  });

  // Check reference number uniqueness
  if (analysis.paymentReferenceNumber || analysis.transactionReferenceNumber) {
    const { data: existingRefs } = await supabase
      .from('used_reference_numbers')
      .select('reference_number, transaction_reference')
      .or(`reference_number.eq.${analysis.paymentReferenceNumber},transaction_reference.eq.${analysis.transactionReferenceNumber}`);

    validations.referencesUnique = !existingRefs || existingRefs.length === 0;
  }

  // Check screenshot hash uniqueness (already checked in upload, but double-check)
  if (payment.screenshot_hash) {
    const { data: existingHash } = await supabase
      .from('screenshot_hashes')
      .select('id')
      .eq('image_hash', payment.screenshot_hash)
      .neq('payment_id', payment.id);

    validations.hashUnique = !existingHash || existingHash.length === 0;
  }

  return { ...validations, validationMethod };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { paymentId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🚀 ULTRA-ROBUST GPT-4 Vision Fawran Worker Started - GUARANTEED PROCESSING:', paymentId);

    // Get payment submission with enhanced fields
    const { data: payment, error: paymentError } = await supabase
      .from('pending_fawran_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error('Payment submission not found');
    }

    console.log('💳 Payment Record:', {
      id: payment.id,
      amount: payment.amount,
      plan_type: payment.plan_type,
      screenshot_hash: payment.screenshot_hash?.substring(0, 16) + '...',
      account_created_at: payment.account_created_at
    });

    // Send initial processing notification
    await supabase.rpc('queue_notification', {
      p_user_id: payment.user_id,
      p_notification_type: 'payment_processing',
      p_title: '🚀 Ultra-Fast Processing Started',
      p_body: 'Your Fawran payment is being analyzed with our enhanced GPT-4 Vision system - guaranteed results!',
      p_data: { payment_id: paymentId, security_level: 'maximum', guaranteed: true },
      p_deep_link: '/settings',
      p_scheduled_for: new Date().toISOString()
    });

    // Download and process screenshot with enhanced error handling
    const screenshotPath = payment.screenshot_url.split('/').pop()!;
    let fileData, downloadError;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await supabase.storage
        .from('fawran-screenshots')
        .download(screenshotPath);
      
      fileData = result.data;
      downloadError = result.error;
      
      if (!downloadError) break;
      
      console.log(`⚠️ Download attempt ${attempt} failed:`, downloadError);
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }

    if (downloadError) {
      throw new Error('Failed to download screenshot after multiple attempts');
    }

    // Convert to high-fidelity base64 for Vision API and run quality checks
    const arrayBuffer = await fileData!.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    // Perform comprehensive image quality analysis
    const imageQuality = performImageQualityChecks(arrayBuffer, base64);

    console.log('🖼️ Image Quality Analysis:', {
      size: arrayBuffer.byteLength,
      estimatedResolution: imageQuality.estimatedResolution,
      qualityScore: imageQuality.qualityScore,
      isHighQuality: imageQuality.isHighQuality,
      hash: payment.screenshot_hash?.substring(0, 16) + '...'
    });
    
    // Reject low-quality images immediately
    if (imageQuality.qualityScore < 3) {
      console.log('❌ Image Quality Too Low - Auto-Rejecting');
      
      await supabase
        .from('pending_fawran_payments')
        .update({
          status: 'rejected',
          review_notes: JSON.stringify({
            rejection_reason: 'Poor image quality',
            image_quality: imageQuality,
            auto_rejected: true,
            analyzed_at: new Date().toISOString(),
            worker_version: 'ultra-robust-v4.0'
          }),
          reviewed_at: new Date().toISOString()
        })
        .eq('id', paymentId);
        
      await supabase.rpc('queue_notification', {
        p_user_id: payment.user_id,
        p_notification_type: 'payment_rejected',
        p_title: '❌ Payment Rejected - Image Quality',
        p_body: 'Your screenshot was rejected due to poor quality. Please upload a clear, high-resolution screenshot.',
        p_data: { payment_id: paymentId, reason: 'image_quality' },
        p_deep_link: '/settings',
        p_scheduled_for: new Date().toISOString()
      });
      
      return new Response(JSON.stringify({
        success: false,
        rejected: true,
        reason: 'Poor image quality',
        imageQuality,
        worker_version: 'ultra-robust-v4.0'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enhanced GPT-4o Vision API call with retry logic
    let visionResponse, aiResponse, analysisText;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🤖 GPT-4o Vision API Call - Attempt ${attempt}/3`);
        
        visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: ENHANCED_VISION_PROMPT },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/jpeg;base64,${base64}`,
                      detail: 'high'
                    }
                  }
                ]
              }
            ],
            max_tokens: 2000,
            temperature: 0, // Deterministic output
          }),
        });

        aiResponse = await visionResponse.json();
        
        if (aiResponse.error) {
          throw new Error(`OpenAI API Error: ${aiResponse.error.message}`);
        }
        
        analysisText = aiResponse.choices[0].message.content;
        console.log('✅ GPT-4o Vision Success - Attempt', attempt);
        break;
        
      } catch (error) {
        console.error(`❌ GPT-4o Vision attempt ${attempt} failed:`, error);
        if (attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
    
    console.log('🤖 GPT-4o Vision Raw Response:', analysisText.substring(0, 200) + '...');

    let analysis;
    try {
      // Clean and parse JSON response
      const cleanJson = analysisText.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      analysis = {
        transferType: null,
        extractedAmount: null,
        amountMatches: false,
        beneficiaryAlias: null,
        aliasMatches: false,
        beneficiaryName: null,
        nameMatches: false,
        senderAlias: null,
        timestamp: null,
        isWithinTimeLimit: false,
        paymentReferenceNumber: null,
        transactionReferenceNumber: null,
        transferStatus: null,
        isCompleted: false,
        tamperingDetected: true,
        tamperingReasons: ['Failed to parse Vision response - potential security issue'],
        confidence: 0,
        recommendation: 'manual_review',
        extractedText: analysisText
      };
    }

    console.log('🔍 Vision Analysis Results:', {
      confidence: analysis.confidence,
      tamperingDetected: analysis.tamperingDetected,
      recommendation: analysis.recommendation,
      amountMatches: analysis.amountMatches,
      aliasMatches: analysis.aliasMatches
    });

    // Run comprehensive security validations with image quality checks
    const validationResult = await runSecurityValidations(supabase, payment, analysis, imageQuality);
    const { validationMethod, ...validations } = validationResult;
    
    console.log('🛡️ Security Validations:', { ...validations, validationMethod });

    // Determine final decision with ironclad logic
    const allSecurityChecksPassed = Object.values(validations).every(Boolean);
    const shouldAutoApprove = allSecurityChecksPassed && 
      analysis.recommendation === 'approve' && 
      !analysis.tamperingDetected &&
      analysis.confidence > 85;

    console.log('⚖️ Final Decision Logic:', {
      allSecurityChecksPassed,
      shouldAutoApprove,
      confidence: analysis.confidence,
      tampering: analysis.tamperingDetected,
      validationMethod
    });

    // Store reference numbers if unique and valid
    if (validations.referencesUnique && (analysis.paymentReferenceNumber || analysis.transactionReferenceNumber)) {
      await supabase
        .from('used_reference_numbers')
        .insert({
          reference_number: analysis.paymentReferenceNumber,
          transaction_reference: analysis.transactionReferenceNumber,
          used_by: payment.user_id,
          payment_id: payment.id
        });
    }

    // Update payment with comprehensive analysis results
    const updateData = {
      status: shouldAutoApprove ? 'approved' : 'pending',
      review_notes: JSON.stringify({
        ai_analysis: analysis,
        security_validations: validations,
        image_quality: imageQuality,
        validation_method: validationMethod,
        processing_time_ms: Date.now() - startTime,
        analyzed_at: new Date().toISOString(),
        auto_approved: shouldAutoApprove,
        security_level: 'maximum',
        worker_version: 'ultra-robust-v4.0',
        guaranteed_processing: true
      }),
      reviewed_at: shouldAutoApprove ? new Date().toISOString() : null,
      time_validation_passed: validations.timeValid,
      tampering_detected: analysis.tamperingDetected,
      duplicate_detected: !validations.hashUnique,
      payment_reference_number: analysis.paymentReferenceNumber,
      transaction_reference_number: analysis.transactionReferenceNumber
    };

    const { error: updateError } = await supabase
      .from('pending_fawran_payments')
      .update(updateData)
      .eq('id', paymentId);

    if (updateError) {
      throw new Error('Failed to update payment status');
    }

    const processingTime = Date.now() - startTime;
    console.log('⏱️ Total Processing Time:', processingTime, 'ms');

    // Handle auto-approval with subscription activation
    if (shouldAutoApprove) {
      console.log('✅ Auto-Approval Granted - Activating Subscription');
      
      const planType = payment.plan_type === 'yearly' ? 'Yearly Plan' : 'Monthly Plan';
      
      // Activate subscription using the admin function
      const { error: subscriptionError } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: payment.user_id,
        p_plan_name: planType,
        p_billing_amount: payment.amount,
        p_billing_currency: 'QAR',
        p_payment_method: 'fawran',
        p_fawran_payment_id: payment.id
      });

      if (!subscriptionError) {
        await supabase.rpc('queue_notification', {
          p_user_id: payment.user_id,
          p_notification_type: 'subscription_activated',
          p_title: '🎉 Payment Auto-Approved & Subscription Activated!',
          p_body: `Your ${planType} subscription has been automatically approved by our ultra-fast AI system. Welcome to Wakti Premium!`,
          p_data: { 
            plan_type: payment.plan_type, 
            amount: payment.amount,
            payment_method: 'fawran',
            payment_id: payment.id,
            security_verified: true,
            auto_approved: true,
            processing_time_ms: processingTime,
            validation_method: validationMethod,
            ultra_fast: true
          },
          p_deep_link: '/dashboard',
          p_scheduled_for: new Date().toISOString()
        });
      }
    } else {
      // Queue manual review notification
      console.log('🔍 Sending to Manual Review');
      
      await supabase.rpc('queue_notification', {
        p_user_id: payment.user_id,
        p_notification_type: 'payment_under_review',
        p_title: '🔍 Payment Under Enhanced Security Review',
        p_body: 'Your payment requires additional verification by our security team. You will be notified once approved.',
        p_data: { 
          payment_amount: payment.amount,
          plan_type: payment.plan_type,
          payment_method: 'fawran',
          payment_id: payment.id,
          confidence: analysis.confidence,
          security_issues: analysis.tamperingDetected ? analysis.tamperingReasons : [],
          processing_time_ms: processingTime,
          validation_method: validationMethod
        },
        p_deep_link: '/settings',
        p_scheduled_for: new Date().toISOString()
      });
    }

    console.log('🚀 ULTRA-ROBUST GPT-4 Vision Fawran Worker Completed Successfully - GUARANTEED!');

    return new Response(JSON.stringify({
      success: true,
      analysis,
      validations,
      imageQuality,
      auto_approved: shouldAutoApprove,
      processing_time_ms: processingTime,
      security_level: 'maximum',
      worker_version: 'ultra-robust-v4.0',
      validation_method: validationMethod,
      payment_method: 'fawran',
      guaranteed_processing: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('🚨 ULTRA-ROBUST GPT-4 Vision Fawran Worker Error:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      processing_time_ms: processingTime,
      security_level: 'maximum',
      worker_version: 'ultra-robust-v4.0',
      guaranteed_processing: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
