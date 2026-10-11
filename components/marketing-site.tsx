"use client";

import Link from "next/link";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, BarChart3, Baby, BedDouble, Building2, Check, ChevronDown, Coffee, Download, Dumbbell, GraduationCap, HeartPulse, LineChart, MapPin, Backpack, Palette, QrCode, RotateCw, ScanLine, Scissors, ShieldCheck, Sparkles, Sprout, Star, Store, Trophy, UtensilsCrossed } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { pricingPlans } from "@/lib/marketing-config";
import { legal, legalLinks } from "@/lib/legal-config";
import styles from "./marketing-site.module.css";

const businessTypes = [
  { key: "restaurants", single: "Restaurant", label: "Restaurants", Icon: UtensilsCrossed, dark: "#962318", accent: "#e0701c", light: "#fcf6e8", line: "Loved the food? Tell us!" },
  { key: "cafes", single: "Café", label: "Cafés", Icon: Coffee, dark: "#3b2418", accent: "#c68b59", light: "#f6ebdd", line: "Loved your coffee? Tell the world" },
  { key: "hotels", single: "Hotel", label: "Hotels", Icon: BedDouble, dark: "#14213d", accent: "#c9a227", light: "#faf6ec", line: "How was your stay with us?" },
  { key: "pg", single: "PG", label: "PG", Icon: Building2, dark: "#0f766e", accent: "#f59e0b", light: "#f4faf8", line: "Feels like home? Say so" },
  { key: "salons", single: "Salon", label: "Salons", Icon: Scissors, dark: "#6b2c5e", accent: "#e8a0bf", light: "#fdf3f7", line: "Love your new look? Tell us" },
  { key: "clinics", single: "Clinic", label: "Clinics", Icon: HeartPulse, dark: "#0b5fa5", accent: "#19a7a8", light: "#f2f8fc", line: "Your feedback helps us care better" },
  { key: "coaching", single: "Coaching centre", label: "Coaching", Icon: GraduationCap, dark: "#3730a3", accent: "#fbbf24", light: "#f7f7ff", line: "Share your learning experience" },
  { key: "nurseries", single: "Plant nursery", label: "Nurseries", Icon: Sprout, dark: "#1e5434", accent: "#8bc34a", light: "#eef4e2", line: "Help our little nursery grow" },
  { key: "daycare", single: "Day care", label: "Day care", Icon: Baby, dark: "#0369a1", accent: "#fdba74", light: "#fff8ec", line: "Happy kids, happy parents?" },
  { key: "preschools", single: "Preschool", label: "Preschools", Icon: Backpack, dark: "#1d4ed8", accent: "#facc15", light: "#fffbea", line: "Tell other parents about us" },
  { key: "gyms", single: "Gym", label: "Gyms", Icon: Dumbbell, dark: "#111827", accent: "#a3e635", light: "#f5f7ef", line: "Did we make you sweat? Say it here" },
] as const;

const features = [
  { Icon: QrCode, title: "One QR, straight to Google", text: "Customers scan and land on your Google review page. No app, no sign-up on their side.", wide: true },
  { Icon: Palette, title: "QR Studio cards", text: "A print-ready card designed for your business type, with your name, your photo and a line of your choice.", wide: true },
  { Icon: LineChart, title: "Scan analytics", text: "Daily scan counts over 7, 30, 90 days or your own dates." },
  { Icon: Star, title: "Rating tracking", text: "Current Google rating and review count, with the change over time." },
  { Icon: MapPin, title: "Local rankings", text: "Compare yourself with nearby businesses of your own type within 1, 3 or 5 km." },
  { Icon: ShieldCheck, title: "Privacy first", text: "Scans are counted per day, without storing who scanned." },
  { Icon: Store, title: "Several locations", text: "Manage more than one business from one account.", soon: true, wide: true },
  { Icon: BarChart3, title: "Automated reports", text: "A recurring summary of your activity.", soon: true, wide: true },
] as const;

const faqs: Array<[string, ReactNode]> = [
  ["Does the QR code really open my Google review page?", "Yes. You paste your Google review link once, and the QR code sends customers to it. You can change the link later in Settings, and the printed code keeps working."],
  ["What does the QR card include?", "Your business name, a design chosen for your business type, an optional photo of your place, a centre badge, and a line under the code. Pick from 50+ ready-made lines in funny, friendly or professional styles, or write your own."],
  ["Is the QR card safe to print?", "Yes. Every card is checked to make sure it scans before you can download it."],
  ["How do the local rankings work?", "We use Google Places to list nearby businesses of your own type within 1, 3 or 5 km, with their Google ratings and review counts. It will not match a Google search exactly, because Google search uses its own relevance rules."],
  ["Which businesses is it for?", "Any local business that customers can review on Google. That includes restaurants, clubs, gyms, salons, cafés, hotels, clinics, coaching centres, plant nurseries, day care centres, preschools, PGs and more. Pick the closest type, or choose Other. Local rankings are not available for Other."],
  ["What happens to my customers' data?", "We count scans per day and do not store who scanned alongside those counts. Your photo is stripped of metadata and stored compressed, and you can remove it at any time."],
  ["Do I need access to my Google Business Profile?", "No. You only need your public Google review link. A Business Profile connection is on our roadmap, not required today."],
  ["What does it cost?", <>It is free while we are in early access. See the <a href="#pricing">Pricing</a> section for details.</>],
  ["Where can I read your terms and privacy policy?", <>Right here: <Link href="/terms">Terms of Service</Link>, <Link href="/privacy">Privacy Policy</Link>, <Link href="/cookies">Cookie Policy</Link> and <Link href="/acceptable-use">Acceptable Use &amp; Reviews Policy</Link>.</>],
];

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 28 }} whileInView={reduced ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}

function glowMove(event: ReactPointerEvent<HTMLElement>) {
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--gx", `${event.clientX - box.left}px`);
  event.currentTarget.style.setProperty("--gy", `${event.clientY - box.top}px`);
}

function CountUp({ to, suffix = "", prefix = "", decimals = 0 }: { to: number; suffix?: string; prefix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null); const inView = useInView(ref, { once: true, amount: 0.6 }); const reduced = useReducedMotion();
  const show = (value: number) => `${prefix}${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  useEffect(() => {
    if (!inView || !ref.current) return;
    if (reduced) { ref.current.textContent = show(to); return; }
    const controls = animate(0, to, { duration: 1.8, ease: "easeOut", onUpdate: (value) => { if (ref.current) ref.current.textContent = show(value); } });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced, to, suffix, prefix, decimals]);
  return <span ref={ref}>{reduced ? show(to) : show(0)}</span>;
}

function TiltCard() {
  const reduced = useReducedMotion();
  const x = useMotionValue(0); const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [9, -9]), { stiffness: 140, damping: 16 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-11, 11]), { stiffness: 140, damping: 16 });
  const move = (event: ReactPointerEvent<HTMLDivElement>) => { if (reduced) return; const box = event.currentTarget.getBoundingClientRect(); x.set((event.clientX - box.left) / box.width - 0.5); y.set((event.clientY - box.top) / box.height - 0.5); };
  const leave = () => { x.set(0); y.set(0); };
  return <div className={styles.tiltStage} onPointerMove={move} onPointerLeave={leave}>
    <motion.div className={styles.tilt} style={reduced ? undefined : { rotateX, rotateY }}>
      <img src="/landing/sample-qr.jpg" alt="Sample QR review card for a restaurant" width={840} height={1134} fetchPriority="high" />
      <span className={styles.sheen} aria-hidden="true" />
    </motion.div>
    <span className={`${styles.chip} ${styles.chipA}`}><Star /> 4.8 rating <small>sample</small></span>
    <span className={`${styles.chip} ${styles.chipB}`}><ScanLine /> +128 scans this week <small>sample</small></span>
    <span className={`${styles.chip} ${styles.chipC}`}><Check /> Checked to scan</span>
  </div>;
}

function FlipCard({ index, title, text, Icon, flipped, onToggle, onHover, back, hint }: { index: string; title: string; text: string; Icon: typeof Store; flipped: boolean; onToggle: () => void; onHover: (hovering: boolean) => void; back: ReactNode; hint: string }) {
  // Mouse hover turns the card over; touch and keyboard users tap or press it instead.
  return <button type="button" className={`${styles.flip} ${flipped ? styles.isFlipped : ""}`} onClick={onToggle} onPointerEnter={(event) => { if (event.pointerType === "mouse") onHover(true); }} onPointerLeave={(event) => { if (event.pointerType === "mouse") onHover(false); }} aria-pressed={flipped} aria-label={`${title}. ${flipped ? "Showing the preview. Press to go back." : hint}`}>
    <span className={styles.flipInner}>
      <span className={`${styles.face} ${styles.front}`} aria-hidden={flipped}><em>{index}</em><i><Icon /></i><strong>{title}</strong><span>{text}</span><small><RotateCw /> {hint}</small></span>
      <span className={`${styles.face} ${styles.backFace}`} aria-hidden={!flipped}>{back}</span>
    </span>
  </button>;
}

function MiniDashboard() {
  const bars = [38, 52, 44, 66, 58, 82, 74];
  return <span className={styles.dash}>
    <span className={styles.dashTop}><b>Sample dashboard</b><small>Last 7 days</small></span>
    <span className={styles.dashStats}><span><small>Rating</small><b>4.8</b></span><span><small>Scans</small><b>128</b></span><span><small>New reviews</small><b>+9</b></span></span>
    <svg viewBox="0 0 200 70" className={styles.dashLine} aria-hidden="true"><defs><linearGradient id="dashFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity=".45" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient></defs><path d="M0 52 L30 44 L60 48 L90 30 L120 36 L150 18 L200 10 L200 70 L0 70Z" fill="url(#dashFill)" /><path className={styles.dashPath} d="M0 52 L30 44 L60 48 L90 30 L120 36 L150 18 L200 10" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <span className={styles.dashBars}>{bars.map((height, position) => <i key={position} style={{ "--h": `${height}%`, "--d": `${position * 70}ms` } as CSSProperties} />)}</span>
  </span>;
}

function HowItWorks() {
  const reduced = useReducedMotion();
  const [pinned, setPinned] = useState([false, false, false]); const [hovered, setHovered] = useState([false, false, false]);
  const flipped = pinned.map((value, index) => value || hovered[index]);
  const secondRef = useRef<HTMLDivElement>(null); const secondVisible = useInView(secondRef, { once: true, amount: 0.7 });
  const toggle = (index: number) => setPinned((state) => state.map((value, position) => position === index ? !value : value));
  // A short pause before turning over, so a mouse passing across the tiles does not make them flicker.
  const hoverTimers = useRef<Array<number | undefined>>([]);
  const hover = (index: number, value: boolean) => {
    window.clearTimeout(hoverTimers.current[index]);
    const apply = () => setHovered((state) => state.map((current, position) => position === index ? value : current));
    if (value) hoverTimers.current[index] = window.setTimeout(apply, 220); else apply();
  };
  // The QR card flips by itself the first time it scrolls into view, then stays under the visitor's control.
  useEffect(() => { if (!secondVisible || reduced) return; const timer = window.setTimeout(() => setPinned((state) => [state[0], true, state[2]]), 700); return () => window.clearTimeout(timer); }, [secondVisible, reduced]);
  return <section id="how-it-works" className={styles.section}>
    <Reveal><p className={styles.eyebrow}>HOW IT WORKS</p><h2>From counter to customer feedback in three steps.</h2><p className={styles.intro}>Hover or tap a card to peek behind it.</p></Reveal>
    <div className={styles.flipGrid}>
      <Reveal><FlipCard index="01" title="Add your business" text="Save your business name, type and Google review link." Icon={Store} flipped={flipped[0]} onToggle={() => toggle(0)} onHover={(value) => hover(0, value)} hint="Tap to see an example" back={<><img src="/landing/restaurant.webp" alt="" width={800} height={1000} loading="lazy" /><span className={styles.photoShade} /><span className={styles.caption}><b>Your place, your look</b>Sample photo of a restaurant</span></>} /></Reveal>
      <Reveal delay={0.08}><div ref={secondRef} className={styles.flipHolder}><FlipCard index="02" title="Download your QR card" text="A print-ready card with your name, photo and QR." Icon={Download} flipped={flipped[1]} onToggle={() => toggle(1)} onHover={(value) => hover(1, value)} hint="Tap to see a sample card" back={<><img className={styles.contain} src="/landing/sample-qr-bold.jpg" alt="Sample QR card for a café" width={840} height={1134} loading="lazy" /><span className={styles.sampleTag}>Sample card</span></>} /></div></Reveal>
      <Reveal delay={0.16}><FlipCard index="03" title="Watch the activity" text="See scans and your Google rating in one dashboard." Icon={LineChart} flipped={flipped[2]} onToggle={() => toggle(2)} onHover={(value) => hover(2, value)} hint="Tap to see a sample dashboard" back={<MiniDashboard />} /></Reveal>
    </div>
  </section>;
}

function ScanDemo() {
  const [scanned, setScanned] = useState(false); const [scans, setScans] = useState(12); const reduced = useReducedMotion();
  useEffect(() => { if (!scanned) return; const timer = window.setTimeout(() => setScanned(false), 3200); return () => window.clearTimeout(timer); }, [scanned]);
  return <section className={styles.section}>
    <div className={styles.demoGrid}>
      <Reveal><p className={styles.eyebrow}>TRY IT</p><h2>This is what your customer sees.</h2><p className={styles.intro}>Point a phone at the card. A moment later they are on your Google review page, and you have one more scan in your dashboard.</p><button className={styles.primary} onClick={() => { if (!scanned) { setScanned(true); setScans((value) => value + 1); } }} disabled={scanned}><ScanLine />{scanned ? "Scan recorded" : "Simulate a scan"}</button><p className={styles.fine}>Sample data. A scan counts a visit to your review link, not a finished review.</p></Reveal>
      <Reveal delay={0.1}><div className={styles.phoneWrap}>
        <div className={styles.phone}><i className={styles.notch} /><AnimatePresence mode="wait">
          {scanned ? <motion.div key="review" className={styles.reviewScreen} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}><b>G</b><strong>Rate your experience</strong><p>Saffron Table</p><div>{Array.from({ length: 5 }, (_, index) => <motion.span key={index} initial={reduced ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15 + index * 0.08, type: "spring", stiffness: 300 }}><Star /></motion.span>)}</div><span className={styles.fakeButton}>Write a review</span></motion.div>
          : <motion.div key="qr" className={styles.qrScreen} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><img src="/landing/sample-qr.jpg" alt="Sample QR card on a phone camera" width={840} height={1134} loading="lazy" /></motion.div>}
        </AnimatePresence>{scanned && !reduced ? <motion.i className={styles.scanLine} initial={{ top: "10%" }} animate={{ top: "88%" }} transition={{ duration: 0.9 }} /> : null}</div>
        <div className={styles.counter}><small>Scans today (sample)</small><b>{scans}</b></div>
      </div></Reveal>
    </div>
  </section>;
}

function TypePicker() {
  const [active, setActive] = useState(0); const type = businessTypes[active];
  const size = 13;
  const cells = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size), column = index % size;
    for (const [fr, fc] of [[0, 0], [0, size - 5], [size - 5, 0]]) {
      const r = row - fr, c = column - fc;
      if (r >= 0 && r < 5 && c >= 0 && c < 5) return r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2);
      if (r >= -1 && r <= 5 && c >= -1 && c <= 5) return false;
    }
    if (Math.abs(row - 6) <= 2 && Math.abs(column - 6) <= 2) return false;
    return ((row * 31 + column * 17 + row * column * 7 + active * 13) % 5) < 2;
  });
  return <section className={styles.section}>
    <Reveal><p className={styles.eyebrow}>BUILT FOR YOUR BUSINESS</p><h2>Pick a business type. The card follows.</h2><p className={styles.intro}>Your QR card is designed automatically for your type of business, with matching colours, a centre badge and ready-made lines.</p></Reveal>
    <div className={styles.typeGrid}>
      <div className={styles.typeList} role="tablist" aria-label="Business types">{businessTypes.map((item, index) => <button key={item.key} role="tab" aria-selected={index === active} className={index === active ? styles.typeOn : ""} onClick={() => setActive(index)} onPointerEnter={() => setActive(index)}><item.Icon />{item.label}</button>)}</div>
      <div className={styles.typePreview} style={{ "--dark": type.dark, "--accent": type.accent, "--light": type.light } as CSSProperties}>
        <motion.div key={type.key} className={styles.miniCard} initial={{ opacity: 0, rotateY: -70, scale: 0.92 }} animate={{ opacity: 1, rotateY: 0, scale: 1 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
          <b>YOUR {type.single.toUpperCase()}</b><span className={styles.miniQr}><span className={styles.miniGrid}>{cells.map((on, index) => <i key={index} className={on ? styles.on : ""} />)}</span><span className={styles.badge}><type.Icon /></span></span><em>SCAN &amp; REVIEW</em><small>{type.line}</small>
        </motion.div>
        <span className={styles.fine}>Sample preview. Real cards use your business name and photo.</span>
      </div>
    </div>
  </section>;
}

function Rankings() {
  const rows = [["Brew Lane", 4.7, 92], ["Your business", 4.6, 88], ["The Corner Cup", 4.5, 84], ["Daily Grind", 4.3, 74], ["Bean Street", 4.1, 66]] as const;
  return <section className={styles.section}>
    <div className={styles.rankGrid}>
      <Reveal><p className={styles.eyebrow}>LOCAL RANKINGS</p><h2>Know where you stand nearby.</h2><p className={styles.intro}>Compare Google ratings and review counts with businesses of your own type within 1, 3 or 5 km. Results come from Google Places and are refreshed daily.</p><ul className={styles.ticks}><li><Check /> Up to 20 nearby businesses</li><li><Check /> Sort by rating, reviews or distance</li><li><Check /> Always your own business type</li></ul></Reveal>
      <Reveal delay={0.1}><div className={styles.rankCard}><span className={styles.tag}>Sample data</span>{rows.map(([name, rating, width], index) => <div key={name} className={`${styles.rankRow} ${name === "Your business" ? styles.me : ""}`}><span className={styles.rankNo}>{index === 0 ? <Trophy /> : index + 1}</span><b>{name}</b><span className={styles.bar}><motion.i initial={{ width: 0 }} whileInView={{ width: `${width}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.15 + index * 0.1, ease: "easeOut" }} /></span><em>{rating.toFixed(1)}</em></div>)}</div></Reveal>
    </div>
  </section>;
}

export default function MarketingSite() {
  const [openFaq, setOpenFaq] = useState(0); const reduced = useReducedMotion(); const siteRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll(); const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  useEffect(() => {
    const node = siteRef.current; if (!node || reduced || !window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0; const move = (event: PointerEvent) => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { node.style.setProperty("--cx", `${event.clientX}px`); node.style.setProperty("--cy", `${event.clientY}px`); }); };
    window.addEventListener("pointermove", move, { passive: true }); return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(frame); };
  }, [reduced]);
  return <main ref={siteRef} className={styles.site}>
    <motion.i className={styles.progress} style={{ scaleX: progress }} aria-hidden="true" />
    <div className={styles.aurora} aria-hidden="true"><i /><i /><i /></div><div className={styles.grid} aria-hidden="true" /><div className={styles.cursor} aria-hidden="true" />
    <header className={styles.nav}><Link href="/" className={styles.logo}><span>✦</span> PrimeReviews</Link><nav aria-label="Main"><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></nav><div><Link href="/login">Log in</Link><Link className={styles.primary} href="/signup">Start free <ArrowRight /></Link></div></header>
    <section className={styles.hero}>
      <Reveal className={styles.heroText}><p className={styles.eyebrow}><Sparkles /> REVIEWS, WITHOUT THE AWKWARD ASK</p><h1>Turn happy customers into <em>Google reviews</em> with one scan.</h1><p className={styles.heroCopy}>Print a QR card made for your business. Customers scan it and land on your Google review page, and you see every scan and your rating in one dashboard.</p><div className={styles.heroButtons}><Link className={styles.primary} href="/signup">Start free <ArrowRight /></Link><a className={styles.secondary} href="#how-it-works">See how it works</a></div><p className={styles.assurance}><Check /> Free in early access. No credit card. Ready in minutes.</p></Reveal>
      <Reveal delay={0.15} className={styles.heroArt}><TiltCard /></Reveal>
    </section>
    <section className={styles.facts} aria-label="Sample dashboard numbers"><Reveal><div><b><CountUp to={2480} /></b><span>QR scans this month</span></div><div><b><CountUp to={1284} /></b><span>Google reviews</span></div><div><b><CountUp to={4.8} decimals={1} /></b><span>average rating</span></div><div><b><CountUp to={126} prefix="+" /></b><span>new reviews this month</span></div></Reveal><p>Sample numbers, to show the kind of growth your dashboard tracks.</p></section>
    <HowItWorks />
    <Rankings />
    <ScanDemo />
    <TypePicker />
    <section id="features" className={styles.section}><Reveal><p className={styles.eyebrow}>EVERYTHING YOU NEED</p><h2>The essentials of review collection, done well.</h2><p className={styles.intro}>Only what works today is promised here. What is still on the way is marked.</p></Reveal><div className={styles.bento}>{features.map((feature, index) => <Reveal key={feature.title} delay={(index % 4) * 0.05} className={"wide" in feature && feature.wide ? styles.wide : ""}><article className={styles.feature} onPointerMove={glowMove}><div><feature.Icon /></div>{"soon" in feature && feature.soon ? <span className={styles.soon}>Coming soon</span> : null}<h3>{feature.title}</h3><p>{feature.text}</p></article></Reveal>)}</div></section>
    <section id="pricing" className={styles.section}><Reveal><p className={styles.eyebrow}>PRICING</p><h2>Free while we are in early access.</h2><p className={styles.intro}>No prices have been set for paid plans yet. We will tell you before anything changes.</p></Reveal><div className={styles.plans}>{pricingPlans.map((plan, index) => <Reveal key={plan.name} delay={index * 0.08}><article className={`${styles.plan} ${plan.featured ? styles.featured : ""}`} onPointerMove={glowMove}>{plan.featured ? <b className={styles.recommended}>Available now</b> : null}<h3>{plan.name}</h3><p>{plan.description}</p><strong>{plan.price}<small>{plan.period}</small></strong>{plan.features.length ? <ul>{plan.features.map((item) => <li key={item}><Check />{item}</li>)}</ul> : null}{plan.comingSoon ? <button className={styles.secondary} disabled>Coming soon</button> : <Link className={styles.primary} href="/signup">{plan.cta} <ArrowRight /></Link>}</article></Reveal>)}</div></section>
    <section id="faq" className={`${styles.section} ${styles.faqs}`}><Reveal><p className={styles.eyebrow}>FAQ</p><h2>Honest answers before you start.</h2></Reveal><div className={styles.faqList}>{faqs.map(([question, answer], index) => <article key={question} className={openFaq === index ? styles.open : ""}><button aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>{question}<ChevronDown /></button><AnimatePresence initial={false}>{openFaq === index ? <motion.div className={styles.answer} initial={reduced ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduced ? undefined : { height: 0, opacity: 0 }} transition={{ duration: 0.3 }}><p>{answer}</p></motion.div> : null}</AnimatePresence></article>)}</div></section>
    <section className={styles.cta}><Reveal><p className={styles.eyebrow}>READY WHEN YOU ARE</p><h2>Make the next happy customer count.</h2><p>Create your QR card in minutes. Free while we are in early access.</p><Link className={styles.primary} href="/signup">Start free <ArrowRight /></Link></Reveal></section>
    <footer className={styles.footer}><Link href="/" className={styles.logo}><span>✦</span> PrimeReviews</Link><div><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#faq">FAQ</a><Link href="/login">Log in</Link><Link href="/signup">Sign up</Link></div><nav className={styles.legalRow} aria-label="Legal">{legalLinks.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav><p>© {new Date().getFullYear()} {legal.productName}. PrimeReviews is not affiliated with, endorsed by or sponsored by Google. A scan is a visit to your review link, not a finished review.</p></footer>
  </main>;
}
