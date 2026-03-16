"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ResultsTable } from "@/components/ResultsTable";
import { Shield, Globe, Send } from "lucide-react";
import type { SanctionsResponse, GeoRiskResponse } from "@/lib/api";
import { sendChat } from "@/lib/api";

interface GeoSanctionsTabProps {
  hasEntities: boolean;
  entityCount: number;
  onRunScan: () => void;
  sanctionsLoading: boolean;
  geoRiskLoading: boolean;
  sanctionsData: SanctionsResponse | null;
  geoRiskData: GeoRiskResponse | null;
}

export function GeoSanctionsTab({
  hasEntities,
  entityCount,
  onRunScan,
  sanctionsLoading,
  geoRiskLoading,
  sanctionsData,
  geoRiskData,
}: GeoSanctionsTabProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  async function handleAskQuestion() {
    if (!question.trim()) return;
    setChatLoading(true);
    setAnswer(null);
    try {
      const sanctionsSummary = sanctionsData
        ? `${sanctionsData.flagged} of ${sanctionsData.total_entities} entities flagged. ` +
          sanctionsData.results
            .filter((r) => r.risk_level !== "LOW")
            .slice(0, 5)
            .map((r) => `${r.uploaded_name}: ${r.risk_level} (${(r.confidence * 100).toFixed(0)}% confidence, ${r.sanctions_list})`)
            .join(". ")
        : undefined;
      const geoSummary = geoRiskData
        ? geoRiskData.results
            .map((r) => `${r.country}: ${r.risk_level} (${r.risk_score}/100)`)
            .join(". ")
        : undefined;
      const response = await sendChat({
        message: question,
        context: { sanctions_summary: sanctionsSummary, geo_summary: geoSummary },
      });
      setAnswer(response);
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "Failed to get response.");
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[1fr_2fr] gap-px bg-border">
        <div className="bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 border border-border flex items-center justify-center">
              <Shield className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Geo &amp; Sanctions
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Run scan on your entity list
              </p>
            </div>
          </div>

          {hasEntities ? (
            <>
              <p className="text-xs text-muted-foreground">
                {entityCount} entit{entityCount !== 1 ? "ies" : "y"} from the Entity tab
              </p>
              <Button
                className="w-full"
                disabled={sanctionsLoading || geoRiskLoading}
                onClick={onRunScan}
              >
                {sanctionsLoading || geoRiskLoading ? "Scanning..." : "Run Scan"}
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add entities in the <strong>Entity</strong> tab, then return here to run sanctions and geo risk scan.
            </p>
          )}
        </div>

        <div className="bg-card p-6 flex flex-col min-h-0">
          {(sanctionsData || geoRiskData) ? (
            <div className="overflow-auto">
              {sanctionsData && (
                <ResultsTable type="sanctions" data={sanctionsData} />
              )}
              {!sanctionsData && geoRiskData && (
                <ResultsTable type="georisk" data={geoRiskData} />
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground flex-1 flex flex-col items-center justify-center">
              <Globe className="h-6 w-6 mb-3 opacity-30" />
              <p className="text-xs uppercase tracking-wider">
                {hasEntities
                  ? "Run scan above to see sanctions and geo risk results."
                  : "Add entities in the Entity tab to run scan."}
              </p>
            </div>
          )}
        </div>
      </div>
      {(sanctionsData || geoRiskData) && (
        <div className="bg-card border border-border p-6 space-y-3">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Ask AI</p>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-background border border-border text-sm px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Ask about sanctions hits, geo risk, or specific entities..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
              disabled={chatLoading}
            />
            <Button size="sm" onClick={handleAskQuestion} disabled={chatLoading || !question.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          {chatLoading && (
            <p className="text-xs text-muted-foreground animate-pulse">Analyzing...</p>
          )}
          {answer && (
            <p className="text-xs text-foreground leading-relaxed border-l-2 border-border pl-3">{answer}</p>
          )}
        </div>
      )}
    </div>
  );
}
