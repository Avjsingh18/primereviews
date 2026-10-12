import { notFound } from "next/navigation";
import ReviewsInbox from "@/components/reviews-inbox";
import { features } from "@/lib/features";
export default function ReviewsPage(){
  if (!features.reviews) notFound();
  return <ReviewsInbox/>;
}
