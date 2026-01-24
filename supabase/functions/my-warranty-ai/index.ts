import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Max-Age": "86400",
};

interface ExtractRequest {
  mode: "extract" | "qa";
  imageBase64?: string;
  pdfBase64?: string;
  images?: string[];
  mimeType?: string;
  question?: string;
  warrantyContext?: string;
  language?: "en" | "ar";
}

const EXTRACTION_PROMPT = `You are Wakti's Document Intelligence Engine. Analyze ALL provided images/pages thoroughly and extract EVERY piece of information into categorized sections.

CRITICAL: Be extremely thorough - extract every visible field, number, date, name, and detail you can see.

AI SUMMARY INSTRUCTIONS:
- Paragraph 1: What is this document and who does it belong to
- Paragraph 2: Key details (dates, amounts, coverage, terms, contacts)
- Must be plain text, NOT JSON

Return ONLY valid JSON in this EXACT format:
{
  "title": "Clear descriptive title",
  "provider": "Company/organization name",
  "category": "Document type",
  "purchase_date": "YYYY-MM-DD or null",
  "warranty_period": "Duration or null",
  "expiry_date": "YYYY-MM-DD or null",
  "ref_number": "Main reference number",
  "support_contact": "Phone or email",
  "ai_summary": "2 paragraph plain text summary as per instructions above",
  "extracted_data": {
    "document_info": {
      "document_type": "", "document_number": "", "reference_number": "", "receipt_number": "", "invoice_number": "", "order_number": "", "transaction_id": "", "barcode": "", "qr_code": "", "issue_date": "YYYY-MM-DD", "issue_time": "", "expiry_date": "YYYY-MM-DD", "valid_from": "YYYY-MM-DD", "valid_until": "YYYY-MM-DD", "issuing_authority": "", "issuing_country": "", "issuing_office": "", "place_of_issue": "", "serial_number": "", "version": "", "revision": "", "status": "", "classification": "", "security_level": "", "document_language": "", "page_count": "", "format": "", "file_size": "", "checksum": "", "digital_signature": "", "stamp": "", "seal": "", "watermark": "", "certification": "", "verification_code": "", "approval_number": "", "authorization_code": "", "tracking_number": "", "batch_number": "", "lot_number": "", "sequence_number": ""
    },
    "personal_info": {
      "full_name": "", "full_name_arabic": "", "first_name": "", "middle_name": "", "last_name": "", "maiden_name": "", "alias": "", "title": "", "suffix": "", "prefix": "", "date_of_birth": "YYYY-MM-DD", "place_of_birth": "", "age": "", "nationality": "", "citizenship": "", "dual_citizenship": "", "gender": "", "marital_status": "", "blood_type": "", "height": "", "weight": "", "eye_color": "", "hair_color": "", "distinguishing_marks": "", "national_id": "", "passport_number": "", "passport_type": "", "passport_country": "", "visa_number": "", "visa_type": "", "residence_permit": "", "work_permit": "", "driving_license": "", "social_security": "", "tax_id": "", "voter_id": "", "military_id": "", "student_id": "", "employee_id": "", "member_id": "", "customer_id": "", "patient_id": "", "beneficiary_id": "", "dependent_name": "", "emergency_contact": "", "next_of_kin": "", "guardian": "", "sponsor": "", "relationship": ""
    },
    "contact_info": {
      "phone": "", "mobile": "", "home_phone": "", "work_phone": "", "fax": "", "toll_free": "", "emergency_phone": "", "alternate_phone": "", "email": "", "alternate_email": "", "work_email": "", "website": "", "social_media": "", "address": "", "street": "", "building": "", "apartment": "", "floor": "", "unit": "", "po_box": "", "city": "", "state": "", "province": "", "region": "", "district": "", "zone": "", "postal_code": "", "zip_code": "", "country": "", "country_code": "", "coordinates": "", "latitude": "", "longitude": "", "mailing_address": "", "billing_address": "", "shipping_address": "", "permanent_address": "", "temporary_address": "", "office_address": ""
    },
    "vehicle_info": {
      "make": "", "model": "", "year": "", "trim": "", "variant": "", "body_type": "", "color": "", "interior_color": "", "plate_number": "", "registration_number": "", "chassis_number": "", "vin": "", "engine_number": "", "engine_type": "", "engine_capacity": "", "cylinders": "", "horsepower": "", "torque": "", "transmission": "", "drive_type": "", "fuel_type": "", "fuel_capacity": "", "mileage": "", "odometer": "", "condition": "", "usage_type": "", "seating_capacity": "", "doors": "", "axles": "", "weight": "", "gross_weight": "", "towing_capacity": "", "registration_date": "YYYY-MM-DD", "first_registration": "YYYY-MM-DD", "manufacture_date": "YYYY-MM-DD", "import_date": "YYYY-MM-DD", "registration_expiry": "YYYY-MM-DD", "inspection_date": "YYYY-MM-DD", "inspection_expiry": "YYYY-MM-DD", "owner_name": "", "previous_owners": "", "registered_to": "", "leased": "", "financed": "", "loan_provider": "", "dealer": "", "showroom": "", "origin_country": "", "customs_cleared": "", "specifications": "", "features": "", "accessories": "", "modifications": "", "damage_history": "", "accident_history": "", "service_history": "", "warranty_status": "", "insurance_status": ""
    },
    "insurance_info": {
      "policy_number": "", "policy_type": "", "insurer_name": "", "insurer_code": "", "broker_name": "", "broker_code": "", "agent_name": "", "agent_code": "", "coverage_type": "", "coverage_level": "", "plan_name": "", "plan_code": "", "premium_amount": "", "premium_frequency": "", "total_premium": "", "annual_premium": "", "monthly_premium": "", "deductible": "", "co_payment": "", "coverage_limit": "", "sum_insured": "", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "issue_date": "YYYY-MM-DD", "renewal_date": "YYYY-MM-DD", "effective_date": "YYYY-MM-DD", "termination_date": "YYYY-MM-DD", "policy_holder": "", "insured_name": "", "beneficiary": "", "dependent_coverage": "", "family_coverage": "", "group_number": "", "member_id": "", "card_number": "", "network": "", "provider_network": "", "covered_services": "", "exclusions": "", "waiting_period": "", "grace_period": "", "claim_process": "", "claim_limit": "", "claim_history": "", "no_claim_bonus": "", "discount": "", "surcharge": "", "risk_category": "", "underwriting_class": "", "medical_conditions": "", "pre_existing": "", "riders": "", "add_ons": "", "optional_coverage": "", "territorial_limits": "", "geographical_coverage": "", "emergency_coverage": "", "repatriation": "", "evacuation": "", "assistance_services": "", "hotline": "", "claims_contact": "", "customer_service": "", "policy_document": "", "terms_conditions": "", "cancellation_policy": "", "refund_policy": ""
    },
    "financial_info": {
      "total_amount": "", "subtotal": "", "grand_total": "", "net_amount": "", "gross_amount": "", "currency": "", "currency_code": "", "exchange_rate": "", "amount_in_words": "", "base_price": "", "unit_price": "", "quantity": "", "discount": "", "discount_percentage": "", "discount_amount": "", "coupon_code": "", "promo_code": "", "tax_amount": "", "tax_rate": "", "vat": "", "vat_rate": "", "vat_number": "", "gst": "", "sales_tax": "", "service_charge": "", "handling_fee": "", "delivery_fee": "", "shipping_cost": "", "insurance_fee": "", "processing_fee": "", "transaction_fee": "", "late_fee": "", "penalty": "", "interest": "", "interest_rate": "", "finance_charge": "", "down_payment": "", "deposit": "", "advance_payment": "", "installment": "", "installment_amount": "", "installment_count": "", "payment_terms": "", "payment_method": "", "payment_status": "", "payment_date": "YYYY-MM-DD", "due_date": "YYYY-MM-DD", "paid_amount": "", "outstanding_amount": "", "balance": "", "credit_limit": "", "available_credit": "", "account_number": "", "iban": "", "swift_code": "", "bank_name": "", "branch": "", "card_number": "", "card_type": "", "card_holder": "", "authorization_code": "", "transaction_id": "", "receipt_number": "", "invoice_number": "", "billing_period": "", "statement_date": "YYYY-MM-DD"
    },
    "product_info": {
      "product_name": "", "product_code": "", "sku": "", "barcode": "", "upc": "", "ean": "", "isbn": "", "brand": "", "manufacturer": "", "model": "", "model_number": "", "version": "", "variant": "", "size": "", "color": "", "material": "", "weight": "", "dimensions": "", "length": "", "width": "", "height": "", "volume": "", "capacity": "", "quantity": "", "unit": "", "package_quantity": "", "unit_price": "", "retail_price": "", "wholesale_price": "", "msrp": "", "purchase_price": "", "purchase_date": "YYYY-MM-DD", "manufacture_date": "YYYY-MM-DD", "expiry_date": "YYYY-MM-DD", "batch_number": "", "lot_number": "", "serial_number": "", "imei": "", "mac_address": "", "warranty_period": "", "warranty_expiry": "YYYY-MM-DD", "warranty_type": "", "warranty_terms": "", "guarantee": "", "return_policy": "", "store_name": "", "store_location": "", "seller": "", "supplier": "", "distributor": "", "origin_country": "", "made_in": "", "category": "", "subcategory": "", "department": "", "condition": "", "grade": "", "rating": "", "features": "", "specifications": "", "description": "", "usage_instructions": "", "care_instructions": "", "safety_warnings": "", "certifications": "", "compliance": "", "energy_rating": ""
    },
    "medical_info": {
      "patient_name": "", "patient_id": "", "medical_record": "", "hospital_name": "", "clinic_name": "", "facility": "", "department": "", "ward": "", "room_number": "", "bed_number": "", "admission_date": "YYYY-MM-DD", "discharge_date": "YYYY-MM-DD", "visit_date": "YYYY-MM-DD", "appointment_date": "YYYY-MM-DD", "doctor_name": "", "physician": "", "specialist": "", "consultant": "", "nurse": "", "practitioner": "", "medical_license": "", "diagnosis": "", "diagnosis_code": "", "icd_code": "", "condition": "", "symptoms": "", "chief_complaint": "", "medical_history": "", "allergies": "", "medications": "", "prescriptions": "", "dosage": "", "frequency": "", "duration": "", "treatment": "", "procedure": "", "procedure_code": "", "surgery": "", "operation": "", "anesthesia": "", "lab_tests": "", "test_results": "", "imaging": "", "x_ray": "", "mri": "", "ct_scan": "", "ultrasound": "", "blood_type": "", "blood_pressure": "", "heart_rate": "", "temperature": "", "weight": "", "height": "", "bmi": "", "vital_signs": "", "immunizations": "", "vaccinations": "", "vaccination_date": "YYYY-MM-DD", "next_dose": "YYYY-MM-DD", "insurance_provider": "", "insurance_policy": "", "authorization_number": "", "referral": "", "follow_up": "YYYY-MM-DD", "next_appointment": "YYYY-MM-DD"
    },
    "property_info": {
      "property_type": "", "property_id": "", "title_deed": "", "plot_number": "", "parcel_number": "", "survey_number": "", "block": "", "lot": "", "unit_number": "", "building_name": "", "complex_name": "", "project_name": "", "address": "", "street": "", "area": "", "neighborhood": "", "district": "", "city": "", "state": "", "country": "", "postal_code": "", "coordinates": "", "land_area": "", "built_up_area": "", "carpet_area": "", "floor_area": "", "plot_size": "", "frontage": "", "depth": "", "bedrooms": "", "bathrooms": "", "floors": "", "floor_number": "", "total_floors": "", "rooms": "", "parking_spaces": "", "garage": "", "balcony": "", "terrace": "", "garden": "", "pool": "", "year_built": "", "age": "", "condition": "", "furnishing": "", "amenities": "", "features": "", "zoning": "", "land_use": "", "ownership_type": "", "tenure": "", "freehold": "", "leasehold": "", "lease_term": "", "owner_name": "", "landlord": "", "tenant": "", "occupancy": "", "purchase_price": "", "sale_price": "", "market_value": "", "assessed_value": "", "rental_value": "", "monthly_rent": "", "annual_rent": "", "deposit": "", "maintenance_fee": "", "service_charge": "", "property_tax": "", "municipality_fee": "", "utilities": "", "electricity_account": "", "water_account": "", "gas_account": "", "registration_date": "YYYY-MM-DD", "transfer_date": "YYYY-MM-DD", "lease_start": "YYYY-MM-DD", "lease_end": "YYYY-MM-DD", "mortgage": "", "loan_amount": "", "lender": "", "developer": "", "real_estate_agent": "", "broker": ""
    },
    "education_info": {
      "institution_name": "", "school_name": "", "university": "", "college": "", "institute": "", "academy": "", "institution_type": "", "institution_code": "", "campus": "", "branch": "", "department": "", "faculty": "", "program": "", "course": "", "major": "", "specialization": "", "degree": "", "qualification": "", "certificate": "", "diploma": "", "level": "", "grade": "", "year": "", "semester": "", "term": "", "academic_year": "", "student_name": "", "student_id": "", "roll_number": "", "registration_number": "", "admission_number": "", "enrollment_date": "YYYY-MM-DD", "graduation_date": "YYYY-MM-DD", "completion_date": "YYYY-MM-DD", "issue_date": "YYYY-MM-DD", "valid_until": "YYYY-MM-DD", "date_of_birth": "YYYY-MM-DD", "nationality": "", "father_name": "", "mother_name": "", "guardian": "", "gpa": "", "cgpa": "", "percentage": "", "marks": "", "total_marks": "", "grade_point": "", "class": "", "division": "", "rank": "", "honors": "", "distinction": "", "subjects": "", "credits": "", "credit_hours": "", "attendance": "", "conduct": "", "remarks": "", "achievements": "", "awards": "", "scholarships": "", "financial_aid": "", "tuition_fee": "", "fees_paid": "", "transcript": "", "certificate_number": "", "verification_code": "", "accreditation": "", "recognition": "", "board": "", "council": "", "examination_body": ""
    },
    "employment_info": {
      "company_name": "", "employer": "", "organization": "", "department": "", "division": "", "branch": "", "office_location": "", "employee_name": "", "employee_id": "", "staff_number": "", "badge_number": "", "job_title": "", "position": "", "designation": "", "role": "", "level": "", "grade": "", "rank": "", "employment_type": "", "contract_type": "", "full_time": "", "part_time": "", "temporary": "", "permanent": "", "probation": "", "join_date": "YYYY-MM-DD", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "termination_date": "YYYY-MM-DD", "resignation_date": "YYYY-MM-DD", "retirement_date": "YYYY-MM-DD", "contract_start": "YYYY-MM-DD", "contract_end": "YYYY-MM-DD", "probation_end": "YYYY-MM-DD", "confirmation_date": "YYYY-MM-DD", "years_of_service": "", "reporting_to": "", "supervisor": "", "manager": "", "department_head": "", "salary": "", "basic_salary": "", "gross_salary": "", "net_salary": "", "hourly_rate": "", "daily_rate": "", "monthly_salary": "", "annual_salary": "", "allowances": "", "housing_allowance": "", "transport_allowance": "", "food_allowance": "", "bonuses": "", "incentives": "", "commission": "", "overtime": "", "benefits": "", "insurance": "", "medical_insurance": "", "life_insurance": "", "pension": "", "provident_fund": "", "gratuity": "", "leave_balance": "", "annual_leave": "", "sick_leave": "", "work_hours": "", "work_schedule": "", "shift": "", "work_location": "", "remote": "", "office_phone": "", "extension": "", "work_email": "", "qualifications": "", "skills": "", "certifications": "", "performance_rating": "", "appraisal_date": "YYYY-MM-DD", "promotion_date": "YYYY-MM-DD", "transfer_date": "YYYY-MM-DD", "notice_period": "", "exit_date": "YYYY-MM-DD"
    },
    "company_info": {
      "company_name": "", "legal_name": "", "trade_name": "", "brand_name": "", "company_type": "", "business_type": "", "industry": "", "sector": "", "category": "", "registration_number": "", "company_number": "", "trade_license": "", "license_number": "", "commercial_registration": "", "cr_number": "", "tax_id": "", "vat_number": "", "tax_registration": "", "ein": "", "incorporation_date": "YYYY-MM-DD", "establishment_date": "YYYY-MM-DD", "registration_date": "YYYY-MM-DD", "license_issue_date": "YYYY-MM-DD", "license_expiry": "YYYY-MM-DD", "registered_address": "", "head_office": "", "branch_office": "", "corporate_office": "", "mailing_address": "", "street": "", "building": "", "city": "", "state": "", "country": "", "postal_code": "", "po_box": "", "phone": "", "fax": "", "email": "", "website": "", "contact_person": "", "authorized_signatory": "", "ceo": "", "managing_director": "", "chairman": "", "owner": "", "partners": "", "shareholders": "", "directors": "", "board_members": "", "capital": "", "paid_up_capital": "", "authorized_capital": "", "share_capital": "", "number_of_shares": "", "share_value": "", "employees": "", "staff_count": "", "annual_revenue": "", "turnover": "", "bank_name": "", "bank_account": "", "iban": "", "swift_code": "", "chamber_of_commerce": "", "business_activity": "", "scope_of_work": "", "services": "", "products": "", "certifications": "", "accreditations": "", "licenses": "", "permits": "", "approvals": ""
    },
    "additional_info": {
      "notes": "", "remarks": "", "comments": "", "description": "", "details": "", "terms": "", "conditions": "", "terms_and_conditions": "", "clauses": "", "provisions": "", "stipulations": "", "requirements": "", "specifications": "", "instructions": "", "guidelines": "", "procedures": "", "policies": "", "rules": "", "regulations": "", "compliance": "", "legal_notice": "", "disclaimer": "", "warranty_info": "", "guarantee": "", "liability": "", "indemnity": "", "confidentiality": "", "privacy": "", "data_protection": "", "signature": "", "signed_by": "", "witness": "", "notary": "", "stamp": "", "seal": "", "approved_by": "", "verified_by": "", "checked_by": "", "prepared_by": "", "reviewed_by": "", "authorized_by": ""
    }
  }
}

RULES:
1. Only include categories with actual data - omit empty ones
2. Only include fields with values - omit empty fields
3. Use YYYY-MM-DD for all dates
4. Extract EVERYTHING visible - be thorough
5. ai_summary must be plain text paragraphs, NOT JSON`;

const QA_PROMPT = `Answer based on the warranty information provided.

WARRANTY INFORMATION:
{context}

USER QUESTION: {question}

Answer concisely in the same language as the question.`;

function detectMimeType(base64Data: string): string {
  const cleanData = base64Data.trim();
  if (cleanData.startsWith('/9j/') || cleanData.startsWith('/9j')) return 'image/jpeg';
  if (cleanData.startsWith('iVBORw')) return 'image/png';
  if (cleanData.startsWith('UklGR')) return 'image/webp';
  if (cleanData.startsWith('R0lGOD')) return 'image/gif';
  return 'image/jpeg';
}

function cleanBase64(base64Data: string): string {
  return base64Data.trim().replace(/\s/g, '');
}

function normalizeImageMimeType(mimeType: string): string {
  if (mimeType === 'image/jpg') return 'image/jpeg';
  return mimeType;
}

async function callClaudeVision(content: any[], model: string): Promise<any> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{ role: "user", content: content }]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${model}): ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.content?.[0]?.text;
}

async function callOpenAIVision(content: any[], model: string): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{ role: "user", content: content }]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${model}): ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content;
}

async function extractWithFallback(imageArray: string[]): Promise<string> {
  if (!imageArray || !Array.isArray(imageArray) || imageArray.length === 0) {
    throw new Error("Invalid or empty image array provided");
  }

  console.log(`[my-warranty-ai] Starting extraction with ${imageArray.length} images`);

  // Build content for Claude
  const claudeContent: Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }> = [
    { type: "text", text: EXTRACTION_PROMPT }
  ];
  
  for (let i = 0; i < imageArray.length; i++) {
    const rawData = imageArray[i];
    if (!rawData || typeof rawData !== 'string') {
      console.error(`[my-warranty-ai] Invalid image data at index ${i}`);
      continue;
    }
    
    const cleanedData = cleanBase64(rawData);
    if (!cleanedData || cleanedData.length === 0) {
      console.error(`[my-warranty-ai] Empty image data after cleaning at index ${i}`);
      continue;
    }
    
    const imageMime = normalizeImageMimeType(detectMimeType(cleanedData));
    
    console.log(`[my-warranty-ai] Image ${i + 1}: MIME=${imageMime}, length=${cleanedData.length}`);
    
    claudeContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageMime,
        data: cleanedData
      }
    });
  }

  // Build content for OpenAI
  const openaiContent: any[] = [
    { type: 'text', text: EXTRACTION_PROMPT }
  ];

  for (let i = 0; i < imageArray.length; i++) {
    const rawData = imageArray[i];
    if (!rawData || typeof rawData !== 'string') {
      console.error(`[my-warranty-ai] Invalid image data at index ${i} for OpenAI`);
      continue;
    }
    
    const cleanedData = cleanBase64(rawData);
    if (!cleanedData || cleanedData.length === 0) {
      console.error(`[my-warranty-ai] Empty image data after cleaning at index ${i} for OpenAI`);
      continue;
    }
    
    const imageMime = normalizeImageMimeType(detectMimeType(cleanedData));
    const url = `data:${imageMime};base64,${cleanedData}`;
    openaiContent.push({ type: 'image_url', image_url: { url } });
  }

  // Fallback chain: Claude models first, then OpenAI
  const claudeModels = [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-latest',
    'claude-3-5-sonnet-20241022',
    'claude-3-haiku-20240307'
  ];

  const openaiModels = [
    'gpt-4o-2024-08-06',
    'gpt-4o',
    'gpt-4o-mini'
  ];

  // Try Claude models
  for (const model of claudeModels) {
    try {
      console.log(`[my-warranty-ai] Trying Claude model: ${model}`);
      const result = await callClaudeVision(claudeContent, model);
      if (result) {
        console.log(`[my-warranty-ai] Success with ${model}`);
        return result;
      }
    } catch (error) {
      console.error(`[my-warranty-ai] ${model} failed:`, error);
    }
  }

  // Try OpenAI models
  for (const model of openaiModels) {
    try {
      console.log(`[my-warranty-ai] Trying OpenAI model: ${model}`);
      const result = await callOpenAIVision(openaiContent, model);
      if (result) {
        console.log(`[my-warranty-ai] Success with ${model}`);
        return result;
      }
    } catch (error) {
      console.error(`[my-warranty-ai] ${model} failed:`, error);
    }
  }

  throw new Error("All vision models failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ExtractRequest = await req.json();
    const { mode, imageBase64, pdfBase64, images, question, warrantyContext } = body;

    console.log(`[my-warranty-ai] Mode: ${mode}, images count: ${images?.length || 0}`);

    if (mode === "extract") {
      const imageArray = images && images.length > 0 ? images : (imageBase64 ? [imageBase64] : (pdfBase64 ? [pdfBase64] : []));
      
      if (imageArray.length === 0) {
        throw new Error("No document provided for extraction");
      }

      const textContent = await extractWithFallback(imageArray);

      if (!textContent) {
        throw new Error("No response from AI models");
      }

      try {
        let cleanJson = textContent.trim();
        
        if (cleanJson.startsWith("```json")) {
          cleanJson = cleanJson.slice(7);
        }
        if (cleanJson.startsWith("```")) {
          cleanJson = cleanJson.slice(3);
        }
        if (cleanJson.endsWith("```")) {
          cleanJson = cleanJson.slice(0, -3);
        }

        const extracted = JSON.parse(cleanJson.trim());
        console.log(`[my-warranty-ai] Extraction complete: ${extracted.title}`);

        return new Response(
          JSON.stringify({
            success: true,
            mode: "extract",
            data: extracted,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (parseError) {
        console.error("[my-warranty-ai] JSON parse error:", parseError);
        return new Response(
          JSON.stringify({
            success: true,
            mode: "extract",
            data: {
              title: "Document",
              provider: null,
              category: "Other",
              purchase_date: null,
              warranty_period: null,
              expiry_date: null,
              ref_number: null,
              support_contact: null,
              notes: textContent,
              ai_summary: textContent.substring(0, 500),
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (mode === "qa") {
      if (!question) {
        throw new Error("No question provided");
      }

      const prompt = QA_PROMPT
        .replace("{context}", warrantyContext || "No warranty information available")
        .replace("{question}", question);

      // Try Claude first for QA
      let textContent: string | null = null;
      
      try {
        if (ANTHROPIC_API_KEY) {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1024,
              temperature: 0.3,
              messages: [{ role: "user", content: prompt }]
            }),
          });

          if (response.ok) {
            const result = await response.json();
            textContent = result.content?.[0]?.text;
          }
        }
      } catch (error) {
        console.error("[my-warranty-ai] Claude QA failed:", error);
      }

      // Fallback to OpenAI
      if (!textContent && OPENAI_API_KEY) {
        try {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              max_tokens: 1024,
              temperature: 0.3,
              messages: [{ role: "user", content: prompt }]
            }),
          });

          if (response.ok) {
            const result = await response.json();
            textContent = result.choices?.[0]?.message?.content;
          }
        } catch (error) {
          console.error("[my-warranty-ai] OpenAI QA failed:", error);
        }
      }

      if (!textContent) {
        throw new Error("No response from AI models");
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: "qa",
          answer: textContent.trim(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      throw new Error("Invalid mode. Use 'extract' or 'qa'");
    }
  } catch (error) {
    console.error("[my-warranty-ai] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
