import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const symptomSchema = z.string()
  .trim()
  .min(2, 'Symptom must be at least 2 characters')
  .max(100, 'Symptom must be less than 100 characters')
  .regex(/^[a-zA-Z\s\-\_]+$/, 'Symptom contains invalid characters');

const requestSchema = z.object({
  symptoms: z.array(symptomSchema)
    .min(1, 'At least one symptom is required')
    .max(20, 'Maximum 20 symptoms allowed'),
  language: z.enum(['en', 'hi'], {
    errorMap: () => ({ message: 'Language must be either "en" or "hi"' }),
  }),
});

// Load training data from public folder
async function loadTrainingData(): Promise<string | null> {
  try {
    // Try to fetch from the deployed app's public folder
    // The app is deployed at the Supabase URL minus the /functions/v1 path
    const baseUrl = Deno.env.get('SUPABASE_URL') || 'https://qxvnxrefyjnyjrabdruo.supabase.co';
    
    // For Lovable Cloud, the public files are served from the project URL
    // We need to construct the correct URL to the public data folder
    const publicDataUrls = [
      'https://qxvnxrefyjnyjrabdruo.supabase.co/storage/v1/object/public/data/Training.csv',
      // Fallback: Try to access from the main project URL (if deployed to a custom domain)
      `${baseUrl.replace('/functions/v1', '').replace(/\/+$/, '')}/data/Training.csv`,
    ];
    
    console.log('Attempting to load training data from multiple sources...');
    
    for (const url of publicDataUrls) {
      try {
        console.log('Trying URL:', url);
        const response = await fetch(url);
        
        if (response.ok) {
          const text = await response.text();
          if (text.length > 1000) { // Sanity check
            console.log('Training data loaded successfully from:', url);
            console.log('Data size:', text.length, 'bytes');
            return text;
          }
        }
      } catch (e) {
        console.log('Failed to fetch from', url, ':', e);
        continue;
      }
    }
    
    console.error('Failed to load training data from all sources');
    return null;
  } catch (error) {
    console.error('Error in loadTrainingData:', error);
    return null;
  }
}

// Parse CSV and create disease-symptom knowledge base
interface DiseaseData {
  diseases: string[];
  diseaseSymptoms: Record<string, string[]>;
  symptomNames: string[];
}

function parseTrainingData(csvText: string): DiseaseData {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const symptomNames = headers.slice(0, -1); // All columns except last (prognosis)
  
  const diseaseSymptoms: Record<string, string[]> = {};
  const diseases = new Set<string>();
  
  console.log(`Parsing ${lines.length - 1} training samples...`);
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const disease = values[values.length - 1]?.trim();
    
    if (!disease) continue;
    
    diseases.add(disease);
    
    if (!diseaseSymptoms[disease]) {
      diseaseSymptoms[disease] = [];
    }
    
    // Collect symptoms where value is 1
    for (let j = 0; j < symptomNames.length && j < values.length - 1; j++) {
      if (values[j] === '1') {
        const symptom = symptomNames[j];
        if (symptom && !diseaseSymptoms[disease].includes(symptom)) {
          diseaseSymptoms[disease].push(symptom);
        }
      }
    }
  }
  
  const diseaseList = Array.from(diseases).sort();
  console.log(`Extracted ${diseaseList.length} unique diseases`);
  
  return {
    diseases: diseaseList,
    diseaseSymptoms,
    symptomNames
  };
}

// Normalize symptom names for matching
function normalizeSymptom(symptom: string): string {
  return symptom.toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .replace(/\([^)]*\)/g, '')
    .trim();
}

// Calculate disease probability based on symptom matching
function calculateDiseaseProbabilities(
  userSymptoms: string[],
  diseaseData: DiseaseData
): Array<{ disease: string; probability: number; matchedSymptoms: string[] }> {
  const normalizedUserSymptoms = userSymptoms.map(normalizeSymptom);
  const results: Array<{ disease: string; probability: number; matchedSymptoms: string[] }> = [];
  
  for (const disease of diseaseData.diseases) {
    const diseaseSymptomList = diseaseData.diseaseSymptoms[disease] || [];
    const normalizedDiseaseSymptoms = diseaseSymptomList.map(normalizeSymptom);
    
    let matchCount = 0;
    const matchedSymptoms: string[] = [];
    
    for (const userSymptom of normalizedUserSymptoms) {
      for (const diseaseSymptom of normalizedDiseaseSymptoms) {
        // Check for partial matches (contains)
        if (diseaseSymptom.includes(userSymptom) || userSymptom.includes(diseaseSymptom)) {
          matchCount++;
          matchedSymptoms.push(userSymptom);
          break;
        }
      }
    }
    
    if (matchCount > 0) {
      // Calculate probability based on match percentage
      const probability = matchCount / userSymptoms.length;
      results.push({
        disease,
        probability,
        matchedSymptoms
      });
    }
  }
  
  // Sort by probability descending
  results.sort((a, b) => b.probability - a.probability);
  
  return results.slice(0, 5); // Return top 5 matches
}

// Enhanced AI analysis using Lovable AI with disease context
async function analyzeWithAI(
  symptoms: string[],
  topMatches: Array<{ disease: string; probability: number; matchedSymptoms: string[] }>,
  language: string
): Promise<any> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }
  
  const matchSummary = topMatches
    .map(m => `- ${m.disease} (${(m.probability * 100).toFixed(1)}% match based on: ${m.matchedSymptoms.join(', ')})`)
    .join('\n');
  
  const systemPrompt = language === 'hi'
    ? `आप एक चिकित्सा निदान सहायक हैं। लक्षणों के आधार पर संभावित बीमारियों का विश्लेषण करें और चिकित्सा सलाह प्रदान करें। हमेशा याद रखें कि यह केवल जानकारी के लिए है और पेशेवर चिकित्सा परामर्श का स्थान नहीं ले सकता।`
    : `You are a medical diagnostic assistant. Analyze symptoms to suggest possible diseases and provide medical guidance. Always remember this is for informational purposes only and cannot replace professional medical consultation.`;
  
  const userPrompt = language === 'hi'
    ? `मरीज के लक्षण: ${symptoms.join(', ')}

हमारे डेटाबेस में मिलान किए गए रोग:
${matchSummary}

कृपया:
1. सबसे संभावित 3-5 बीमारियों को सूचीबद्ध करें (ऊपर दिए गए मिलान से, लेकिन अन्य संभावनाओं पर भी विचार करें)
2. प्रत्येक के लिए एक संक्षिप्त विवरण प्रदान करें
3. तत्काल सावधानियां या कार्रवाई सुझाएं
4. गंभीरता स्तर बताएं (हल्का, मध्यम, गंभीर)

JSON प्रारूप में उत्तर दें:
{
  "conditions": [
    {
      "name": "रोग का नाम",
      "probability": "उच्च/मध्यम/निम्न",
      "description": "संक्षिप्त विवरण",
      "severity": "mild/moderate/severe",
      "precautions": ["सावधानी 1", "सावधानी 2"]
    }
  ],
  "generalAdvice": "सामान्य सलाह",
  "seekMedicalAttention": true/false
}`
    : `Patient symptoms: ${symptoms.join(', ')}

Matched diseases from our database:
${matchSummary}

Please provide:
1. The 3-5 most likely diseases (from the matches above, but also consider other possibilities)
2. A brief description for each
3. Immediate precautions or actions to take
4. Severity level (mild, moderate, severe)

Respond in JSON format:
{
  "conditions": [
    {
      "name": "Disease name",
      "probability": "high/medium/low",
      "description": "Brief description",
      "severity": "mild/moderate/severe",
      "precautions": ["precaution 1", "precaution 2"]
    }
  ],
  "generalAdvice": "General medical advice",
  "seekMedicalAttention": true/false
}`;

  console.log('Calling Lovable AI for analysis...');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI error:', response.status, errorText);
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  console.log('AI response received');
  
  // Try to parse JSON from the response
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse AI response as JSON:', e);
    // Return a structured fallback
    return {
      conditions: topMatches.slice(0, 3).map(m => ({
        name: m.disease,
        probability: m.probability > 0.5 ? 'high' : m.probability > 0.3 ? 'medium' : 'low',
        description: `Based on symptom matching (${(m.probability * 100).toFixed(1)}% match)`,
        severity: 'moderate',
        precautions: ['Consult a healthcare professional', 'Monitor symptoms', 'Rest and stay hydrated']
      })),
      generalAdvice: content,
      seekMedicalAttention: true
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Symptom Analysis Request ===');
    
    // Initialize Supabase client for authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Parse and validate request body
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body, null, 2));

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation failed:', validation.error.errors);
      return new Response(
        JSON.stringify({
          error: 'Invalid request data',
          details: validation.error.errors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { symptoms, language } = validation.data;
    console.log(`Analyzing ${symptoms.length} symptoms in ${language}`);

    // Load and parse training data
    const trainingCsv = await loadTrainingData();
    
    if (!trainingCsv) {
      console.error('Failed to load training data, falling back to AI-only analysis');
      // Fallback to AI-only analysis without training data
      const aiResult = await analyzeWithAI(symptoms, [], language);
      
      return new Response(
        JSON.stringify({
          analysis: aiResult,
          dataSource: 'ai_only'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const diseaseData = parseTrainingData(trainingCsv);
    console.log(`Loaded ${diseaseData.diseases.length} diseases from training data`);

    // Calculate probabilities based on symptom matching
    const topMatches = calculateDiseaseProbabilities(symptoms, diseaseData);
    console.log('Top matches:', topMatches.map(m => `${m.disease} (${(m.probability * 100).toFixed(1)}%)`).join(', '));

    // Get AI-enhanced analysis
    const aiAnalysis = await analyzeWithAI(symptoms, topMatches, language);

    // Save analysis to database
    const analysisRecord = {
      user_id: user.id,
      symptoms: symptoms,
      language: language,
      top_predictions: topMatches.map(m => m.disease),
      ai_analysis: aiAnalysis,
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('symptom_analyses')
      .insert(analysisRecord);

    if (insertError) {
      console.error('Failed to save analysis:', insertError);
      // Continue even if save fails
    }

    console.log('Analysis completed successfully');

    return new Response(
      JSON.stringify({
        analysis: aiAnalysis,
        dataMatches: topMatches,
        totalDiseases: diseaseData.diseases.length,
        dataSource: 'ml_and_ai'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-symptoms:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
