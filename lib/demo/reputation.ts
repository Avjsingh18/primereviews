export type Sentiment = "positive" | "neutral" | "negative";
export type ReplyStatus = "Needs Reply" | "Replied" | "Skipped";
export type DemoReview = { id: string; reviewer: string; rating: number; text: string; createdAt: string; location: string; sentiment: Sentiment; topics: string[]; replyStatus: ReplyStatus; reply?: string };

const templates: Omit<DemoReview, "id" | "createdAt">[] = [
  { reviewer: "Aarav Mehta", rating: 5, text: "The staff were genuinely warm and the coffee was excellent. We will be back.", location: "Patna Central", sentiment: "positive", topics: ["Staff Friendliness", "Food Quality"], replyStatus: "Replied", reply: "Thank you, Aarav. We are glad you enjoyed the coffee and felt well looked after." },
  { reviewer: "Sarah Miller", rating: 2, text: "Food was good but we waited almost 40 minutes and nobody told us what was happening.", location: "Patna Central", sentiment: "negative", topics: ["Food Quality", "Waiting Time", "Communication"], replyStatus: "Needs Reply" },
  { reviewer: "Priya Shah", rating: 4, text: "Lovely ambience and clean tables. It was a little busy, but the team handled it well.", location: "Patna Central", sentiment: "positive", topics: ["Ambience", "Cleanliness", "Staff Friendliness"], replyStatus: "Needs Reply" },
  { reviewer: "Rohan Verma", rating: 3, text: "Decent experience. The order took longer than expected, although the staff apologised.", location: "Patna Central", sentiment: "neutral", topics: ["Waiting Time", "Staff Friendliness"], replyStatus: "Needs Reply" },
  { reviewer: "Nisha Kapoor", rating: 1, text: "My order was incorrect and it took too long to get it fixed.", location: "Patna Central", sentiment: "negative", topics: ["Order Accuracy", "Waiting Time"], replyStatus: "Needs Reply" },
  { reviewer: "Maya Joshi", rating: 5, text: "Great value, quick service and such a friendly team.", location: "Patna Central", sentiment: "positive", topics: ["Value for Money", "Staff Friendliness"], replyStatus: "Replied", reply: "Thank you, Maya. We appreciate you taking the time to share this." },
  { reviewer: "Dev Singh", rating: 4, text: "Really clean place and the quality was consistent. Parking was the only challenge.", location: "Patna Central", sentiment: "positive", topics: ["Cleanliness", "Product Quality", "Parking"], replyStatus: "Skipped" },
  { reviewer: "Ishita Roy", rating: 2, text: "The quality was fine, but the pricing was not clear before ordering.", location: "Patna Central", sentiment: "negative", topics: ["Product Quality", "Pricing", "Communication"], replyStatus: "Needs Reply" },
];

export const demoReviews: DemoReview[] = Array.from({ length: 56 }, (_, index) => {
  const review = templates[index % templates.length];
  const date = new Date(); date.setDate(date.getDate() - (index * 2));
  return { ...review, id: `demo-review-${index + 1}`, createdAt: date.toISOString() };
});

export const demoMetrics = { averageRating: 4.3, totalReviews: 56, reviewsThisMonth: 14, unreplied: demoReviews.filter((review) => review.replyStatus === "Needs Reply").length, responseRate: 64, positiveSentiment: 55 };
export const ratingTrend = [4.08, 4.11, 4.14, 4.12, 4.18, 4.22, 4.25, 4.29, 4.3, 4.3, 4.31, 4.3].map((rating, index) => ({ label: `W${index + 1}`, rating }));
export const volumeTrend = [4, 5, 3, 6, 5, 8, 4, 7, 6, 5, 9, 7].map((reviews, index) => ({ label: `W${index + 1}`, reviews }));
export const topicSummary = [
  { name: "Staff Friendliness", mentions: 31, positive: 92, direction: "+18%" }, { name: "Food Quality", mentions: 27, positive: 89, direction: "+8%" }, { name: "Ambience", mentions: 22, positive: 95, direction: "+12%" }, { name: "Value for Money", mentions: 18, positive: 81, direction: "+4%" },
];
export const complaints = [{ name: "Waiting Time", mentions: 14, negative: 78, direction: "+40%" }, { name: "Parking", mentions: 8, negative: 71, direction: "+6%" }, { name: "Order Accuracy", mentions: 6, negative: 67, direction: "+10%" }];
