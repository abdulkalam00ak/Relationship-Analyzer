/**
 * dilbar — components/TipCards.jsx
 * ─────────────────────────────────────────────────────────────
 * Generates and displays 4 specific, actionable tip cards
 * based on the actual patterns found in the analysis.
 *
 * Tips are 100% rule-based — no AI required.
 * Each tip is derived from a real pattern in the data:
 *   - Recurring trigger words → specific replacement suggestion
 *   - Low balance score → initiation tip
 *   - Ghost patterns → silence tip
 *   - Love language mismatch → expression tip
 *   - Low bond score factors → improvement tip
 *
 * Props:
 *   result   AnalysisResult   — full result from useAnalysis
 * ─────────────────────────────────────────────────────────────
 */

export default function TipCards({ result }) {
  if (!result) return null;

  const tips = generateTips(result);

  if (tips.length === 0) return null;

  return (
    <div className="tips-section">
      <div className="section-head">
        <div className="section-title">Actionable Tips</div>
        <div className="section-line" />
        <div className="section-sub">Based on your specific patterns</div>
      </div>

      <div className="tips-grid">
        {tips.slice(0, 4).map((tip, i) => (
          <div
            key={i}
            className={`tip-card ${i % 2 === 1 ? "lav-tip" : ""}`}
          >
            <div className="tip-num">0{i + 1}</div>
            <div className="tip-title">{tip.title}</div>
            <div className="tip-body">{tip.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── TIP GENERATOR ───────────────────────────────────────────

function generateTips(result) {
  const tips = [];
  const {
    conflictResult,
    bondResult,
    loveLanguageResult,
    loveResult,
    senders,
  } = result;

  const [a, b] = senders;

  // ── Tip 1: Top trigger word replacement ──────────────────
  const topTrigger = conflictResult.triggerWords?.[0];
  if (topTrigger) {
    const mistakes = [
      ...(conflictResult.recurringMistakes?.[a] || []),
      ...(conflictResult.recurringMistakes?.[b] || []),
    ];
    const match = mistakes.find(m => m.phrase === topTrigger.word);

    tips.push({
      title: `Replace "${topTrigger.word}" — it appears before every fight`,
      body:  match?.suggestion ||
        `The word "${topTrigger.word}" has appeared ${topTrigger.count} times before conflicts. ` +
        `When the urge hits, pause for 60 seconds first. Write it, don't send it.`,
    });
  }

  // ── Tip 2: Conversation balance ───────────────────────────
  if (bondResult.balanceScore < 50) {
    const dominant = bondResult.dominantSender;
    const other    = dominant === a ? b : a;
    const share    = bondResult.perPerson[dominant]?.messageShare || 60;

    tips.push({
      title: `${other} should start conversations more often`,
      body:  `${dominant} initiates ${share}% of all conversations. Over time this imbalance ` +
             `creates quiet resentment. One good-morning message from ${other} each day can shift this completely.`,
    });
  }

  // ── Tip 3: Silence / ghost pattern ───────────────────────
  const conflictA = conflictResult.perPerson[a];
  const conflictB = conflictResult.perPerson[b];
  const ghostier  = (conflictA?.coldReplyCount || 0) >= (conflictB?.coldReplyCount || 0) ? a : b;
  const ghostCount = Math.max(
    conflictA?.coldReplyCount || 0,
    conflictB?.coldReplyCount || 0
  );

  if (ghostCount >= 3) {
    tips.push({
      title: `${ghostier} — one-word replies are louder than you think`,
      body:  `${ghostier} sent cold one-word replies (ok, fine, hmm) ${ghostCount} times. ` +
             `Even "I'm upset but I'm still here" is infinitely better than silence. It keeps the door open.`,
    });
  } else if (conflictResult.longestSilence?.hours >= 4) {
    tips.push({
      title: "Reduce silence after conflict",
      body:  `Your longest post-conflict silence was ${conflictResult.longestSilence.hours} hours. ` +
             `A single message — even "I need time but I'm not going anywhere" — cuts recovery time in half.`,
    });
  }

  // ── Tip 4: Love language mismatch ────────────────────────
  const compat = loveLanguageResult?.compatibility;
  if (compat && compat.score < 65) {
    const llA = loveLanguageResult.perPerson[a]?.primaryName;
    const llB = loveLanguageResult.perPerson[b]?.primaryName;
    tips.push({
      title: `${a} and ${b} speak different love languages`,
      body:  `${a} expresses love through ${llA}, while ${b} uses ${llB}. ` +
             `Both are loving — but in ways the other might not fully recognize. ` +
             `Try expressing love in your partner's language once a day, not just your own.`,
    });
  }

  // ── Tip 5: Bond depth fallback ────────────────────────────
  if (tips.length < 4 && bondResult.factors.depth.score < 55) {
    tips.push({
      title: "Go deeper in your conversations",
      body:  `Your average message length is ${bondResult.factors.depth.raw} words. ` +
             `The strongest bonds are built in long conversations, not just quick check-ins. ` +
             `Try asking one open-ended question per day instead of "how are you".`,
    });
  }

  // ── Tip 6: Peak month insight ─────────────────────────────
  if (tips.length < 4 && loveResult.peakMonth) {
    tips.push({
      title: "Revisit your most loving period",
      body:  `${formatMonthLabel(loveResult.peakMonth)} was your most loving month. ` +
             `Think about what was different then — more time together, fewer stressors, ` +
             `shared plans. Those conditions are worth recreating intentionally.`,
    });
  }

  return tips;
}

function formatMonthLabel(key) {
  if (!key) return "";
  const [year, month] = key.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}
