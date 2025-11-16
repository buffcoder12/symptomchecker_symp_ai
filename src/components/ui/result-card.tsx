import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, CheckCircle, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

const resultCardVariants = cva(
  "relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.99] group cursor-pointer",
  {
    variants: {
      variant: {
        primary: "border-2 border-primary/30 hover:border-primary/60 bg-gradient-to-br from-primary/5 via-background to-accent/5",
        secondary: "border border-border hover:border-primary/40 bg-gradient-to-br from-background via-muted/30 to-secondary/20",
        success: "border border-accent/30 hover:border-accent/60 bg-gradient-to-br from-accent/5 via-background to-primary/5",
      },
      shimmer: {
        true: "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        false: "",
      },
    },
    defaultVariants: {
      variant: "secondary",
      shimmer: false,
    },
  }
);

export interface ResultCardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof resultCardVariants> {
  disease: string;
  confidence: number;
  description: string;
  precautions?: string[];
  language?: 'en' | 'hi';
}

const ResultCard = React.forwardRef<HTMLDivElement, ResultCardProps>(
  ({ className, variant, shimmer, disease, confidence, description, precautions, language = 'en', ...props }, ref) => {
    const navigate = useNavigate();
    
    const getSeverityLevel = () => {
      if (confidence >= 70) return { level: 'high', color: 'text-primary', icon: CheckCircle, label: language === 'hi' ? 'उच्च' : 'High' };
      if (confidence >= 50) return { level: 'medium', color: 'text-accent', icon: AlertTriangle, label: language === 'hi' ? 'मध्यम' : 'Medium' };
      return { level: 'low', color: 'text-muted-foreground', icon: AlertCircle, label: language === 'hi' ? 'कम' : 'Low' };
    };

    const severity = getSeverityLevel();
    const SeverityIcon = severity.icon;

    return (
      <Card ref={ref} className={cn(resultCardVariants({ variant, shimmer, className }))} {...props}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-[100px] opacity-50 group-hover:opacity-100 transition-opacity" />
        <CardContent className="pt-6 relative z-10">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{disease}</h3>
              <div className="flex items-center gap-2">
                <SeverityIcon className={cn("h-4 w-4", severity.color)} />
                <Badge 
                  variant={variant === "primary" ? "default" : "secondary"} 
                  className="shadow-md group-hover:shadow-lg transition-shadow"
                >
                  {confidence.toFixed(1)}%
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {language === 'hi' ? 'विश्वास स्तर' : 'Confidence Level'}
                </span>
                <span className={cn("font-medium", severity.color)}>
                  {severity.label}
                </span>
              </div>
              <Progress value={confidence} className="h-2" />
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>

            {precautions && precautions.length > 0 && (
              <>
                <Separator className="group-hover:bg-primary/20 transition-colors" />
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center">
                    <span className="w-1 h-4 bg-gradient-to-b from-primary to-accent rounded-full mr-2 group-hover:h-6 transition-all" />
                    {language === 'hi' ? 'अनुशंसित सावधानियां:' : 'Recommended Precautions:'}
                  </h4>
                  <ul className="space-y-1.5">
                    {precautions.map((precaution, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start group/item">
                        <span className="mr-2 text-primary group-hover/item:scale-125 transition-transform inline-block">•</span>
                        <span className="group-hover/item:text-foreground transition-colors">{precaution}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <Separator className="group-hover:bg-primary/20 transition-colors" />
            
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => navigate('/find-doctor', { state: { disease } })}
            >
              <MapPin className="mr-2 h-4 w-4" />
              {language === 'hi' ? 'डॉक्टर खोजें' : 'Find Nearby Doctors'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
);

ResultCard.displayName = "ResultCard";

export { ResultCard, resultCardVariants };
