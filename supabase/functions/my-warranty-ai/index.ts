import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

interface ExtractedWarranty {
  title: string;
  provider: string | null;
  category: string;
  purchase_date: string | null;
  warranty_period: string | null;
  expiry_date: string | null;
  ref_number: string | null;
  support_contact: string | null;
  notes: string | null;
  ai_summary?: string;
  customer_name?: string;
  product_details?: string;
  total_amount?: string;
  store_location?: string;
  warranty_terms?: string;
}

const EXTRACTION_PROMPT = `You are Wakti's Document Intelligence Engine. Analyze this document and extract key information as a clean, well-formatted JSON response.

Focus on extracting these critical fields:
1. title: Clear descriptive title (e.g., "LuLu iPhone 12 Pro Max Purchase Receipt")
2. provider: Company/store name (e.g., "LuLu Hypermarket")
3. category: Specific category from the list below
4. purchase_date: Date of purchase in YYYY-MM-DD format
5. warranty_period: Duration of warranty (e.g., "1 year", "2 years")
6. expiry_date: Warranty expiry date in YYYY-MM-DD format
7. ref_number: Invoice/reference number
8. support_contact: Support phone/email if available

=== DOCUMENT CATEGORIES (detect automatically) ===
Motor_Insurance | Comprehensive_Insurance | Third_Party_Insurance | Health_Insurance | Life_Insurance | Property_Insurance | Travel_Insurance | Marine_Insurance | Liability_Insurance | 
Passport | National_ID | Drivers_License | Residence_Permit | Work_Permit | Visa | Birth_Certificate | Marriage_Certificate | Death_Certificate |
Vehicle_Registration | Vehicle_Title | Vehicle_Inspection | Traffic_Violation |
Product_Warranty | Extended_Warranty | Service_Contract | Maintenance_Agreement |
Purchase_Receipt | Invoice | Bill | Payment_Confirmation | Quotation | Estimate |
Employment_Contract | Rental_Agreement | Lease_Contract | Service_Agreement | NDA | Partnership_Agreement |
Medical_Report | Lab_Results | Prescription | Vaccination_Record | Medical_Certificate | Fitness_Certificate |
Bank_Statement | Credit_Card_Statement | Loan_Agreement | Mortgage | Investment_Statement |
Certificate | Diploma | Transcript | License | Accreditation | Training_Certificate |
Property_Deed | Title_Document | Land_Registry | Building_Permit |
Tax_Return | Tax_Certificate | Customs_Declaration |
Power_of_Attorney | Legal_Notice | Court_Order | Affidavit |
Other

=== EXTRACTED DATA STRUCTURE ===
Group fields into these categories in extracted_data. Extract EVERY field you can find:

"extracted_data": {
  "document_info": {
    "document_type", "document_title", "document_number", "document_id", "reference_number", "file_number",
    "issue_date", "issue_time", "issue_place", "expiry_date", "effective_date", "validity_from", "validity_to",
    "issuing_authority", "issuing_department", "issuing_country", "issuing_city", "issuing_branch",
    "registration_number", "certificate_number", "permit_number", "license_number", "serial_number", "batch_number",
    "policy_number", "claim_number", "case_number", "application_number", "transaction_number", "receipt_number",
    "barcode", "qr_code_data", "stamp_number", "seal_number",
    "page_count", "document_language", "document_version", "amendment_number",
    "authentication_code", "verification_code", "security_features"
  },
  "personal_info": {
    "full_name", "full_name_arabic", "first_name", "middle_name", "last_name", "family_name",
    "father_name", "mother_name", "grandfather_name", "spouse_name",
    "nickname", "alias", "maiden_name", "title", "prefix", "suffix",
    "date_of_birth", "place_of_birth", "country_of_birth", "city_of_birth", "age",
    "gender", "sex", "nationality", "citizenship", "dual_citizenship", "ethnicity", "religion", "tribe",
    "marital_status", "number_of_dependents", "number_of_children",
    "occupation", "profession", "employer", "job_title", "work_address",
    "national_id", "passport_number", "civil_id", "social_security_number", "tax_id", "voter_id",
    "driving_license_number", "military_id", "student_id", "employee_id",
    "blood_type", "height", "weight", "eye_color", "hair_color", "skin_color",
    "distinguishing_marks", "disabilities", "medical_conditions",
    "signature_present", "photo_present", "fingerprint_present", "biometric_data"
  },
  "contact_info": {
    "phone", "phone_2", "mobile", "mobile_2", "home_phone", "work_phone", "fax", "fax_2",
    "email", "email_2", "work_email", "website", "social_media",
    "address", "address_line_1", "address_line_2", "street", "street_number", "building", "building_name",
    "floor", "apartment", "unit", "suite", "room", "wing",
    "po_box", "postal_code", "zip_code", "area", "zone", "block", "sector",
    "city", "district", "municipality", "governorate", "state", "province", "region", "country",
    "landmark", "directions", "gps_coordinates",
    "emergency_contact", "emergency_phone", "emergency_relationship",
    "next_of_kin", "next_of_kin_phone", "next_of_kin_address"
  },
  "vehicle_info": {
    "make", "manufacturer", "brand", "model", "variant", "trim", "version", "year", "year_of_manufacture", "model_year",
    "color", "exterior_color", "interior_color", "body_type", "body_style",
    "plate_number", "plate_type", "plate_country", "plate_emirate", "plate_category",
    "registration_number", "registration_date", "registration_expiry", "traffic_file_number",
    "vin", "chassis_number", "frame_number", "engine_number", "motor_number",
    "engine_type", "engine_capacity", "engine_cc", "cylinders", "horsepower", "torque", "fuel_type", "fuel_capacity",
    "transmission", "transmission_type", "drive_type", "gear_count",
    "seating_capacity", "passenger_capacity", "doors", "wheels", "axles",
    "gross_weight", "net_weight", "curb_weight", "payload_capacity", "towing_capacity",
    "length", "width", "height", "wheelbase",
    "use_type", "vehicle_class", "vehicle_category", "vehicle_type", "purpose_of_use",
    "first_registration_date", "import_date", "country_of_origin", "country_of_assembly",
    "mileage", "odometer_reading", "condition", "accident_history",
    "insurance_class", "insurance_group", "emission_class", "safety_rating"
  },
  "insurance_info": {
    "policy_type", "policy_class", "coverage_type", "coverage_level", "plan_name", "plan_type",
    "coverage_area", "geographical_area", "territorial_limits", "covered_countries",
    "insured_value", "sum_insured", "coverage_limit", "liability_limit", "aggregate_limit",
    "premium_amount", "total_premium", "gross_premium", "net_premium", "annual_premium", "monthly_premium",
    "deductible", "excess", "co_payment", "co_insurance", "franchise", "retention",
    "no_claims_bonus", "no_claims_discount", "loyalty_discount", "multi_policy_discount",
    "policy_holder", "insured_name", "insured_party", "additional_insured",
    "beneficiary", "beneficiary_name", "beneficiary_relationship", "contingent_beneficiary",
    "additional_drivers", "named_drivers", "authorized_drivers", "passengers_covered", "number_of_passengers",
    "roadside_assistance", "towing_included", "replacement_car", "agency_repair", "non_agency_repair",
    "personal_accident_cover", "medical_expenses_cover", "legal_expenses_cover",
    "natural_perils_cover", "theft_cover", "fire_cover", "flood_cover",
    "exclusions", "waiting_period", "cooling_off_period", "grace_period",
    "special_conditions", "endorsements", "riders", "add_ons", "optional_covers",
    "claims_history", "previous_insurer", "previous_policy_number",
    "underwriter", "broker", "agent", "agent_code", "branch_code"
  },
  "financial_info": {
    "total_amount", "grand_total", "subtotal", "net_amount", "gross_amount",
    "tax_amount", "vat", "vat_rate", "sales_tax", "service_tax", "withholding_tax",
    "discount", "discount_rate", "service_fee", "processing_fee", "admin_fee",
    "stamp_duty", "government_fee", "payment_method", "payment_type", "payment_status",
    "payment_date", "due_date", "currency", "exchange_rate", "bank_name", "bank_branch", "account_name",
    "account_number", "iban", "swift_code", "card_type", "card_number_last_4", "check_number",
    "installment_amount", "number_of_installments", "interest_rate", "down_payment", "deposit",
    "security_deposit", "balance_due", "invoice_number", "receipt_number", "transaction_id",
    "authorization_code"
  },
  "product_info": {
    "product_name", "product_title", "product_description", "brand", "brand_name", "manufacturer", "model",
    "model_number", "part_number", "serial_number", "imei", "mac_address", "batch_number", "lot_number",
    "sku", "upc", "ean", "isbn", "category", "subcategory", "color", "size", "dimensions", "weight", "material",
    "specifications", "purchase_date", "purchase_location", "store_name", "retailer", "seller", "vendor",
    "warranty_period", "warranty_type", "warranty_start", "warranty_end", "condition", "quantity", "unit_price",
    "country_of_origin"
  },
  "medical_info": {
    "patient_name", "patient_id", "medical_record_number", "health_id", "date_of_visit", "admission_date",
    "discharge_date", "chief_complaint", "symptoms", "diagnosis", "primary_diagnosis", "secondary_diagnosis",
    "icd_code", "treatment", "treatment_plan", "procedure", "surgery", "medication", "drug_name", "dosage",
    "strength", "frequency", "doctor_name", "doctor_specialty", "hospital", "clinic", "laboratory", "test_name",
    "test_type", "test_date", "test_results", "normal_range", "interpretation", "allergies", "medical_history",
    "vital_signs", "blood_pressure", "heart_rate", "temperature", "respiratory_rate", "oxygen_saturation",
    "vaccination_name", "vaccine_type", "dose_number", "batch_number", "vaccination_date", "next_dose_date",
    "blood_group", "rh_factor", "height", "weight", "bmi"
  },
  "property_info": {
    "property_type", "property_category", "property_class", "property_status",
    "property_name", "building_name", "project_name", "development_name",
    "property_address", "full_address", "street_address", "building_number",
    "plot_number", "plot_area", "land_area", "parcel_number", "survey_number",
    "unit_number", "apartment_number", "villa_number", "floor_number", "tower",
    "area_sqm", "area_sqft", "built_up_area", "carpet_area", "super_built_up_area",
    "number_of_rooms", "bedrooms", "bathrooms", "living_rooms", "kitchens", "balconies",
    "parking_spaces", "parking_type", "garage", "storage",
    "amenities", "facilities", "features", "furnishing_status",
    "year_built", "age_of_property", "construction_status", "completion_date",
    "owner_name", "owner_id", "co_owner", "previous_owner",
    "tenant_name", "tenant_id", "landlord_name", "landlord_id",
    "property_manager", "management_company",
    "rent_amount", "monthly_rent", "annual_rent", "rent_frequency",
    "security_deposit", "advance_rent", "maintenance_fee", "service_charge",
    "lease_start", "lease_end", "lease_duration", "renewal_date", "notice_period",
    "title_deed_number", "registration_number", "municipality_number"
  },
  "education_info": {
    "institution_name", "university_name", "college_name", "school_name", "academy_name",
    "institution_type", "institution_address", "institution_country",
    "degree", "degree_type", "qualification", "diploma", "certificate",
    "major", "field_of_study", "specialization", "concentration", "minor",
    "program_name", "course_name", "module_name", "subject",
    "gpa", "cgpa", "grade", "percentage", "marks", "score", "rank", "class", "division",
    "credits", "credit_hours", "total_credits", "earned_credits",
    "enrollment_date", "start_date", "graduation_date", "completion_date", "expected_graduation",
    "student_id", "student_number", "registration_number", "roll_number",
    "semester", "term", "academic_year", "batch", "cohort",
    "thesis_title", "dissertation_title", "project_title",
    "advisor_name", "supervisor_name", "dean_name",
    "honors", "distinction", "cum_laude", "awards", "achievements",
    "accreditation", "accrediting_body", "recognition"
  },
  "employment_info": {
    "employer_name", "company_name", "organization_name", "business_name",
    "employer_address", "work_location", "office_address", "branch",
    "employee_name", "employee_id", "employee_number", "staff_id", "badge_number",
    "job_title", "position", "designation", "role", "rank", "grade", "level",
    "department", "division", "unit", "team", "section",
    "employment_type", "contract_type", "full_time", "part_time", "temporary", "permanent",
    "start_date", "joining_date", "hire_date", "end_date", "termination_date", "resignation_date",
    "probation_period", "probation_end_date", "confirmation_date",
    "salary", "basic_salary", "gross_salary", "net_salary", "annual_salary",
    "currency", "pay_frequency", "pay_period",
    "allowances", "housing_allowance", "transport_allowance", "food_allowance", "phone_allowance",
    "bonus", "commission", "overtime", "incentives",
    "benefits", "health_insurance", "life_insurance", "retirement_plan", "pension",
    "leave_entitlement", "annual_leave", "sick_leave", "vacation_days",
    "notice_period", "severance", "end_of_service",
    "supervisor_name", "manager_name", "reporting_to",
    "hr_contact", "hr_email", "hr_phone",
    "work_permit_number", "labor_card_number", "visa_status"
  },
  "company_info": {
    "company_name", "company_name_arabic", "company_name_local", "trade_name", "brand_name",
    "legal_name", "registered_name", "doing_business_as", "parent_company", "subsidiary",
    "company_type", "legal_form", "business_type", "industry", "sector",
    "company_registration", "registration_number", "incorporation_number", "company_number",
    "commercial_license", "trade_license", "license_number", "license_expiry",
    "tax_id", "tax_registration", "vat_number", "vat_registration", "ein", "tin",
    "chamber_of_commerce", "membership_number",
    "date_established", "incorporation_date", "founding_date",
    "company_address", "registered_address", "head_office", "branch_address",
    "company_phone", "company_fax", "company_email", "company_website",
    "contact_person", "authorized_person", "legal_representative",
    "ceo", "managing_director", "chairman", "board_members", "shareholders",
    "authorized_signatory", "signatory_name", "signatory_title",
    "capital", "share_capital", "paid_up_capital", "authorized_capital",
    "number_of_employees", "company_size",
    "company_stamp_present", "company_seal", "letterhead"
  },
  "additional_info": {
    "notes", "remarks", "comments", "observations", "special_instructions",
    "terms_and_conditions", "terms_of_service", "privacy_policy", "disclaimer",
    "approval_status", "approved_by", "approval_date", "approval_number",
    "rejection_reason", "pending_reason", "status", "current_status",
    "witness_name", "witness_signature", "witness_id", "witness_address",
    "notary_name", "notary_number", "notarization_date", "notary_seal",
    "translator_name", "translation_certified", "translation_date",
    "attachments", "supporting_documents", "enclosures",
    "revision_history", "version_number", "last_updated",
    "confidentiality_level", "classification", "restricted"
  }
}

=== AI SUMMARY INSTRUCTIONS ===
Write EXACTLY 2 paragraphs summarizing this document:

PARAGRAPH 1: What is this document and who does it belong to? Include the document type, issuer/provider, the person or entity it's for, and the main reference numbers.

PARAGRAPH 2: What are the key details the user needs to know? Include validity dates, amounts, coverage, important terms, and any contact information for support.

Use ACTUAL extracted values. Be specific and informative. Write in plain English (or Arabic if document is Arabic).

=== OUTPUT FORMAT ===
{
  "title": "Descriptive title (e.g., 'Range Rover HSE 2023 - Motor Insurance Policy')",
  "provider": "Company/issuer name",
  "category": "One of the categories listed above",
  "purchase_date": "YYYY-MM-DD or null",
  "warranty_period": "Duration or null",
  "expiry_date": "YYYY-MM-DD or null",
  "ref_number": "Main reference number",
  "support_contact": "Primary contact",
  "ai_summary": "Your 2 paragraph summary as PLAIN TEXT - NOT JSON",
  "extracted_data": { /* categorized fields as shown above, only include categories with data */ },
  "raw_ocr_text": "Complete document text"
}

Extract EVERYTHING. Return ONLY valid JSON, no markdown.`;

const QA_PROMPT = `You are a helpful warranty assistant. Answer questions based on the warranty information provided.

WARRANTY INFORMATION:
{context}

USER QUESTION: {question}

RULES:
1. Answer based ONLY on the warranty information above
2. If the answer is not in the warranty info, say "This information is not specified in your warranty document."
3. Be concise and direct
4. Respond in the same language as the question

Answer:`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const body: ExtractRequest = await req.json();
    const { mode, imageBase64, pdfBase64, images, mimeType, question, warrantyContext } = body;

    console.log(`[my-warranty-ai] Mode: ${mode}, mimeType: ${mimeType}, images count: ${images?.length || 0}`);

    let requestBody: {
      contents: Array<{
        parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>;
      }>;
      generationConfig: { temperature: number; maxOutputTokens: number };
    };

    if (mode === "extract") {
      const imageArray = images && images.length > 0 ? images : (imageBase64 ? [imageBase64] : (pdfBase64 ? [pdfBase64] : []));
      
      if (imageArray.length === 0) {
        console.error("[my-warranty-ai] No document provided for extraction");
        throw new Error("No document provided for extraction");
      }

      const documentMimeType = mimeType || (pdfBase64 ? "application/pdf" : "image/jpeg");

      console.log(`[my-warranty-ai] Preparing Gemini request. Mime: ${documentMimeType}, Images: ${imageArray.length}`);

      const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
        { text: EXTRACTION_PROMPT }
      ];
      
      for (const imgData of imageArray) {
        parts.push({
          inline_data: {
            mime_type: documentMimeType,
            data: imgData,
          },
        });
      }

      requestBody = {
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      };
    } else if (mode === "qa") {
      if (!question) {
        throw new Error("No question provided");
      }

      const prompt = QA_PROMPT
        .replace("{context}", warrantyContext || "No warranty information available")
        .replace("{question}", question);

      requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      };
    } else {
      throw new Error("Invalid mode. Use 'extract' or 'qa'");
    }

    console.log(`[my-warranty-ai] Calling Gemini API...`);
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    console.log(`[my-warranty-ai] Gemini response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[my-warranty-ai] Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      throw new Error("No response from Gemini");
    }

    if (mode === "extract") {
      try {
        console.log(`[my-warranty-ai] Parsing extracted text...`);
        let cleanJson = textContent.trim();
        
        // Remove markdown code blocks if present
        if (cleanJson.startsWith("```json")) {
          cleanJson = cleanJson.slice(7);
        }
        if (cleanJson.startsWith("```")) {
          cleanJson = cleanJson.slice(3);
        }
        if (cleanJson.endsWith("```")) {
          cleanJson = cleanJson.slice(0, -3);
        }
        cleanJson = cleanJson.trim();

        const extracted: ExtractedWarranty = JSON.parse(cleanJson);
        console.log(`[my-warranty-ai] Extraction complete: ${extracted.title}`);

        // Ensure ai_summary is plain text, not JSON
        let cleanSummary = extracted.ai_summary || '';
        if (typeof cleanSummary === 'string') {
          // If it looks like JSON, try to extract just the text
          if (cleanSummary.trim().startsWith('{') || cleanSummary.trim().startsWith('```')) {
            // It's JSON - build a simple summary from extracted fields
            const parts: string[] = [];
            if (extracted.title) parts.push(`This is ${extracted.title}.`);
            if (extracted.provider) parts.push(`Issued by ${extracted.provider}.`);
            if ((extracted as any).customer_name) parts.push(`For ${(extracted as any).customer_name}.`);
            if (extracted.ref_number) parts.push(`Reference: ${extracted.ref_number}.`);
            if ((extracted as any).total_amount) parts.push(`Amount: ${(extracted as any).total_amount}.`);
            if (extracted.purchase_date) parts.push(`Dated ${extracted.purchase_date}.`);
            if (extracted.expiry_date) parts.push(`Expires ${extracted.expiry_date}.`);
            cleanSummary = parts.join(' ') || 'Document analyzed successfully.';
          }
        }
        extracted.ai_summary = cleanSummary;

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
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          mode: "qa",
          answer: textContent.trim(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
