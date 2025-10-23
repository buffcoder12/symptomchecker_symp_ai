import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LogOut, User, Clock, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Analysis {
  id: string;
  symptoms: string[];
  predicted_disease: string;
  confidence: number;
  created_at: string;
  precautions: string[];
}

const Account = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      const { data, error } = await supabase
        .from("symptom_analyses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Error loading history");
      } else {
        setAnalyses(data || []);
      }

      setLoading(false);
    };

    loadData();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <Button variant="ghost" onClick={() => navigate("/")}>
            ← Back to Analyzer
          </Button>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle>Account</CardTitle>
                <CardDescription>{user?.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Activity className="w-4 h-4" />
              <span>Total Analyses: {analyses.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analysis History</CardTitle>
            <CardDescription>
              View your past symptom analyses and predictions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analyses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No analyses yet. Start by analyzing your symptoms!
              </div>
            ) : (
              analyses.map((analysis) => (
                <Card key={analysis.id} className="border-2">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-lg">{analysis.predicted_disease}</h4>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {analysis.confidence.toFixed(1)}% confidence
                        </Badge>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h5 className="font-medium mb-2">Symptoms Analyzed:</h5>
                        <div className="flex flex-wrap gap-2">
                          {analysis.symptoms.map((symptom, idx) => (
                            <Badge key={idx} variant="outline">
                              {symptom}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {analysis.precautions && analysis.precautions.length > 0 && (
                        <div>
                          <h5 className="font-medium mb-2">Precautions:</h5>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {analysis.precautions.map((precaution, idx) => (
                              <li key={idx}>{precaution}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Account;
