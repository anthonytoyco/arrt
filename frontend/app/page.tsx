"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Window } from "@/components/Window";
import { NavWheel, type WheelFeature } from "@/components/NavWheel";
import { ProtectionScore } from "@/components/ProtectionScore";
import { FlaggedTransactions } from "@/components/FlaggedTransactions";
import { RiskOverview } from "@/components/RiskOverview";
import { ResultsTable } from "@/components/ResultsTable";
import { CSVDataTable } from "@/components/CSVDataTable";
import { PDFExport } from "@/components/PDFExport";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import Image from "next/image";
import {
  scanSanctions, scanAnomalies, analyzeGeoRisk, scanFraud, fetchFraudReportSummary,
} from "@/lib/api";
import type {
  SanctionsResponse, AnomaliesResponse, GeoRiskResponse,
  FraudScanResponse, FraudReportSummary,
} from "@/lib/api";

// ── types ──────────────────────────────────────────────────────────────────

interface WindowState {
  id: WheelFeature;
  zIndex: number;
  position: { x: number; y: number };
}

const DEFAULT_POSITIONS: Record<WheelFeature, { x: number; y: number }> = {
  fraud:     { x: -520, y: -260 },
  anomaly:   { x:   60, y: -300 },
  sanctions: { x: -480, y:   40 },
  georisk:   { x:  120, y:   40 },
  reports:   { x: -180, y: -180 },
};

const WINDOW_TITLES: Record<WheelFeature, string> = {
  fraud:     "Fraud Detection",
  anomaly:   "Anomaly Detector",
  sanctions: "Sanctions Screener",
  georisk:   "Geopolitical Monitor",
  reports:   "Reports",
};

const WINDOW_WIDTHS: Record<WheelFeature, number> = {
  fraud: 420,
  anomaly: 560,
  sanctions: 520,
  georisk: 460,
  reports: 600,
};

// ── CSV helpers ─────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
  return { headers, rows };
}

function rowsToCSVFile(headers: string[], rows: Record<string, string>[]): File {
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => r[h] ?? "").join(","))];
  return new File([lines.join("\n")], "data.csv", { type: "text/csv" });
}

// ── DropZone ────────────────────────────────────────────────────────────────

function DropZone({ hint, onFile, onRemove, fileName }: {
  hint: string; onFile: (f: File) => void; onRemove?: () => void; fileName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div className="relative">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-all ${
          dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-gray-50"
        }`}
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        {fileName ? (
          <div className="pr-4">
            <p className="text-xs font-medium text-gray-700 truncate">{fileName}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Drop to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Upload className="h-4 w-4 text-gray-400" />
            <p className="text-xs text-gray-500">Drop CSV or click to browse</p>
            <p className="text-[11px] text-gray-400">{hint}</p>
          </div>
        )}
      </div>
      {fileName && onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 h-5 w-5 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 flex items-center justify-center text-gray-400 transition-colors">
          <span className="text-[10px] font-bold leading-none">✕</span>
        </button>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  // Window management
  const [openWindows, setOpenWindows] = useState<WindowState[]>([]);
  const [topZ, setTopZ] = useState(10);

  const openWindow = useCallback((id: WheelFeature) => {
    setOpenWindows((prev) => {
      if (prev.find((w) => w.id === id)) {
        // toggle: already open → close it
        return prev.filter((w) => w.id !== id);
      }
      const newZ = topZ + 1;
      setTopZ(newZ);
      return [...prev, { id, zIndex: newZ, position: DEFAULT_POSITIONS[id] }];
    });
  }, [topZ]);

  const closeWindow = useCallback((id: string) => {
    setOpenWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setOpenWindows((prev) => {
      const newZ = topZ + 1;
      setTopZ(newZ);
      return prev.map((w) => w.id === id ? { ...w, zIndex: newZ } : w);
    });
  }, [topZ]);

  const openWindowIds = new Set(openWindows.map((w) => w.id as WheelFeature));

  // ── Fraud data ──────────────────────────────────────────────────────────
  const [fraudScanData, setFraudScanData] = useState<FraudScanResponse | null>(null);
  const [fraudReportSummary, setFraudReportSummary] = useState<FraudReportSummary | null>(null);
  const [fraudScanLoading, setFraudScanLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([scanFraud(), fetchFraudReportSummary()]).then(([s, r]) => {
      if (cancelled) return;
      if (s.status === "fulfilled") setFraudScanData(s.value);
      if (r.status === "fulfilled") setFraudReportSummary(r.value);
      setFraudScanLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const fraudResults = fraudScanData?.results ?? [];
  const totalScanned = fraudScanData?.total_scanned ?? 0;
  const protectionScore = totalScanned === 0
    ? 100
    : Math.round(Math.max(0, 100 - (fraudScanData!.flagged / totalScanned) * 100));

  // ── Anomaly data ────────────────────────────────────────────────────────
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | undefined>();
  const [anomaliesData, setAnomaliesData] = useState<AnomaliesResponse | null>(null);
  const [anomaliesLoading, setAnomaliesLoading] = useState(false);

  function handleAnomalyFile(file: File) {
    file.text().then((text) => {
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers); setCsvRows(rows); setCsvFileName(file.name);
      setAnomaliesData(null);
    });
  }

  async function handleRunAnalysis() {
    if (!csvHeaders.length || !csvRows.length) return;
    setAnomaliesLoading(true);
    try { setAnomaliesData(await scanAnomalies(rowsToCSVFile(csvHeaders, csvRows))); }
    finally { setAnomaliesLoading(false); }
  }

  // ── Sanctions data ──────────────────────────────────────────────────────
  const [sanctionsFile, setSanctionsFile] = useState<File | null>(null);
  const [sanctionsData, setSanctionsData] = useState<SanctionsResponse | null>(null);
  const [sanctionsLoading, setSanctionsLoading] = useState(false);

  async function handleSanctionsScan() {
    if (!sanctionsFile) return;
    setSanctionsLoading(true);
    try { setSanctionsData(await scanSanctions(sanctionsFile)); }
    finally { setSanctionsLoading(false); }
  }

  // ── Geo risk data ───────────────────────────────────────────────────────
  const [geoCountries, setGeoCountries] = useState("");
  const [geoRiskData, setGeoRiskData] = useState<GeoRiskResponse | null>(null);
  const [geoRiskLoading, setGeoRiskLoading] = useState(false);

  async function handleGeoRisk() {
    const countries = geoCountries.split(",").map((c) => c.trim()).filter(Boolean);
    if (!countries.length) return;
    setGeoRiskLoading(true);
    try { setGeoRiskData(await analyzeGeoRisk(countries)); }
    finally { setGeoRiskLoading(false); }
  }

  // ── Window content ──────────────────────────────────────────────────────
  const windowContent: Record<WheelFeature, React.ReactNode> = {
    fraud: (
      <div className="p-5 space-y-5">
        {fraudScanLoading ? (
          <p className="text-xs text-gray-400 animate-pulse py-8 text-center">Scanning transactions…</p>
        ) : (
          <>
            <ProtectionScore score={protectionScore} />
            <div className="border-t border-gray-100 pt-4">
              <FlaggedTransactions results={fraudResults} />
            </div>
            <div className="border-t border-gray-100 pt-4">
              <RiskOverview results={fraudResults} totalScanned={totalScanned} summary={fraudReportSummary} />
            </div>
          </>
        )}
      </div>
    ),

    anomaly: (
      <div className="p-5 space-y-4">
        <DropZone
          hint="date, vendor, amount"
          onFile={handleAnomalyFile}
          onRemove={() => { setCsvHeaders([]); setCsvRows([]); setCsvFileName(undefined); setAnomaliesData(null); }}
          fileName={csvFileName}
        />
        {csvRows.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{csvRows.length} rows — click to edit</p>
              <Button size="sm" className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs"
                disabled={anomaliesLoading} onClick={handleRunAnalysis}>
                {anomaliesLoading ? "Analyzing…" : "Run Analysis"}
              </Button>
            </div>
            <CSVDataTable headers={csvHeaders} rows={csvRows} onChange={setCsvRows} />
            {anomaliesData && <ResultsTable type="anomalies" data={anomaliesData} />}
          </>
        )}
      </div>
    ),

    sanctions: (
      <div className="p-5 space-y-4">
        <DropZone
          hint="name, country, registration_number"
          onFile={(f) => setSanctionsFile(f)}
          onRemove={() => { setSanctionsFile(null); setSanctionsData(null); }}
          fileName={sanctionsFile?.name}
        />
        <Button className="w-full rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-sm"
          disabled={sanctionsLoading || !sanctionsFile} onClick={handleSanctionsScan}>
          {sanctionsLoading ? "Scanning…" : "Scan Entities"}
        </Button>
        {sanctionsData && <ResultsTable type="sanctions" data={sanctionsData} />}
      </div>
    ),

    georisk: (
      <div className="p-5 space-y-4">
        <textarea
          value={geoCountries}
          onChange={(e) => setGeoCountries(e.target.value)}
          placeholder="Myanmar, Nigeria, Turkey"
          rows={3}
          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <Button className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm"
          disabled={geoRiskLoading || !geoCountries.trim()} onClick={handleGeoRisk}>
          {geoRiskLoading ? "Analyzing…" : "Analyze Risk"}
        </Button>
        {geoRiskData && <ResultsTable type="georisk" data={geoRiskData} />}
      </div>
    ),

    reports: (
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Compliance Reports
          </p>
          <PDFExport sanctionsData={sanctionsData} anomaliesData={anomaliesData} geoRiskData={geoRiskData} />
        </div>
        {anomaliesData && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Anomaly</p>
            <ResultsTable type="anomalies" data={anomaliesData} />
          </div>
        )}
        {sanctionsData && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sanctions</p>
            <ResultsTable type="sanctions" data={sanctionsData} />
          </div>
        )}
        {geoRiskData && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Geo Risk</p>
            <ResultsTable type="georisk" data={geoRiskData} />
          </div>
        )}
        {!anomaliesData && !sanctionsData && !geoRiskData && (
          <p className="text-xs text-gray-400 text-center py-8">Run analyses to generate reports.</p>
        )}
      </div>
    ),
  };

  return (
    <div className="w-screen h-screen bg-white overflow-hidden relative">
      {/* Top bar */}
      <header className="absolute top-4 left-4 right-4 flex items-center justify-between px-5 py-3 rounded-2xl border border-white/60 backdrop-blur-md" style={{ zIndex: 9998, background: "rgba(240,240,240,0.7)" }}>
        <div className="flex items-center gap-3">
          <Image src="/yosemite_logo.png" alt="yosemite logo" width={28} height={28} className="rounded-lg" />
          <span className="text-[16px] font-semibold tracking-tight text-gray-900" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            yosemite
          </span>
        </div>
      
      </header>

      <AnimatePresence>
        {openWindows.map((w) => (
          <Window
            key={w.id}
            id={w.id}
            title={WINDOW_TITLES[w.id]}
            defaultPosition={w.position}
            zIndex={w.zIndex}
            onClose={closeWindow}
            onFocus={focusWindow}
            width={WINDOW_WIDTHS[w.id]}
          >
            {windowContent[w.id]}
          </Window>
        ))}
      </AnimatePresence>

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ zIndex: 9999 }}>
        <NavWheel
          protectionScore={protectionScore}
          openWindows={openWindowIds}
          onOpen={openWindow}
        />
      </div>
    </div>
  );
}
