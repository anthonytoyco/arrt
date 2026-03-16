"use client";

import { useState } from "react";
import { RiskBadge } from "@/components/RiskBadge";
import { AIExplanationCard } from "@/components/AIExplanationCard";
import type {
  SanctionsResponse,
  AnomaliesResponse,
  GeoRiskResponse,
} from "@/lib/api";

type Props =
  | { type: "sanctions"; data: SanctionsResponse }
  | { type: "anomalies"; data: AnomaliesResponse }
  | { type: "georisk"; data: GeoRiskResponse };

function SanctionsTable({ data }: { data: SanctionsResponse }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div className="border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-foreground uppercase tracking-wider">
          Sanctions scan results
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {data.flagged} of {data.total_entities} flagged
        </span>
      </div>
      {data.results.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">No matches found.</p>
      ) : (
        <table className="w-full text-xs table-fixed">
          <thead className="bg-accent text-[10px] text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium w-[22%]">Entity</th>
              <th className="px-4 py-2.5 text-left font-medium w-[14%]">Country</th>
              <th className="px-4 py-2.5 text-left font-medium w-[12%]">Sanctions</th>
              <th className="px-4 py-2.5 text-left font-medium w-[18%]">Country risk</th>
              <th className="px-4 py-2.5 text-left font-medium w-[34%]">List / Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.results.map((r, i) => {
              const aiKey = `${i}-ai`;
              const geoKey = `${i}-geo`;
              const hasAi = !!r.ai_explanation?.trim();
              const hasGeo = !!r.geo_briefing?.trim();
              return (
                <>
                  <tr key={i} className="hover:bg-accent/50">
                    <td className="px-4 py-3 font-medium text-foreground truncate">{r.uploaded_name}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate">{r.country ?? "—"}</td>
                    <td className="px-4 py-3">
                      <RiskBadge level={r.risk_level} />
                    </td>
                    <td className="px-4 py-3">
                      {r.geo_risk_level != null ? (
                        <span className="flex items-center gap-1.5">
                          <RiskBadge level={r.geo_risk_level} />
                          {r.geo_risk_score != null && (
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {r.geo_risk_score}/100
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-muted-foreground truncate">{r.sanctions_list || "—"}</div>
                      <div className="text-[10px] text-foreground/80 mt-0.5">{r.action}</div>
                      <div className="flex gap-3 mt-1.5">
                        {hasAi && (
                          <button
                            onClick={() => toggle(aiKey)}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 uppercase tracking-wider transition-colors"
                          >
                            {expanded.has(aiKey) ? "Hide" : "Show"} AI explanation
                            <span>{expanded.has(aiKey) ? "—" : "+"}</span>
                          </button>
                        )}
                        {hasGeo && (
                          <button
                            onClick={() => toggle(geoKey)}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 uppercase tracking-wider transition-colors"
                          >
                            {expanded.has(geoKey) ? "Hide" : "Show"} Geo briefing
                            <span>{expanded.has(geoKey) ? "—" : "+"}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded.has(aiKey) && (
                    <tr key={`${i}-ai-row`} className="bg-accent/30">
                      <td colSpan={5} className="px-4 py-3 text-xs text-foreground/70 leading-relaxed border-t border-border">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-2">AI explanation</span>
                        {r.ai_explanation}
                      </td>
                    </tr>
                  )}
                  {expanded.has(geoKey) && (
                    <tr key={`${i}-geo-row`} className="bg-accent/30">
                      <td colSpan={5} className="px-4 py-3 text-xs text-foreground/70 leading-relaxed border-t border-border">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-2">Geo risk briefing</span>
                        {r.geo_briefing}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AnomaliesTable({ data }: { data: AnomaliesResponse }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-foreground uppercase tracking-wider">
          Anomaly Detection Results
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {data.flagged} of {data.total_transactions} flagged
        </span>
      </div>
      {data.results.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">No anomalies detected.</p>
      ) : (
        <table className="w-full text-xs table-fixed">
          <thead className="bg-accent text-[10px] text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium w-[13%]">Date</th>
              <th className="px-4 py-2.5 text-left font-medium w-[20%]">Vendor</th>
              <th className="px-4 py-2.5 text-right font-medium w-[12%]">Amount</th>
              <th className="px-4 py-2.5 text-left font-medium w-[15%]">Score</th>
              <th className="px-4 py-2.5 text-left font-medium w-[10%]">Risk</th>
              <th className="px-4 py-2.5 text-left font-medium w-[30%]">Reasons</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.results.map((r, i) => {
              const hasAi = !!r.ai_explanation?.trim();
              return (
                <>
                  <tr key={i} className="hover:bg-accent/50">
                    <td className="px-4 py-3 text-muted-foreground font-mono truncate">{r.date}</td>
                    <td className="px-4 py-3 font-medium text-foreground truncate">{r.vendor}</td>
                    <td className="px-4 py-3 text-right font-mono">${r.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-accent h-1 rounded-full relative">
                          <div
                            className={`h-1 rounded-full absolute top-0 left-0 ${r.anomaly_score >= 0.8 ? "bg-red-500" : r.anomaly_score >= 0.6 ? "bg-orange-400" : r.anomaly_score >= 0.4 ? "bg-yellow-400" : "bg-green-400"}`}
                            style={{ width: `${Math.min(100, r.anomaly_score * 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-mono ${r.anomaly_score >= 0.8 ? "text-red-500" : r.anomaly_score >= 0.6 ? "text-orange-400" : r.anomaly_score >= 0.4 ? "text-yellow-500" : "text-green-500"}`}>
                          {Math.min(100, r.anomaly_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge level={r.risk_level} />
                    </td>
                    <td className="px-4 py-3">
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {r.reasons.map((reason, j) => (
                          <li key={j}>— {reason}</li>
                        ))}
                      </ul>
                      {hasAi && (
                        <button
                          onClick={() => toggle(i)}
                          className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 uppercase tracking-wider transition-colors"
                        >
                          {expanded.has(i) ? "Hide" : "Show"} AI explanation
                          <span>{expanded.has(i) ? "—" : "+"}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded.has(i) && (
                    <tr key={`${i}-ai-row`} className="bg-accent/30">
                      <td colSpan={6} className="px-4 py-3 text-xs text-foreground/70 leading-relaxed border-t border-border">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-2">AI explanation</span>
                        {r.ai_explanation}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function ResultsTable(props: Props) {
  if (props.type === "sanctions") {
    return <SanctionsTable data={props.data} />;
  }

  if (props.type === "anomalies") {
    return <AnomaliesTable data={props.data} />;
  }

  // georisk
  const { data } = props;
  return (
    <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
      {data.results.map((r, i) => (
        <div key={i} className="bg-card p-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-semibold text-foreground">{r.country}</h3>
            <RiskBadge level={r.risk_level} />
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
              <span>Risk score</span>
              <span className="font-mono text-foreground">{r.risk_score}/100</span>
            </div>
            <div className="w-full bg-accent h-1 rounded-full relative">
              <div
                className={`h-1 rounded-full absolute top-0 left-0 ${r.risk_score >= 80 ? "bg-red-500" :
                  r.risk_score >= 60 ? "bg-orange-400" :
                    r.risk_score >= 40 ? "bg-yellow-400" :
                      "bg-green-400"
                  }`}
                style={{ width: `${r.risk_score}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Conflict events (90d)</p>
              <p className="font-mono text-foreground">{r.conflict_events_90d}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fatalities (90d)</p>
              <p className="font-mono text-foreground">{r.fatalities_90d}</p>
            </div>
          </div>
          <AIExplanationCard explanation={r.ai_briefing} />
        </div>
      ))}
    </div>
  );
}
