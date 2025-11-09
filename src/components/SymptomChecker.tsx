import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, X, Plus, Activity, AlertCircle, CheckCircle2, Mic, MicOff, Languages } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResultCard } from "@/components/ui/result-card";

interface AnalysisResult {
  disease: string;
  confidence: number;
  description: string;
  precautions: string[];
}

export const SymptomChecker = () => {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [currentSymptom, setCurrentSymptom] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setCurrentSymptom(transcript);
        toast.success(`Recognized: ${transcript}`);
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        toast.error('Failed to recognize speech. Please try again.');
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const addSymptom = () => {
    if (currentSymptom.trim() && !symptoms.includes(currentSymptom.trim())) {
      setSymptoms([...symptoms, currentSymptom.trim()]);
      setCurrentSymptom("");
    }
  };

  const removeSymptom = (symptom: string) => {
    setSymptoms(symptoms.filter(s => s !== symptom));
  };

  const analyzeSymptoms = async () => {
    if (symptoms.length === 0) {
      toast.error("Please add at least one symptom");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-symptoms', {
        body: { symptoms, language }
      });

      if (error) throw error;

      if (data?.results) {
        setResults(data.results);
        
        // Save to database
        const topResult = data.results[0];
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          await supabase.from('symptom_analyses').insert({
            user_id: user.id,
            symptoms: symptoms,
            predicted_disease: topResult.disease,
            confidence: topResult.confidence,
            description: topResult.description,
            precautions: topResult.precautions
          });
        }

        toast.success("Analysis complete!");
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error(error.message || "Failed to analyze symptoms");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addSymptom();
    }
  };

  const toggleVoiceInput = () => {
    if (!recognition) {
      toast.error('Speech recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
      toast.info('Listening... Speak your symptom');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent mb-4">
          <Activity className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-4xl font-bold mb-2">
          {language === 'hi' ? 'लक्षण विश्लेषक' : 'Symptom Analyzer'}
        </h2>
        <p className="text-muted-foreground">
          {language === 'hi' 
            ? 'एक बुद्धिमान स्वास्थ्य मूल्यांकन प्राप्त करने के लिए अपने लक्षण दर्ज करें'
            : 'Enter your symptoms to receive an intelligent health assessment'}
        </p>
        <div className="mt-4 flex justify-center">
          <Select value={language} onValueChange={(value: 'en' | 'hi') => setLanguage(value)}>
            <SelectTrigger className="w-48">
              <Languages className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{language === 'hi' ? 'लक्षण जोड़ें' : 'Add Symptoms'}</CardTitle>
            <CardDescription>
              {language === 'hi' 
                ? 'एक बार में अपने लक्षण दर्ज करें'
                : 'Enter your symptoms one at a time'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="e.g., headache, fever, fatigue..."
                value={currentSymptom}
                onChange={(e) => setCurrentSymptom(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <Button 
                onClick={toggleVoiceInput} 
                size="icon"
                variant={isListening ? "destructive" : "secondary"}
                className={isListening ? "animate-pulse" : ""}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button onClick={addSymptom} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                {language === 'hi' ? 'चयनित लक्षण:' : 'Selected Symptoms:'}
              </h4>
              {symptoms.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {language === 'hi' ? 'अभी तक कोई लक्षण नहीं जोड़ा गया' : 'No symptoms added yet'}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {symptoms.map((symptom) => (
                    <Badge key={symptom} variant="secondary" className="pr-1">
                      {symptom}
                      <button
                        onClick={() => removeSymptom(symptom)}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={analyzeSymptoms}
              disabled={loading || symptoms.length === 0}
              className="w-full"
              size="lg"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {language === 'hi' ? 'लक्षणों का विश्लेषण करें' : 'Analyze Symptoms'}
            </Button>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {language === 'hi' ? 'चिकित्सा अस्वीकरण' : 'Medical Disclaimer'}
              </AlertTitle>
              <AlertDescription className="text-xs">
                {language === 'hi'
                  ? 'यह एक एआई-संचालित मूल्यांकन उपकरण है। उचित चिकित्सा निदान और उपचार के लिए हमेशा स्वास्थ्य सेवा पेशेवर से परामर्श करें।'
                  : 'This is an AI-powered assessment tool. Always consult with a healthcare professional for proper medical diagnosis and treatment.'}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {results.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle2 className="mr-2 h-5 w-5 text-primary" />
                  {language === 'hi' ? 'विश्लेषण परिणाम' : 'Analysis Results'}
                </CardTitle>
                <CardDescription>
                  {language === 'hi'
                    ? 'आपके लक्षणों के आधार पर शीर्ष अनुमानित स्थितियां'
                    : 'Top predicted conditions based on your symptoms'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {results.map((result, index) => (
                  <ResultCard
                    key={index}
                    variant={index === 0 ? "primary" : index === 1 ? "success" : "secondary"}
                    shimmer={index === 0}
                    disease={result.disease}
                    confidence={result.confidence}
                    description={result.description}
                    precautions={result.precautions}
                    language={language}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
