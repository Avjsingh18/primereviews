"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import styles from "./review-link-help.module.css";

const base = "/tutorials/google-review-link";
const languages = {
  en: {
    label: "English", video: `${base}/find-your-google-review-link.mp4`, poster: `${base}/poster.jpg`, captions: `${base}/captions.en.vtt`, captionLang: "en",
    title: "How to find your Google review link",
    steps: ["On a computer, open business.google.com and sign in with the Google account that manages your business.", "Select your business profile, then choose “Read reviews”.", "Choose “Get more reviews” and click “Copy” beside the review link.", "Paste it into the box, then open it in a new tab to check that it shows your business’s review form."],
    note: "The screens in the video are an example. Google’s labels can look slightly different.",
  },
  hi: {
    label: "हिन्दी", video: `${base}/hindi/find-your-google-review-link-hi.mp4`, poster: `${base}/hindi/poster.jpg`, captions: `${base}/hindi/captions.hi.vtt`, captionLang: "hi",
    title: "अपना गूगल रिव्यू लिंक कैसे ढूँढें",
    steps: ["कंप्यूटर पर business.google.com खोलें और उसी गूगल खाते से साइन इन करें जिससे आप अपना बिज़नेस मैनेज करते हैं।", "अपनी बिज़नेस प्रोफ़ाइल चुनें, फिर “Read reviews” पर क्लिक करें।", "“Get more reviews” पर क्लिक करें और रिव्यू लिंक के पास “Copy” दबाएँ।", "लिंक को बॉक्स में पेस्ट करें, फिर नए टैब में खोलकर जाँचें कि आपके बिज़नेस का रिव्यू फ़ॉर्म खुल रहा है।"],
    note: "वीडियो में दिखने वाली स्क्रीन केवल उदाहरण हैं। गूगल पर बटन के नाम थोड़े अलग हो सकते हैं।",
  },
} as const;
type Language = keyof typeof languages;

// A short how-to for owners who do not know where their Google review link is, in English and Hindi.
export default function ReviewLinkHelp() {
  const [language, setLanguage] = useState<Language>("en");
  const copy = languages[language];
  return <details className={styles.help}>
    <summary><PlayCircle aria-hidden="true" /><span>Don’t know where to find your review link? Watch a short video<small>अपना रिव्यू लिंक कैसे ढूँढें, हिन्दी वीडियो भी उपलब्ध</small></span></summary>
    <div className={styles.body}>
      <div className={styles.tabs} role="group" aria-label="Video language">
        {(Object.keys(languages) as Language[]).map((code) => <button key={code} type="button" lang={code} aria-pressed={language === code} className={language === code ? styles.active : ""} onClick={() => setLanguage(code)}>{languages[code].label}</button>)}
      </div>
      <video key={language} className={styles.video} controls preload="metadata" playsInline poster={copy.poster} aria-label={copy.title}>
        <source src={copy.video} type="video/mp4" />
        <track kind="captions" src={copy.captions} srcLang={copy.captionLang} label={copy.label} />
      </video>
      <p className={styles.note} lang={language}>{copy.note}</p>
      <h3 lang={language}>{copy.title}</h3>
      <ol lang={language}>{copy.steps.map((step) => <li key={step}>{step}</li>)}</ol>
    </div>
  </details>;
}
