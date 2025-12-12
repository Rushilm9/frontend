import React, { useEffect, useState } from "react";
import {
  FileText,
  BookOpen,
  Key,
  ArrowLeft,
  Loader2,
  Brain,
  Calendar,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BASE_URL } from "../utils/constant";

type LocalAnalysisData = {
  Summary?: string;
  Strengths?: string[];
  Weaknesses?: string[];
  "Research Gaps"?: string[];
  Keywords?: string[];
  Metadata?: {
    "Possible Title"?: string;
    "Authors (if mentioned)"?: string;
    "Field / Domain"?: string;
    "Publication Context (if inferable)"?: string;
  };
};

type ServerPaper = {
  paper_id: number;
  title?: string;
  original_text?: string;
  summary_text: string;
  strengths: string[];
  weaknesses: string[];
  gaps: string[];
  semantic_patterns: string[];
  tone?: string;
  critique_score?: number;
  sentiment_score?: number;
  peer_reviewed?: boolean | null;
  created_at?: string;
  message?: string;
};

const LiteratureDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as any;
  const { paperId } = useParams();

  const [source, setSource] = useState<"local" | "db">("local");
  const [fileName, setFileName] = useState<string>("Untitled Paper");
  const [loading, setLoading] = useState(true);
  const [localAnalysis, setLocalAnalysis] = useState<LocalAnalysisData | null>(
    null
  );
  const [serverData, setServerData] = useState<ServerPaper | null>(null);
  const [activeView, setActiveView] = useState<"original" | "review">("review");

  // ✅ Parse local AI JSON safely
  const parseLocalAnalysis = (data: any): LocalAnalysisData | null => {
    if (!data) return null;
    try {
      if (typeof data === "object") return data;
      const jsonMatch = data.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      let parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      return parsed;
    } catch (err) {
      console.warn("JSON parse error:", err);
      return null;
    }
  };

  // 🧩 Detect data source
  useEffect(() => {
    const fetchData = async () => {
      // Case 1: From local
      if (state?.analysis) {
        setSource("local");
        setFileName(state.name || state.fileName || "Untitled Paper");
        const parsed = parseLocalAnalysis(state.analysis);
        setLocalAnalysis(parsed);
        setLoading(false);
        return;
      }

      // Case 2: From DB
      if (paperId) {
        setSource("db");
        try {
          setLoading(true);
          const res = await fetch(`${BASE_URL}/literature/review/${paperId}`, {
            headers: { accept: "application/json" },
          });
          if (!res.ok) throw new Error(`Server returned ${res.status}`);
          const data = await res.json();
          setServerData(data);
          setFileName(data.title || `Paper ${data.paper_id}`);
        } catch (err) {
          console.error("❌ Error fetching paper:", err);
          setServerData(null);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchData();
  }, [state, paperId]);

  // 🕓 Loading state
  if (loading) {
    return (
      <div className="pt-20 p-6 text-gray-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading paper...
      </div>
    );
  }

  // ⚠️ No data
  if (!localAnalysis && !serverData) {
    return (
      <div className="pt-20 p-6 text-gray-500">
        No review data found. Please go back.
      </div>
    );
  }

  // ✅ UI
  return (
    <div className="pt-20 p-6 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="bg-white rounded-lg shadow border p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" /> {fileName}
            </h2>
            <span
              className={`text-sm font-medium ${
                source === "local" ? "text-green-600" : "text-blue-600"
              }`}
            >
              {source === "local" ? "Local Analysis" : "Gemini / DB Review"}
            </span>
          </div>

          {/* Toggle View Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView("original")}
              className={`px-4 py-2 text-sm rounded font-medium ${
                activeView === "original"
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              View Original Paper
            </button>
            <button
              onClick={() => setActiveView("review")}
              className={`px-4 py-2 text-sm rounded font-medium ${
                activeView === "review"
                  ? "bg-blue-600 text-white"
                  : "bg-blue-100 hover:bg-blue-200 text-blue-700"
              }`}
            >
              View Review
            </button>
          </div>
        </div>

        {/* ORIGINAL PAPER */}
        {activeView === "original" && (
          <div className="p-4 rounded border bg-gray-50">
            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-700" /> ORIGINAL PAPER
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {serverData?.original_text ||
                state?.originalText ||
                "Original paper text not available."}
            </p>
          </div>
        )}

        {/* REVIEW VIEW */}
        {activeView === "review" && (
          <>
            {/* Local Analysis */}
            {source === "local" && localAnalysis && (
              <>
                {localAnalysis.Metadata && (
                  <div className="p-4 rounded border bg-gray-50">
                    <h4 className="font-semibold text-gray-800 mb-2">METADATA</h4>
                    <p className="text-sm">
                      <strong>Possible Title:</strong>{" "}
                      {localAnalysis.Metadata["Possible Title"] || "N/A"}
                    </p>
                    <p className="text-sm">
                      <strong>Authors:</strong>{" "}
                      {localAnalysis.Metadata["Authors (if mentioned)"] || "N/A"}
                    </p>
                    <p className="text-sm">
                      <strong>Field / Domain:</strong>{" "}
                      {localAnalysis.Metadata["Field / Domain"] || "N/A"}
                    </p>
                    <p className="text-sm">
                      <strong>Publication Context:</strong>{" "}
                      {localAnalysis.Metadata[
                        "Publication Context (if inferable)"
                      ] || "N/A"}
                    </p>
                  </div>
                )}

                {localAnalysis.Summary && (
                  <div className="p-4 rounded border bg-gray-50">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-700" /> SUMMARY
                    </h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {localAnalysis.Summary}
                    </p>
                  </div>
                )}

                {localAnalysis.Strengths && (
                  <div className="p-4 rounded border bg-green-50">
                    <h4 className="font-semibold text-green-700 mb-2">
                      STRENGTHS
                    </h4>
                    <ul className="list-disc ml-5 text-sm text-gray-700">
                      {localAnalysis.Strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {localAnalysis.Weaknesses && (
                  <div className="p-4 rounded border bg-red-50">
                    <h4 className="font-semibold text-red-700 mb-2">
                      WEAKNESSES
                    </h4>
                    <ul className="list-disc ml-5 text-sm text-gray-700">
                      {localAnalysis.Weaknesses.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {localAnalysis["Research Gaps"] && (
                  <div className="p-4 rounded border bg-yellow-50">
                    <h4 className="font-semibold text-yellow-700 mb-2">
                      RESEARCH GAPS
                    </h4>
                    <ul className="list-disc ml-5 text-sm text-gray-700">
                      {localAnalysis["Research Gaps"].map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {localAnalysis.Keywords && (
                  <div className="p-4 rounded border bg-blue-50">
                    <h4 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">
                      <Key className="h-4 w-4 text-blue-600" /> KEYWORDS
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {localAnalysis.Keywords.map((k, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Server (DB / Gemini) */}
            {source === "db" && serverData && (
              <>
                {serverData.summary_text && (
                  <div className="p-4 rounded border bg-gray-50">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-700" /> SUMMARY
                    </h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {serverData.summary_text}
                    </p>
                  </div>
                )}

                <div className="p-4 rounded border bg-green-50">
                  <h4 className="font-semibold text-green-700 mb-2">STRENGTHS</h4>
                  <ul className="list-disc ml-5 text-sm text-gray-700">
                    {serverData.strengths?.length ? (
                      serverData.strengths.map((s, i) => <li key={i}>{s}</li>)
                    ) : (
                      <li>None specified.</li>
                    )}
                  </ul>
                </div>

                <div className="p-4 rounded border bg-red-50">
                  <h4 className="font-semibold text-red-700 mb-2">WEAKNESSES</h4>
                  <ul className="list-disc ml-5 text-sm text-gray-700">
                    {serverData.weaknesses?.length ? (
                      serverData.weaknesses.map((w, i) => <li key={i}>{w}</li>)
                    ) : (
                      <li>None specified.</li>
                    )}
                  </ul>
                </div>

                <div className="p-4 rounded border bg-yellow-50">
                  <h4 className="font-semibold text-yellow-700 mb-2">
                    RESEARCH GAPS
                  </h4>
                  <ul className="list-disc ml-5 text-sm text-gray-700">
                    {serverData.gaps?.length ? (
                      serverData.gaps.map((g, i) => <li key={i}>{g}</li>)
                    ) : (
                      <li>None specified.</li>
                    )}
                  </ul>
                </div>

                {serverData.semantic_patterns?.length > 0 && (
                  <div className="p-4 rounded border bg-blue-50">
                    <h4 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">
                      <Key className="h-4 w-4 text-blue-600" /> SEMANTIC PATTERNS
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {serverData.semantic_patterns.map((p, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 rounded border bg-gray-50">
                  <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-600" /> REVIEW METRICS
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-700">
                    <p>
                      <strong>Critique Score:</strong>{" "}
                      {serverData.critique_score ?? "N/A"}
                    </p>
                    <p>
                      <strong>Sentiment Score:</strong>{" "}
                      {serverData.sentiment_score ?? "N/A"}
                    </p>
                    <p>
                      <strong>Tone:</strong> {serverData.tone || "N/A"}
                    </p>
                    <p>
                      <strong>Peer Reviewed:</strong>{" "}
                      {serverData.peer_reviewed === null
                        ? "Unknown"
                        : serverData.peer_reviewed
                        ? "Yes"
                        : "No"}
                    </p>
                    {serverData.created_at && (
                      <p className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-500" />{" "}
                        {new Date(serverData.created_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LiteratureDetailPage;
