import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, UserCircle, X, Plus, Save } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  age?: number;
  gender?: string;
  pre_existing_conditions?: string[];
}

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentCondition, setCurrentCondition] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          age: profile.age,
          gender: profile.gender,
          pre_existing_conditions: profile.pre_existing_conditions,
        })
        .eq("id", profile.id);

      if (error) throw error;
      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const addCondition = () => {
    if (!currentCondition.trim()) {
      toast.error("Please enter a condition");
      return;
    }

    if (!profile) return;

    const conditions = profile.pre_existing_conditions || [];
    if (conditions.includes(currentCondition.trim())) {
      toast.error("Condition already added");
      return;
    }

    setProfile({
      ...profile,
      pre_existing_conditions: [...conditions, currentCondition.trim()],
    });
    setCurrentCondition("");
  };

  const removeCondition = (condition: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      pre_existing_conditions: (profile.pre_existing_conditions || []).filter((c) => c !== condition),
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse">Loading profile...</div>
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

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent mb-4">
            <UserCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Health Profile
          </h1>
          <p className="text-muted-foreground">
            Complete your profile for more accurate health assessments
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Help us provide better predictions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={profile?.full_name || ""}
                onChange={(e) => setProfile(profile ? { ...profile, full_name: e.target.value } : null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile?.email || ""} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                placeholder="Enter your age"
                value={profile?.age || ""}
                onChange={(e) =>
                  setProfile(profile ? { ...profile, age: parseInt(e.target.value) || undefined } : null)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={profile?.gender || ""}
                onValueChange={(value) => setProfile(profile ? { ...profile, gender: value } : null)}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pre-existing Conditions</Label>
              <div className="flex space-x-2">
                <Input
                  placeholder="e.g., diabetes, hypertension..."
                  value={currentCondition}
                  onChange={(e) => setCurrentCondition(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addCondition()}
                />
                <Button onClick={addCondition} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {profile?.pre_existing_conditions && profile.pre_existing_conditions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {profile.pre_existing_conditions.map((condition, idx) => (
                    <Badge key={idx} variant="secondary" className="pr-1">
                      {condition}
                      <button onClick={() => removeCondition(condition)} className="ml-2 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={saveProfile} disabled={saving} className="w-full" size="lg">
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Profile
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
