import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Search, Trash2, TrendingUp, Calendar } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format } from "date-fns";

interface Analysis {
  id: string;
  created_at: string;
  symptoms: string[];
  predicted_disease: string;
  confidence: number;
  description: string;
  precautions: string[];
}

const History = () => {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = analyses.filter(
        (analysis) =>
          analysis.predicted_disease.toLowerCase().includes(searchQuery.toLowerCase()) ||
          analysis.symptoms.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredAnalyses(filtered);
    } else {
      setFilteredAnalyses(analyses);
    }
  }, [searchQuery, analyses]);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("symptom_analyses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnalyses(data || []);
      setFilteredAnalyses(data || []);
    } catch (error: any) {
      console.error("Error fetching history:", error);
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const deleteAnalysis = async (id: string) => {
    try {
      const { error } = await supabase
        .from("symptom_analyses")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Analysis deleted");
      fetchHistory();
    } catch (error: any) {
      console.error("Error deleting analysis:", error);
      toast.error("Failed to delete analysis");
    }
  };

  const chartData = analyses.slice(0, 10).reverse().map((analysis) => ({
    date: format(new Date(analysis.created_at), "MMM dd"),
    confidence: analysis.confidence,
    disease: analysis.predicted_disease.slice(0, 15) + "...",
  }));

  const diseaseFrequency = analyses.reduce((acc: any, curr) => {
    acc[curr.predicted_disease] = (acc[curr.predicted_disease] || 0) + 1;
    return acc;
  }, {});

  const frequencyData = Object.entries(diseaseFrequency)
    .map(([disease, count]) => ({ disease: disease.slice(0, 20), count }))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Analysis History
          </h1>
          <p className="text-muted-foreground">Track your health assessments over time</p>
        </div>

        {analyses.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Confidence Trends
                </CardTitle>
                <CardDescription>Last 10 analyses</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="confidence" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Most Common Predictions</CardTitle>
                <CardDescription>Top 5 diagnosed conditions</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={frequencyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="disease" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--accent))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by disease or symptom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 focus-visible:ring-0"
              />
            </div>
          </CardHeader>
        </Card>

        {filteredAnalyses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery ? "No analyses found matching your search" : "No analysis history yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredAnalyses.map((analysis) => (
              <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{analysis.predicted_disease}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(analysis.created_at), "PPpp")}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={analysis.confidence >= 70 ? "default" : "secondary"}>
                        {analysis.confidence}% confidence
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAnalysis(analysis.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Symptoms</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.symptoms.map((symptom, idx) => (
                        <Badge key={idx} variant="outline">
                          {symptom}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {analysis.description && (
                    <div>
                      <h4 className="font-medium mb-2">Description</h4>
                      <p className="text-sm text-muted-foreground">{analysis.description}</p>
                    </div>
                  )}
                  {analysis.precautions && analysis.precautions.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Precautions</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.precautions.map((precaution, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground">
                            {precaution}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
