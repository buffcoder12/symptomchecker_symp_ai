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
  language: z.enum(['en', 'hi']).default('en')
});

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

// Hindi translations
const descriptionsHindi: Record<string, string> = {
  "Drug Reaction": "एक प्रतिकूल दवा प्रतिक्रिया (एडीआर) दवा लेने के कारण होने वाली चोट है। एडीआर किसी दवा की एक खुराक या लंबे समय तक सेवन के बाद या दो या दो से अधिक दवाओं के संयोजन के परिणामस्वरूप हो सकता है।",
  "Malaria": "प्लास्मोडियम परिवार के प्रोटोजोआ परजीवियों के कारण होने वाला एक संक्रामक रोग है जो एनोफिलिस मच्छर के काटने या दूषित सुई या ट्रांसफ्यूजन से फैल सकता है। फाल्सीपेरम मलेरिया सबसे घातक प्रकार है।",
  "Allergy": "एलर्जी एक विदेशी पदार्थ के प्रति प्रतिरक्षा प्रणाली की प्रतिक्रिया है जो आम तौर पर आपके शरीर के लिए हानिकारक नहीं होती है। इनमें कुछ खाद्य पदार्थ, परागकण, या पालतू जानवरों की रूसी शामिल हो सकती है। आपकी प्रतिरक्षा प्रणाली का काम हानिकारक रोगजनकों से लड़कर आपको स्वस्थ रखना है।",
  "GERD": "गैस्ट्रोएसोफेजियल रिफ्लक्स रोग, या जीईआरडी, एक पाचन विकार है जो निचले एसोफेजियल स्फिंक्टर (एलईएस), अन्नप्रणाली और पेट के बीच की मांसपेशियों की अंगूठी को प्रभावित करता है।",
  "Chronic cholestasis": "क्रोनिक कोलेस्टेटिक रोग पित्त एसिड परिवहन में दोष की विशेषता है जो यकृत से आंत तक होता है, जो पित्त उपकला को प्राथमिक क्षति के कारण होता है।",
  "Diabetes": "मधुमेह एक ऐसी बीमारी है जो तब होती है जब आपका रक्त ग्लूकोज, जिसे रक्त शर्करा भी कहा जाता है, बहुत अधिक होता है। रक्त ग्लूकोज ऊर्जा का आपका मुख्य स्रोत है और आपके द्वारा खाए जाने वाले भोजन से आता है।",
  "Gastroenteritis": "गैस्ट्रोएंटेराइटिस पाचन तंत्र की सूजन है, विशेष रूप से पेट, और बड़ी और छोटी आंतें।",
  "Bronchial Asthma": "ब्रोन्कियल अस्थमा एक चिकित्सा स्थिति है जो फेफड़ों के वायुमार्ग पथ को सूज और संकीर्ण कर देती है। रोग पुराना है और दैनिक कामकाज में हस्तक्षेप करता है।",
  "Hypertension": "उच्च रक्तचाप (एचटीएन या एचटी), जिसे उच्च रक्तचाप (एचबीपी) के रूप में भी जाना जाता है, एक दीर्घकालिक चिकित्सा स्थिति है जिसमें धमनियों में रक्तचाप लगातार ऊंचा रहता है।",
  "Migraine": "माइग्रेन गंभीर धड़कते दर्द या स्पंदन संवेदना का कारण बन सकता है, आमतौर पर सिर के एक तरफ। यह अक्सर मतली, उल्टी, और प्रकाश और ध्वनि के प्रति अत्यधिक संवेदनशीलता के साथ होता है।",
  "Cervical spondylosis": "ग्रीवा स्पॉन्डिलोसिस आपकी गर्दन में स्पाइनल डिस्क को प्रभावित करने वाली उम्र से संबंधित टूट-फूट के लिए एक सामान्य शब्द है।",
  "Paralysis (brain hemorrhage)": "इंट्रासेरेब्रल रक्तस्राव (आईसीएच) तब होता है जब रक्त अचानक मस्तिष्क के ऊतकों में फट जाता है, जिससे आपके मस्तिष्क को नुकसान होता है।",
  "Jaundice": "त्वचा और श्वेतपटल (आंखों का सफेद भाग) का पीला धुंधलापन, पित्त वर्णक बिलीरुबिन के असामान्य रूप से उच्च रक्त स्तर के कारण होता है।",
  "Chicken pox": "चिकनपॉक्स वैरिसेला-जोस्टर वायरस (वीजेडवी) के कारण होने वाली एक अत्यधिक संक्रामक बीमारी है। यह खुजली वाले, फफोले जैसे दाने का कारण बन सकता है।",
  "Dengue": "एक तीव्र संक्रामक रोग जो एक फ्लेविवायरस के कारण होता है, एडीज मच्छरों द्वारा प्रसारित होता है, और सिरदर्द, गंभीर जोड़ों का दर्द, और दाने की विशेषता है।",
  "Typhoid": "एक तीव्र बीमारी जो बुखार की विशेषता है जो साल्मोनेला टाइफी बैक्टीरिया के संक्रमण के कारण होती है।",
  "hepatitis A": "हेपेटाइटिस ए हेपेटाइटिस ए वायरस के कारण होने वाला एक अत्यधिक संक्रामक यकृत संक्रमण है।",
  "Hepatitis B": "हेपेटाइटिस बी आपके यकृत का संक्रमण है। यह अंग के निशान, यकृत विफलता और कैंसर का कारण बन सकता है।",
  "Hepatitis C": "हेपेटाइटिस सी वायरस (एचसीवी) के कारण यकृत की सूजन, जो आमतौर पर रक्त आधान के माध्यम से फैलती है।",
  "Hepatitis D": "हेपेटाइटिस डी एक संक्रमण है जो यकृत को सूजन का कारण बनता है। यह सूजन यकृत के कार्य को खराब कर सकती है।",
  "Hepatitis E": "हेपेटाइटिस ई वायरस (एचईवी) के संक्रमण के कारण होने वाली यकृत सूजन का एक दुर्लभ रूप।",
  "Alcoholic hepatitis": "अल्कोहलिक हेपेटाइटिस यकृत की एक रोगग्रस्त, भड़काऊ स्थिति है जो एक विस्तारित अवधि में भारी शराब की खपत के कारण होती है।",
  "Tuberculosis": "तपेदिक (टीबी) एक संक्रामक बीमारी है जो आमतौर पर माइकोबैक्टीरियम ट्यूबरकुलोसिस (एमटीबी) बैक्टीरिया के कारण होती है।",
  "Common Cold": "आम सर्दी आपकी नाक और गले (ऊपरी श्वसन पथ) का एक वायरल संक्रमण है। यह आमतौर पर हानिरहित है, हालांकि ऐसा महसूस नहीं हो सकता है।",
  "Pneumonia": "निमोनिया एक या दोनों फेफड़ों में संक्रमण है। बैक्टीरिया, वायरस और कवक इसका कारण बनते हैं।",
  "Dimorphic hemorrhoids(piles)": "बवासीर गुदा नहर में संवहनी संरचनाएं हैं जो सूज और सूजन हो सकती हैं।",
  "Heart attack": "रक्त आपूर्ति के नुकसान के कारण हृदय की मांसपेशी की मृत्यु। रक्त आपूर्ति का नुकसान आमतौर पर कोरोनरी धमनी की पूर्ण रुकावट के कारण होता है।",
  "Varicose veins": "एक नस जो बढ़ी और मुड़ गई है, अक्सर त्वचा के माध्यम से स्पष्ट रूप से दिखाई देने वाली फूली हुई, नीली रक्त वाहिका के रूप में दिखाई देती है।",
  "Hypothyroidism": "हाइपोथायरायडिज्म, जिसे अंडरएक्टिव थायराइड या कम थायराइड भी कहा जाता है, अंतःस्रावी तंत्र का एक विकार है जिसमें थायरॉयड ग्रंथि पर्याप्त थायराइड हार्मोन का उत्पादन नहीं करती है।",
  "Hyperthyroidism": "हाइपरथायरायडिज्म (अति सक्रिय थायराइड) तब होता है जब आपकी थायरॉयड ग्रंथि हार्मोन थायरोक्सिन का बहुत अधिक उत्पादन करती है।",
  "Hypoglycemia": "हाइपोग्लाइसीमिया एक ऐसी स्थिति है जिसमें आपका रक्त शर्करा (ग्लूकोज) का स्तर सामान्य से कम होता है।",
  "Osteoarthristis": "ऑस्टियोआर्थराइटिस गठिया का सबसे आम रूप है। यह तब होता है जब सुरक्षात्मक उपास्थि जो आपकी हड्डियों के सिरों को कुशन करती है, समय के साथ खराब हो जाती है।",
  "Arthritis": "गठिया आपके एक या अधिक जोड़ों की सूजन और कोमलता है। गठिया के मुख्य लक्षण जोड़ों का दर्द और कठोरता हैं।",
  "(vertigo) Paroymsal  Positional Vertigo": "सौम्य पैरोक्सिस्मल स्थितीय वर्टिगो (बीपीपीवी) वर्टिगो के सबसे आम कारणों में से एक है।",
  "Acne": "एक्ने वल्गेरिस पाइलोसेबेसियस इकाइयों की रुकावट और सूजन के परिणामस्वरूप कॉमेडोन, पैपुल्स, पुस्टुल, नोड्यूल्स, और/या सिस्ट का निर्माण है।",
  "Urinary tract infection": "मूत्र पथ संक्रमण: गुर्दे, मूत्रवाहिनी, मूत्राशय, या मूत्रमार्ग का संक्रमण।",
  "Psoriasis": "सोरायसिस एक आम त्वचा विकार है जो मोटे, लाल, गांठदार पैच बनाता है जो चांदी के तराजू से ढके होते हैं।",
  "Impetigo": "इम्पेटिगो एक आम और अत्यधिक संक्रामक त्वचा संक्रमण है जो मुख्य रूप से शिशुओं और बच्चों को प्रभावित करता है।",
  "Peptic ulcer diseae": "पेप्टिक अल्सर रोग (पीयूडी) पेट, छोटी आंत के पहले भाग, या कभी-कभी निचले अन्नप्रणाली की आंतरिक परत में एक विराम है।",
  "AIDS": "एक्वायर्ड इम्युनोडेफिशिएंसी सिंड्रोम (एड्स) एक पुरानी, संभावित रूप से जीवन के लिए खतरा स्थिति है जो मानव इम्युनोडेफिशिएंसी वायरस (एचआईवी) के कारण होती है।",
  "Fungal infection": "मनुष्यों में, फंगल संक्रमण तब होता है जब एक आक्रमणकारी कवक शरीर के एक क्षेत्र पर कब्जा कर लेता है और प्रतिरक्षा प्रणाली के लिए संभालने के लिए बहुत अधिक होता है।"
};

const precautionsHindi: Record<string, string[]> = {
  "Drug Reaction": ["जलन रोकें", "नजदीकी अस्पताल से परामर्श लें", "दवा लेना बंद करें", "अनुवर्ती कार्रवाई करें"],
  "Malaria": ["नजदीकी अस्पताल से परामर्श लें", "तैलीय भोजन से बचें", "मांसाहारी भोजन से बचें", "मच्छरों को दूर रखें"],
  "Allergy": ["कैलामाइन लगाएं", "पट्टी से क्षेत्र को ढकें", "खुजली को दबाने के लिए बर्फ का उपयोग करें"],
  "GERD": ["वसायुक्त मसालेदार भोजन से बचें", "खाने के बाद लेटने से बचें", "स्वस्थ वजन बनाए रखें", "व्यायाम करें"],
  "Chronic cholestasis": ["ठंडे स्नान", "खुजली रोधी दवा", "डॉक्टर से परामर्श लें", "स्वस्थ भोजन करें"],
  "Diabetes": ["संतुलित आहार लें", "व्यायाम करें", "डॉक्टर से परामर्श लें", "अनुवर्ती कार्रवाई करें"],
  "Gastroenteritis": ["ठोस भोजन खाना बंद करें", "पानी की छोटी घूंट लेने की कोशिश करें", "आराम करें", "धीरे-धीरे खाना शुरू करें"],
  "Bronchial Asthma": ["ढीले कपड़े पहनें", "गहरी सांसें लें", "ट्रिगर से दूर रहें", "मदद लें"],
  "Hypertension": ["ध्यान", "नमक स्नान", "तनाव कम करें", "उचित नींद लें"],
  "Migraine": ["ध्यान", "तनाव कम करें", "धूप में पोलरॉइड चश्मा पहनें", "डॉक्टर से परामर्श लें"],
  "Cervical spondylosis": ["हीटिंग पैड या कोल्ड पैक का उपयोग करें", "व्यायाम करें", "ओटीसी दर्द निवारक लें", "डॉक्टर से परामर्श लें"],
  "Paralysis (brain hemorrhage)": ["मालिश करें", "स्वस्थ भोजन करें", "व्यायाम करें", "डॉक्टर से परामर्श लें"],
  "Jaundice": ["खूब पानी पिएं", "मिल्क थिसल का सेवन करें", "फल और उच्च फाइबर युक्त भोजन खाएं", "दवा"],
  "Chicken pox": ["नहाने में नीम का उपयोग करें", "नीम के पत्ते का सेवन करें", "टीका लें", "सार्वजनिक स्थानों से बचें"],
  "Dengue": ["पपीता के पत्ते का रस पिएं", "वसायुक्त मसालेदार भोजन से बचें", "मच्छरों को दूर रखें", "हाइड्रेटेड रहें"],
  "Typhoid": ["उच्च कैलोरी वाली सब्जियां खाएं", "एंटीबायोटिक थेरेपी", "डॉक्टर से परामर्श लें", "दवा"],
  "hepatitis A": ["नजदीकी अस्पताल से परामर्श लें", "हाथ धोएं", "वसायुक्त मसालेदार भोजन से बचें", "दवा"],
  "Hepatitis B": ["नजदीकी अस्पताल से परामर्श लें", "टीकाकरण", "स्वस्थ भोजन करें", "दवा"],
  "Hepatitis C": ["नजदीकी अस्पताल से परामर्श लें", "टीकाकरण", "स्वस्थ भोजन करें", "दवा"],
  "Hepatitis D": ["डॉक्टर से परामर्श लें", "दवा", "स्वस्थ भोजन करें", "अनुवर्ती कार्रवाई करें"],
  "Hepatitis E": ["शराब की खपत बंद करें", "आराम करें", "डॉक्टर से परामर्श लें", "दवा"],
  "Alcoholic hepatitis": ["शराब की खपत बंद करें", "डॉक्टर से परामर्श लें", "दवा", "अनुवर्ती कार्रवाई करें"],
  "Tuberculosis": ["मुंह ढकें", "डॉक्टर से परामर्श लें", "दवा", "आराम करें"],
  "Common Cold": ["विटामिन सी युक्त पेय पिएं", "भाप लें", "ठंडे भोजन से बचें", "बुखार पर नियंत्रण रखें"],
  "Pneumonia": ["डॉक्टर से परामर्श लें", "दवा", "आराम करें", "अनुवर्ती कार्रवाई करें"],
  "Dimorphic hemorrhoids(piles)": ["वसायुक्त मसालेदार भोजन से बचें", "विच हेज़ल का सेवन करें", "एप्सम नमक के साथ गर्म स्नान", "एलोवेरा जूस का सेवन करें"],
  "Heart attack": ["एम्बुलेंस बुलाएं", "एस्पिरिन चबाएं या निगलें", "शांत रहें"],
  "Varicose veins": ["सपाट लेटें और पैर ऊंचा उठाएं", "मलहम का उपयोग करें", "नस संपीड़न का उपयोग करें", "लंबे समय तक खड़े न रहें"],
  "Hypothyroidism": ["तनाव कम करें", "व्यायाम करें", "स्वस्थ भोजन करें", "उचित नींद लें"],
  "Hyperthyroidism": ["स्वस्थ भोजन करें", "मालिश करें", "लेमन बाम का उपयोग करें", "रेडियोधर्मी आयोडीन उपचार लें"],
  "Hypoglycemia": ["करवट लेकर लेटें", "नाड़ी जांचें", "मीठा पेय पिएं", "डॉक्टर से परामर्श लें"],
  "Osteoarthristis": ["एसिटामिनोफेन", "नजदीकी अस्पताल से परामर्श लें", "अनुवर्ती कार्रवाई करें", "नमक स्नान"],
  "Arthritis": ["व्यायाम करें", "गर्म और ठंडी थेरेपी का उपयोग करें", "एक्यूपंक्चर आज़माएं", "मालिश करें"],
  "(vertigo) Paroymsal  Positional Vertigo": ["लेट जाएं", "शरीर में अचानक बदलाव से बचें", "अचानक सिर हिलाने से बचें", "आराम करें"],
  "Acne": ["दिन में दो बार नहाएं", "वसायुक्त मसालेदार भोजन से बचें", "खूब पानी पिएं", "बहुत सारे उत्पादों से बचें"],
  "Urinary tract infection": ["खूब पानी पिएं", "विटामिन सी का सेवन बढ़ाएं", "क्रैनबेरी जूस पिएं", "प्रोबायोटिक्स लें"],
  "Psoriasis": ["गर्म साबुन के पानी से हाथ धोएं", "दबाव डालकर रक्तस्राव रोकें", "डॉक्टर से परामर्श लें", "नमक से स्नान करें"],
  "Impetigo": ["प्रभावित क्षेत्र को गर्म पानी में भिगोएं", "एंटीबायोटिक्स का उपयोग करें", "गीले संपीड़ित कपड़े से पपड़ी हटाएं", "डॉक्टर से परामर्श लें"],
  "Peptic ulcer diseae": ["वसायुक्त मसालेदार भोजन से बचें", "प्रोबायोटिक भोजन का सेवन करें", "दूध समाप्त करें", "शराब सीमित करें"],
  "AIDS": ["खुले कटों से बचें", "यदि संभव हो तो पीपीई पहनें", "डॉक्टर से परामर्श लें", "अनुवर्ती कार्रवाई करें"],
  "Fungal infection": ["दिन में दो बार नहाएं", "नहाने के पानी में डेटोल या नीम का उपयोग करें", "संक्रमित क्षेत्र को सूखा रखें", "साफ कपड़ों का उपयोग करें"]
};

function analyzeSymptoms(symptoms: string[], language: string = 'en') {
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
  
  // Select appropriate language data
  const descData = language === 'hi' ? descriptionsHindi : descriptions;
  const precData = language === 'hi' ? precautionsHindi : precautions;
  const noDescMsg = language === 'hi' ? "कोई विवरण उपलब्ध नहीं।" : "No description available.";
  const consultMsg = language === 'hi' ? "स्वास्थ्य सेवा पेशेवर से परामर्श लें" : "Consult a healthcare professional";
  
  const results = sortedDiseases.map(([disease, score]) => {
    const totalSymptoms = Object.keys(diseaseSymptomWeights[disease] || {}).length;
    const confidence = totalSymptoms > 0 ? (score / totalSymptoms) * 100 : 0;
    
    return {
      disease,
      confidence: Math.min(confidence, 95),
      description: descData[disease] || noDescMsg,
      precautions: precData[disease] || [consultMsg]
    };
  });
  
  const unknownMsg = language === 'hi' 
    ? "प्रदान किए गए लक्षणों से स्थिति निर्धारित करने में असमर्थ। कृपया स्वास्थ्य सेवा पेशेवर से परामर्श लें।"
    : "Unable to determine condition from provided symptoms. Please consult a healthcare professional.";
  const monitorMsg = language === 'hi' ? "लक्षणों की निगरानी करें" : "Monitor symptoms";
  const seekMsg = language === 'hi' ? "यदि लक्षण बिगड़ते हैं तो चिकित्सा सहायता लें" : "Seek medical attention if symptoms worsen";
  
  return results.length > 0 ? results : [{
    disease: language === 'hi' ? "अज्ञात" : "Unknown",
    confidence: 0,
    description: unknownMsg,
    precautions: [consultMsg, monitorMsg, seekMsg]
  }];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Request from user: ${user.id}`);

    // Parse and validate input
    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('Validation failed:', validation.error.issues);
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validation.error.issues.map(i => i.message)
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { symptoms, language } = validation.data;
    console.log(`Analyzing ${symptoms.length} symptoms in ${language}`);

    const results = analyzeSymptoms(symptoms, language);
    
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
