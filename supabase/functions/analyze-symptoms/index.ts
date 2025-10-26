import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Disease weights based on training data
const diseaseSymptomWeights: Record<string, Record<string, number>> = {
  "Fungal infection": { "itching": 1, "skin_rash": 1, "nodal_skin_eruptions": 1, "dischromic_patches": 1 },
  "Allergy": { "continuous_sneezing": 1, "shivering": 1, "chills": 1, "watering_from_eyes": 1 },
  "GERD": { "stomach_pain": 1, "acidity": 1, "ulcers_on_tongue": 1, "vomiting": 1, "cough": 1 },
  "Chronic cholestasis": { "itching": 1, "vomiting": 1, "yellowish_skin": 1, "nausea": 1, "loss_of_appetite": 1 },
  "Drug Reaction": { "itching": 1, "skin_rash": 1, "stomach_pain": 1, "burning_micturition": 1, "spotting_urination": 1 },
  "Peptic ulcer diseae": { "vomiting": 1, "indigestion": 1, "loss_of_appetite": 1, "abdominal_pain": 1, "passage_of_gases": 1 },
  "AIDS": { "muscle_wasting": 1, "patches_in_throat": 1, "high_fever": 1, "extra_marital_contacts": 1 },
  "Diabetes": { "fatigue": 1, "weight_loss": 1, "restlessness": 1, "lethargy": 1, "irregular_sugar_level": 1, "blurred_and_distorted_vision": 1, "obesity": 1, "excessive_hunger": 1, "increased_appetite": 1, "polyuria": 1 },
  "Gastroenteritis": { "vomiting": 1, "sunken_eyes": 1, "dehydration": 1, "diarrhoea": 1 },
  "Bronchial Asthma": { "fatigue": 1, "cough": 1, "high_fever": 1, "breathlessness": 1, "family_history": 1, "mucoid_sputum": 1 },
  "Hypertension": { "headache": 1, "chest_pain": 1, "dizziness": 1, "loss_of_balance": 1, "lack_of_concentration": 1 },
  "Migraine": { "acidity": 1, "indigestion": 1, "headache": 1, "blurred_and_distorted_vision": 1, "excessive_hunger": 1, "stiff_neck": 1, "depression": 1, "irritability": 1, "visual_disturbances": 1 },
  "Cervical spondylosis": { "back_pain": 1, "weakness_in_limbs": 1, "neck_pain": 1, "dizziness": 1, "loss_of_balance": 1 },
  "Paralysis (brain hemorrhage)": { "vomiting": 1, "headache": 1, "weakness_of_one_body_side": 1, "altered_sensorium": 1 },
  "Jaundice": { "itching": 1, "vomiting": 1, "fatigue": 1, "weight_loss": 1, "high_fever": 1, "yellowish_skin": 1, "dark_urine": 1, "abdominal_pain": 1 },
  "Malaria": { "chills": 1, "vomiting": 1, "high_fever": 1, "sweating": 1, "headache": 1, "nausea": 1, "diarrhoea": 1, "muscle_pain": 1 },
  "Chicken pox": { "itching": 1, "skin_rash": 1, "fatigue": 1, "lethargy": 1, "high_fever": 1, "headache": 1, "loss_of_appetite": 1, "mild_fever": 1, "swelled_lymph_nodes": 1, "malaise": 1, "red_spots_over_body": 1 },
  "Dengue": { "skin_rash": 1, "chills": 1, "joint_pain": 1, "vomiting": 1, "fatigue": 1, "high_fever": 1, "headache": 1, "nausea": 1, "loss_of_appetite": 1, "pain_behind_the_eyes": 1, "back_pain": 1, "malaise": 1, "muscle_pain": 1, "red_spots_over_body": 1 },
  "Typhoid": { "chills": 1, "vomiting": 1, "fatigue": 1, "high_fever": 1, "headache": 1, "nausea": 1, "constipation": 1, "abdominal_pain": 1, "diarrhoea": 1, "toxic_look_(typhos)": 1, "belly_pain": 1 },
  "hepatitis A": { "joint_pain": 1, "vomiting": 1, "yellowish_skin": 1, "dark_urine": 1, "nausea": 1, "loss_of_appetite": 1, "abdominal_pain": 1, "diarrhoea": 1, "mild_fever": 1, "yellowing_of_eyes": 1, "muscle_pain": 1 },
  "Hepatitis B": { "itching": 1, "fatigue": 1, "lethargy": 1, "yellowish_skin": 1, "dark_urine": 1, "loss_of_appetite": 1, "abdominal_pain": 1, "yellow_urine": 1, "yellowing_of_eyes": 1, "malaise": 1, "receiving_blood_transfusion": 1, "receiving_unsterile_injections": 1 },
  "Hepatitis C": { "fatigue": 1, "yellowish_skin": 1, "nausea": 1, "loss_of_appetite": 1, "yellowing_of_eyes": 1, "family_history": 1 },
  "Hepatitis D": { "joint_pain": 1, "vomiting": 1, "fatigue": 1, "high_fever": 1, "yellowish_skin": 1, "dark_urine": 1, "nausea": 1, "loss_of_appetite": 1, "abdominal_pain": 1, "yellowing_of_eyes": 1 },
  "Hepatitis E": { "joint_pain": 1, "vomiting": 1, "fatigue": 1, "high_fever": 1, "yellowish_skin": 1, "dark_urine": 1, "nausea": 1, "loss_of_appetite": 1, "abdominal_pain": 1, "yellowing_of_eyes": 1, "acute_liver_failure": 1, "coma": 1, "stomach_bleeding": 1 },
  "Alcoholic hepatitis": { "vomiting": 1, "yellowish_skin": 1, "abdominal_pain": 1, "swelling_of_stomach": 1, "distention_of_abdomen": 1, "history_of_alcohol_consumption": 1, "fluid_overload": 1 },
  "Tuberculosis": { "chills": 1, "vomiting": 1, "fatigue": 1, "weight_loss": 1, "cough": 1, "high_fever": 1, "breathlessness": 1, "sweating": 1, "loss_of_appetite": 1, "mild_fever": 1, "yellowing_of_eyes": 1, "swelled_lymph_nodes": 1, "malaise": 1, "phlegm": 1, "chest_pain": 1, "blood_in_sputum": 1 },
  "Common Cold": { "continuous_sneezing": 1, "chills": 1, "fatigue": 1, "cough": 1, "high_fever": 1, "headache": 1, "swelled_lymph_nodes": 1, "malaise": 1, "phlegm": 1, "throat_irritation": 1, "redness_of_eyes": 1, "sinus_pressure": 1, "runny_nose": 1, "congestion": 1, "chest_pain": 1, "loss_of_smell": 1, "muscle_pain": 1 },
  "Pneumonia": { "chills": 1, "fatigue": 1, "cough": 1, "high_fever": 1, "breathlessness": 1, "sweating": 1, "malaise": 1, "phlegm": 1, "chest_pain": 1, "fast_heart_rate": 1, "rusty_sputum": 1 },
  "Dimorphic hemorrhoids(piles)": { "constipation": 1, "pain_during_bowel_movements": 1, "pain_in_anal_region": 1, "bloody_stool": 1, "irritation_in_anus": 1 },
  "Heart attack": { "vomiting": 1, "breathlessness": 1, "sweating": 1, "chest_pain": 1 },
  "Varicose veins": { "fatigue": 1, "cramps": 1, "bruising": 1, "obesity": 1, "swollen_legs": 1, "swollen_blood_vessels": 1, "prominent_veins_on_calf": 1 },
  "Hypothyroidism": { "fatigue": 1, "weight_gain": 1, "cold_hands_and_feets": 1, "mood_swings": 1, "lethargy": 1, "dizziness": 1, "puffy_face_and_eyes": 1, "enlarged_thyroid": 1, "brittle_nails": 1, "swollen_extremeties": 1, "depression": 1, "irritability": 1, "abnormal_menstruation": 1 },
  "Hyperthyroidism": { "fatigue": 1, "mood_swings": 1, "weight_loss": 1, "restlessness": 1, "sweating": 1, "diarrhoea": 1, "fast_heart_rate": 1, "excessive_hunger": 1, "muscle_weakness": 1, "irritability": 1, "abnormal_menstruation": 1 },
  "Hypoglycemia": { "vomiting": 1, "fatigue": 1, "anxiety": 1, "sweating": 1, "headache": 1, "nausea": 1, "blurred_and_distorted_vision": 1, "fast_heart_rate": 1, "palpitations": 1, "drying_and_tingling_lips": 1, "slurred_speech": 1, "irritability": 1 },
  "Osteoarthristis": { "joint_pain": 1, "neck_pain": 1, "knee_pain": 1, "hip_joint_pain": 1, "swelling_joints": 1, "painful_walking": 1 },
  "Arthritis": { "muscle_weakness": 1, "stiff_neck": 1, "swelling_joints": 1, "movement_stiffness": 1, "painful_walking": 1 },
  "(vertigo) Paroymsal  Positional Vertigo": { "vomiting": 1, "headache": 1, "nausea": 1, "spinning_movements": 1, "loss_of_balance": 1, "unsteadiness": 1 },
  "Acne": { "skin_rash": 1, "pus_filled_pimples": 1, "blackheads": 1, "scurring": 1 },
  "Urinary tract infection": { "burning_micturition": 1, "bladder_discomfort": 1, "foul_smell_of_urine": 1, "continuous_feel_of_urine": 1 },
  "Psoriasis": { "skin_rash": 1, "joint_pain": 1, "skin_peeling": 1, "silver_like_dusting": 1, "small_dents_in_nails": 1, "inflammatory_nails": 1 },
  "Impetigo": { "skin_rash": 1, "high_fever": 1, "blister": 1, "red_sore_around_nose": 1, "yellow_crust_ooze": 1 }
};

const descriptions: Record<string, string> = {
  "Drug Reaction": "An adverse drug reaction (ADR) is an injury caused by taking medication. ADRs may occur following a single dose or prolonged administration of a drug or result from the combination of two or more drugs.",
  "Malaria": "An infectious disease caused by protozoan parasites from the Plasmodium family that can be transmitted by the bite of the Anopheles mosquito or by a contaminated needle or transfusion.",
  "Allergy": "An allergy is an immune system response to a foreign substance that's not typically harmful to your body. They can include certain foods, pollen, or pet dander.",
  "GERD": "Gastroesophageal reflux disease, or GERD, is a digestive disorder that affects the lower esophageal sphincter (LES), the ring of muscle between the esophagus and stomach.",
  "Chronic cholestasis": "Chronic cholestatic diseases are characterized by defective bile acid transport from the liver to the intestine, which is caused by primary damage to the biliary epithelium.",
  "Diabetes": "Diabetes is a disease that occurs when your blood glucose, also called blood sugar, is too high. Blood glucose is your main source of energy and comes from the food you eat.",
  "Gastroenteritis": "Gastroenteritis is an inflammation of the digestive tract, particularly the stomach, and large and small intestines.",
  "Bronchial Asthma": "Bronchial asthma is a medical condition which causes the airway path of the lungs to swell and narrow. The disease is chronic and interferes with daily working.",
  "Hypertension": "Hypertension (HTN or HT), also known as high blood pressure (HBP), is a long-term medical condition in which the blood pressure in the arteries is persistently elevated.",
  "Migraine": "A migraine can cause severe throbbing pain or a pulsing sensation, usually on one side of the head. It's often accompanied by nausea, vomiting, and extreme sensitivity to light and sound.",
  "Cervical spondylosis": "Cervical spondylosis is a general term for age-related wear and tear affecting the spinal disks in your neck.",
  "Paralysis (brain hemorrhage)": "Intracerebral hemorrhage (ICH) is when blood suddenly bursts into brain tissue, causing damage to your brain.",
  "Jaundice": "Yellow staining of the skin and sclerae (the whites of the eyes) by abnormally high blood levels of the bile pigment bilirubin.",
  "Chicken pox": "Chickenpox is a highly contagious disease caused by the varicella-zoster virus (VZV). It can cause an itchy, blister-like rash.",
  "Dengue": "An acute infectious disease caused by a flavivirus, transmitted by aedes mosquitoes, and characterized by headache, severe joint pain, and a rash.",
  "Typhoid": "An acute illness characterized by fever caused by infection with the bacterium Salmonella typhi.",
  "hepatitis A": "Hepatitis A is a highly contagious liver infection caused by the hepatitis A virus.",
  "Hepatitis B": "Hepatitis B is an infection of your liver. It can cause scarring of the organ, liver failure, and cancer.",
  "Hepatitis C": "Inflammation of the liver due to the hepatitis C virus (HCV), which is usually spread via blood transfusion.",
  "Hepatitis D": "Hepatitis D is an infection that causes the liver to become inflamed. This swelling can impair liver function.",
  "Hepatitis E": "A rare form of liver inflammation caused by infection with the hepatitis E virus (HEV).",
  "Alcoholic hepatitis": "Alcoholic hepatitis is a diseased, inflammatory condition of the liver caused by heavy alcohol consumption over an extended period of time.",
  "Tuberculosis": "Tuberculosis (TB) is an infectious disease usually caused by Mycobacterium tuberculosis (MTB) bacteria.",
  "Common Cold": "The common cold is a viral infection of your nose and throat (upper respiratory tract). It's usually harmless, although it might not feel that way.",
  "Pneumonia": "Pneumonia is an infection in one or both lungs. Bacteria, viruses, and fungi cause it.",
  "Dimorphic hemorrhoids(piles)": "Hemorrhoids are vascular structures in the anal canal that can become swollen and inflamed.",
  "Heart attack": "The death of heart muscle due to the loss of blood supply. The loss of blood supply is usually caused by a complete blockage of a coronary artery.",
  "Varicose veins": "A vein that has enlarged and twisted, often appearing as a bulging, blue blood vessel that is clearly visible through the skin.",
  "Hypothyroidism": "Hypothyroidism, also called underactive thyroid or low thyroid, is a disorder of the endocrine system in which the thyroid gland does not produce enough thyroid hormone.",
  "Hyperthyroidism": "Hyperthyroidism (overactive thyroid) occurs when your thyroid gland produces too much of the hormone thyroxine.",
  "Hypoglycemia": "Hypoglycemia is a condition in which your blood sugar (glucose) level is lower than normal.",
  "Osteoarthristis": "Osteoarthritis is the most common form of arthritis. It occurs when the protective cartilage that cushions the ends of your bones wears down over time.",
  "Arthritis": "Arthritis is the swelling and tenderness of one or more of your joints. The main symptoms of arthritis are joint pain and stiffness.",
  "(vertigo) Paroymsal  Positional Vertigo": "Benign paroxysmal positional vertigo (BPPV) is one of the most common causes of vertigo.",
  "Acne": "Acne vulgaris is the formation of comedones, papules, pustules, nodules, and/or cysts as a result of obstruction and inflammation of pilosebaceous units.",
  "Urinary tract infection": "Urinary tract infection: An infection of the kidney, ureter, bladder, or urethra.",
  "Psoriasis": "Psoriasis is a common skin disorder that forms thick, red, bumpy patches covered with silvery scales.",
  "Impetigo": "Impetigo is a common and highly contagious skin infection that mainly affects infants and children.",
  "Peptic ulcer diseae": "Peptic ulcer disease (PUD) is a break in the inner lining of the stomach, the first part of the small intestine, or sometimes the lower esophagus.",
  "AIDS": "Acquired immunodeficiency syndrome (AIDS) is a chronic, potentially life-threatening condition caused by the human immunodeficiency virus (HIV).",
  "Fungal infection": "In humans, fungal infections occur when an invading fungus takes over an area of the body and is too much for the immune system to handle."
};

const precautions: Record<string, string[]> = {
  "Drug Reaction": ["Stop irritation", "Consult nearest hospital", "Stop taking drug", "Follow up"],
  "Malaria": ["Consult nearest hospital", "Avoid oily food", "Avoid non veg food", "Keep mosquitos out"],
  "Allergy": ["Apply calamine", "Cover area with bandage", "Use ice to compress itching"],
  "GERD": ["Avoid fatty spicy food", "Avoid lying down after eating", "Maintain healthy weight", "Exercise"],
  "Chronic cholestasis": ["Cold baths", "Anti itch medicine", "Consult doctor", "Eat healthy"],
  "Diabetes": ["Have balanced diet", "Exercise", "Consult doctor", "Follow up"],
  "Gastroenteritis": ["Stop eating solid food for while", "Try taking small sips of water", "Rest", "Ease back into eating"],
  "Bronchial Asthma": ["Switch to loose clothing", "Take deep breaths", "Get away from trigger", "Seek help"],
  "Hypertension": ["Meditation", "Salt baths", "Reduce stress", "Get proper sleep"],
  "Migraine": ["Meditation", "Reduce stress", "Use polaroid glasses in sun", "Consult doctor"],
  "Cervical spondylosis": ["Use heating pad or cold pack", "Exercise", "Take OTC pain reliever", "Consult doctor"],
  "Paralysis (brain hemorrhage)": ["Massage", "Eat healthy", "Exercise", "Consult doctor"],
  "Jaundice": ["Drink plenty of water", "Consume milk thistle", "Eat fruits and high fibrous food", "Medication"],
  "Chicken pox": ["Use neem in bathing", "Consume neem leaves", "Take vaccine", "Avoid public places"],
  "Dengue": ["Drink papaya leaf juice", "Avoid fatty spicy food", "Keep mosquitos away", "Keep hydrated"],
  "Typhoid": ["Eat high calorie vegetables", "Antibiotic therapy", "Consult doctor", "Medication"],
  "hepatitis A": ["Consult nearest hospital", "Wash hands thoroughly", "Avoid fatty spicy food", "Medication"],
  "Hepatitis B": ["Consult nearest hospital", "Vaccination", "Eat healthy", "Medication"],
  "Hepatitis C": ["Consult nearest hospital", "Vaccination", "Eat healthy", "Medication"],
  "Hepatitis D": ["Consult doctor", "Medication", "Eat healthy", "Follow up"],
  "Hepatitis E": ["Stop alcohol consumption", "Rest", "Consult doctor", "Medication"],
  "Alcoholic hepatitis": ["Stop alcohol consumption", "Consult doctor", "Medication", "Follow up"],
  "Tuberculosis": ["Cover mouth", "Consult doctor", "Medication", "Rest"],
  "Common Cold": ["Drink vitamin C rich drinks", "Take vapour", "Avoid cold food", "Keep fever in check"],
  "Pneumonia": ["Consult doctor", "Medication", "Rest", "Follow up"],
  "Dimorphic hemorrhoids(piles)": ["Avoid fatty spicy food", "Consume witch hazel", "Warm bath with epsom salt", "Consume aloe vera juice"],
  "Heart attack": ["Call ambulance", "Chew or swallow aspirin", "Keep calm"],
  "Varicose veins": ["Lie down flat and raise the leg high", "Use ointments", "Use vein compression", "Don't stand still for long"],
  "Hypothyroidism": ["Reduce stress", "Exercise", "Eat healthy", "Get proper sleep"],
  "Hyperthyroidism": ["Eat healthy", "Massage", "Use lemon balm", "Take radioactive iodine treatment"],
  "Hypoglycemia": ["Lie down on side", "Check pulse", "Drink sugary drinks", "Consult doctor"],
  "Osteoarthristis": ["Acetaminophen", "Consult nearest hospital", "Follow up", "Salt baths"],
  "Arthritis": ["Exercise", "Use hot and cold therapy", "Try acupuncture", "Massage"],
  "(vertigo) Paroymsal  Positional Vertigo": ["Lie down", "Avoid sudden change in body", "Avoid abrupt head movement", "Relax"],
  "Acne": ["Bath twice", "Avoid fatty spicy food", "Drink plenty of water", "Avoid too many products"],
  "Urinary tract infection": ["Drink plenty of water", "Increase vitamin C intake", "Drink cranberry juice", "Take probiotics"],
  "Psoriasis": ["Wash hands with warm soapy water", "Stop bleeding using pressure", "Consult doctor", "Salt baths"],
  "Impetigo": ["Soak affected area in warm water", "Use antibiotics", "Remove scabs with wet compressed cloth", "Consult doctor"],
  "Peptic ulcer diseae": ["Avoid fatty spicy food", "Consume probiotic food", "Eliminate milk", "Limit alcohol"],
  "AIDS": ["Avoid open cuts", "Wear PPE if possible", "Consult doctor", "Follow up"],
  "Fungal infection": ["Bath twice", "Use dettol or neem in bathing water", "Keep infected area dry", "Use clean clothes"]
};

function analyzeSymptoms(symptoms: string[]) {
  const normalizedSymptoms = symptoms.map(s => s.toLowerCase().replace(/ /g, "_"));
  const scores: Record<string, number> = {};
  
  // Calculate scores for each disease
  for (const [disease, symptomWeights] of Object.entries(diseaseSymptomWeights)) {
    let score = 0;
    for (const symptom of normalizedSymptoms) {
      if (symptomWeights[symptom]) {
        score += 1;
      }
    }
    if (score > 0) {
      scores[disease] = score;
    }
  }
  
  // Get top 3 predictions
  const sortedDiseases = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  const results = sortedDiseases.map(([disease, score]) => {
    const totalSymptoms = Object.keys(diseaseSymptomWeights[disease] || {}).length;
    const confidence = totalSymptoms > 0 ? (score / totalSymptoms) * 100 : 0;
    
    return {
      disease,
      confidence: Math.min(confidence, 95),
      description: descriptions[disease] || "No description available.",
      precautions: precautions[disease] || ["Consult a healthcare professional"]
    };
  });
  
  return results.length > 0 ? results : [{
    disease: "Unknown",
    confidence: 0,
    description: "Unable to determine condition from provided symptoms. Please consult a healthcare professional.",
    precautions: ["Consult a healthcare professional", "Monitor symptoms", "Seek medical attention if symptoms worsen"]
  }];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symptoms } = await req.json();
    
    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return new Response(
        JSON.stringify({ error: "Please provide at least one symptom" }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const results = analyzeSymptoms(symptoms);
    
    return new Response(
      JSON.stringify({ results }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in analyze-symptoms:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
