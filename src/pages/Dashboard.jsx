/**
 * dilbar — pages/Dashboard.jsx
 * ─────────────────────────────────────────────────────────────
 * The main report page shown after analysis completes.
 *
 * Connects all 9 report components and uses the selector
 * helpers from useAnalysis.js to pass only the right data
 * slice to each component.
 *
 * Navigation:
 *   The activePage prop from App.jsx controls which section
 *   is scrolled into view when a sidebar nav item is clicked.
 *   All sections are always rendered — just scrolled to.
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from "react";

import BondScoreCard  from "../components/BondScoreCard.jsx";
import GoodSidePanel  from "../components/GoodSidePanel.jsx";
import BadSidePanel   from "../components/BadSidePanel.jsx";
import EmojiEmotions  from "../components/EmojiEmotions.jsx";
import MoodGraph      from "../components/MoodGraph.jsx";
import Heatmap        from "../components/Heatmap.jsx";
import LoveLanguage   from "../components/LoveLanguage.jsx";
import TipCards       from "../components/TipCards.jsx";
import NarrativeCard  from "../components/NarrativeCard.jsx";

import {
  selectGoodSide,
  selectBadSide,
  selectCharts,
  selectEmojiPanel,
} from "../hooks/useAnalysis.js";

export default function Dashboard({ result, activePage }) {
  if (!result) return null;

  const { senders, anonymizedStats, loveLanguageResult, parseResult } = result;

  // ── Selector slices ──────────────────────────────────────
  const goodData  = selectGoodSide(result);
  const badData   = selectBadSide(result);
  const chartData = selectCharts(result);
  const emojiData = selectEmojiPanel(result);

  // ── Section refs for scroll-to navigation ────────────────
  const refs = {
    dashboard: useRef(null),
    good:      useRef(null),
    bad:       useRef(null),
    insights:  useRef(null),
    mood:      useRef(null),
    heatmap:   useRef(null),
    language:  useRef(null),
  };

  useEffect(() => {
    const ref = refs[activePage];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activePage]);

  return (
    <div className="dashboard-page">

      {/* ── OVERVIEW ─────────────────────────────────── */}
      <div ref={refs.dashboard}>
        <SectionHead
          title="Overview"
          sub={`${senders[0]} & ${senders[1]}`}
        />

        {/* Privacy banner */}
        <div className="privacy-banner">
          <i className="ti ti-shield-check" />
          Your chat was read entirely in your browser.
          No messages were uploaded or stored.
          Only anonymized statistics were sent to the AI.
        </div>

        {/* Bond score + factor breakdown */}
        <BondScoreCard
          bondResult={result.bondResult}
          senders={senders}
        />
      </div>

      {/* ── GOOD SIDE / BAD SIDE ─────────────────────── */}
      <div className="section-spacer" />
      <SectionHead title="Relationship Report" />

      <div className="report-grid">
        <div ref={refs.good}>
          <GoodSidePanel data={goodData} />
        </div>
        <div ref={refs.bad}>
          <BadSidePanel data={badData} />
        </div>
      </div>

      {/* ── EMOJI EMOTIONS ───────────────────────────── */}
      <div className="section-spacer" />
      <EmojiEmotions data={emojiData} />

      {/* ── ANALYTICS ────────────────────────────────── */}
      <div className="section-spacer" />
      <SectionHead
        title="Emotional Timeline"
        sub="Monthly mood across your relationship"
      />

      <div className="charts-grid">
        <div ref={refs.mood}>
          <MoodGraph data={chartData} senders={senders} />
        </div>
        <div ref={refs.heatmap}>
          <Heatmap data={chartData} messages={parseResult.messages} />
        </div>
      </div>

      {/* ── LOVE LANGUAGE ────────────────────────────── */}
      <div className="section-spacer" ref={refs.language}>
        <SectionHead
          title="Behavioural Insights"
          sub="Patterns beneath the surface"
        />
        <LoveLanguage
          loveLanguageResult={loveLanguageResult}
          senders={senders}
        />
      </div>

      {/* ── TIP CARDS ────────────────────────────────── */}
      <TipCards result={result} />

      {/* ── AI NARRATIVE ─────────────────────────────── */}
      <div ref={refs.insights}>
        <SectionHead
          title="AI Insights"
          sub="Written by dilbar's intelligence layer"
        />
        <NarrativeCard anonymizedStats={anonymizedStats} />
      </div>

    </div>
  );
}

// ── Section heading helper ───────────────────────────────────
function SectionHead({ title, sub }) {
  return (
    <div className="section-head">
      <div className="section-title">{title}</div>
      <div className="section-line" />
      {sub && <div className="section-sub">{sub}</div>}
    </div>
  );
}
