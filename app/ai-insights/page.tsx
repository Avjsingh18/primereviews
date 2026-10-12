import { notFound } from "next/navigation";
import AIInsights from "@/components/ai-insights";
import { features } from "@/lib/features";
export default function AIInsightsPage(){
  if (!features.aiInsights) notFound();
  return <AIInsights/>;
}
