import React, { useState, useEffect } from "react";
import {
  Plus,
  FileText,
  Loader2,
  CheckCircle,
  X,
  Sparkles,
  Download,
} from "lucide-react";
import { BASE_URL } from "../utils/constant";

const UploadDocumentsPage: React.FC = () => {
  const [project, setProject] = useState<any>(null);
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">(
    "idle"
  );
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [summaries, setSummaries] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ingest modal state
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<any | null>(null);

  // ingest form fields
  const [ingestLimit, setIngestLimit] = useState<number | "">("");
  const [minCitations, setMinCitations] = useState<number | "">("");
  const [yearMin, setYearMin] = useState<number | "">("");
  const [yearMax, setYearMax] = useState<number | "">("");
  const [quartileIn, setQuartileIn] = useState<string>("");

  // ---------------------------
  // Fetch project data
  // ---------------------------
  const fetchProjectData = async (projectId: number) => {
    try {
      const res = await fetch(`${BASE_URL}/keyword/fetch/${projectId}`, {
        method: "GET",
        headers: { accept: "application/json" },
      });
      const data = await res.json();

      if (data.detail) {
        setKeywords([]);
        setSummaries(null);
        setUploadedDocs([]);
        setAlertMsg(data.detail);
        return;
      }

      if (!res.ok) throw new Error("Failed to fetch project data");

      if (data.keywords) setKeywords(data.keywords);
      if (data.summaries) setSummaries(data.summaries);
      if (data.files) setUploadedDocs(data.files);
      if (data.project?.raw_query) setPrompt(data.project.raw_query);
    } catch (err) {
      console.error(err);
      setAlertMsg("❌ Failed to load existing project data.");
    }
  };

  // ---------------------------
  // Load selected project
  // ---------------------------
  useEffect(() => {
    const loadProject = () => {
      const projectId = localStorage.getItem("selectedProjectId");
      const projects = JSON.parse(localStorage.getItem("projects") || "[]");
      const selected = projects.find(
        (p: any) => p.project_id.toString() === projectId
      );

      if (selected) {
        setProject(selected);
        if (selected.raw_query) setPrompt(selected.raw_query);
        fetchProjectData(selected.project_id);
      } else {
        setAlertMsg("⚠️ No project selected. Please go back and select one.");
      }
    };

    loadProject();

    const handleProjectChange = () => {
      const newId = localStorage.getItem("selectedProjectId");
      const projects = JSON.parse(localStorage.getItem("projects") || "[]");
      const selected = projects.find(
        (p: any) => p.project_id.toString() === newId
      );

      if (selected) {
        setProject(selected);
        setPrompt(selected.raw_query || "");
        fetchProjectData(selected.project_id);
        setAlertMsg(`📁 Switched to project: ${selected.project_name}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    window.addEventListener("projectChanged", handleProjectChange);
    return () =>
      window.removeEventListener("projectChanged", handleProjectChange);
  }, []);

  // ---------------------------
  // File Upload
  // ---------------------------
  const handleFileUpload = async (selectedFile: File) => {
    if (!project) {
      setAlertMsg("⚠️ Please select a project first.");
      return;
    }

    try {
      setFile(selectedFile);
      setStatus("uploading");
      setProgress(0);
      setIsAnalyzing(true);
      setAlertMsg("⚙️ Uploading and analyzing document...");

      const formData = new FormData();
      formData.append("user_id", "120001");
      formData.append("project_id", project.project_id);
      formData.append("prompt", prompt || "");
      formData.append("files", selectedFile);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE_URL}/keyword/analyze`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setProgress(percent);
        }
      };

      xhr.onload = async () => {
        setIsAnalyzing(false);
        if (xhr.status === 200) {
          setStatus("done");
          setAlertMsg("✅ Document uploaded and analyzed successfully!");
          await fetchProjectData(project.project_id);
        } else {
          setStatus("error");
          setAlertMsg("❌ Upload failed. Try again.");
        }
      };

      xhr.onerror = () => {
        setIsAnalyzing(false);
        setStatus("error");
        setAlertMsg("❌ Network error while uploading file.");
      };

      xhr.send(formData);
    } catch (err) {
      console.error(err);
      setIsAnalyzing(false);
      setStatus("error");
      setAlertMsg("❌ Upload process failed.");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // ---------------------------
  // Generate Keywords
  // ---------------------------
  const handleGenerateKeywords = async () => {
    if (isAnalyzing) return;
    if (!prompt.trim() && !file) {
      setAlertMsg("⚠️ Please provide a prompt or upload a document first.");
      return;
    }
    if (!project) {
      setAlertMsg("⚠️ No project selected.");
      return;
    }

    try {
      setIsAnalyzing(true);
      setAlertMsg("⚙️ Analyzing keywords...");
      setKeywords([]);

      const formData = new FormData();
      formData.append("user_id", "120001");
      formData.append("project_id", project.project_id);
      formData.append("prompt", prompt);
      if (file) formData.append("files", file);

      const response = await fetch(`${BASE_URL}/keyword/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to analyze keywords");
      const data = await response.json();
      setAlertMsg(data.message || "✅ Keywords generated successfully!");

      await fetchProjectData(project.project_id);

      const res2 = await fetch(`${BASE_URL}/keyword/fetch/${project.project_id}`);
      const projectData = await res2.json();
      const gotKeywords = projectData?.keywords || [];
      if (gotKeywords.length > 0) {
        setIngestLimit("");
        setMinCitations("");
        setYearMin("");
        setYearMax("");
        setQuartileIn("");
        setShowIngestModal(true);
      } else {
        setAlertMsg("⚠️ No keywords found after generation.");
      }
    } catch (err) {
      console.error(err);
      setAlertMsg("❌ Keyword generation failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ---------------------------
  // Ingest handler (with loader + redirect)
  // ---------------------------
  const handleStartIngest = async () => {
    if (!project) {
      setAlertMsg("⚠️ No project selected.");
      return;
    }

    setIsIngesting(true);
    setIngestResult(null);
    setAlertMsg("🔎 Starting paper ingestion...");

    try {
      const params = new URLSearchParams();
      if (ingestLimit !== "") params.set("limit", String(ingestLimit));

      // defaults
      params.set("pages_per_keyword", "5");
      params.set("inter_batch_delay_ms", "3000");
      params.set("require_abstract", "true");
      params.set("authors_in_background", "true");
      params.set("openalex_enabled", "true");
      params.set("crossref_enabled", "true");

      if (minCitations !== "") params.set("min_citations", String(minCitations));
      if (yearMin !== "") params.set("year_min", String(yearMin));
      if (yearMax !== "") params.set("year_max", String(yearMax));
      if (quartileIn.trim() !== "") params.set("quartile_in", quartileIn.trim());

      const notify = localStorage.getItem("userEmail") || "";
      if (notify) params.set("notify_user", notify);

      const url = `${BASE_URL}/research/ingest/${project.project_id}?${params.toString()}`;

      const resp = await fetch(url, {
        method: "POST",
        headers: { accept: "application/json" },
      });

      const payload = await resp.json();

      if (!resp.ok) {
        const detail =
          payload?.detail ||
          (typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
        setAlertMsg(`❌ Ingest error: ${String(detail)}`);
        setIngestResult({ error: detail });
      } else {
        setAlertMsg("✅ Ingest finished. Redirecting...");
        setIngestResult(payload);

        // ✅ Redirect after short delay
        setTimeout(() => {
          window.location.href = "http://localhost:5173/app/papers";
        }, 1000);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "Network or server error";
      setAlertMsg(`❌ Ingest error: ${msg}`);
      setIngestResult({ error: msg });
    } finally {
      setIsIngesting(false);
    }
  };

  const canGenerate = (prompt.trim() || file) && !isAnalyzing;

  const AlertBox = ({ message }: { message: string }) => (
    <div className="fixed bottom-6 right-6 bg-blue-700 text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-fadeIn z-50">
      {message}
    </div>
  );

  return (
    <div className="space-y-8">
      {alertMsg && <AlertBox message={alertMsg} />}

      <div className="mt-20" />

      {/* Project Header */}
      {project && (
        <div className="bg-gradient-to-r from-blue-600 to-teal-500 rounded-xl text-white shadow-md p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold leading-tight break-words">
                {project.project_name || "Untitled Project"}
              </h1>
              <p className="text-blue-100 text-base mt-1 max-w-2xl leading-relaxed">
                {project.project_desc || "No description provided."}
              </p>
              <p className="text-blue-200 text-xs mt-2">
                Project ID: <span className="font-mono">{project.project_id}</span>
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/30 shadow-sm">
              <CheckCircle className="h-4 w-4 text-white mr-2" />
              <span className="text-sm font-medium tracking-wide">Active Project</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Section */}
      <div className="pt-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Research Prompt */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Research Prompt</h2>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Studying electrodynamics of moving bodies..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 resize-none min-h-[150px]"
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleGenerateKeywords}
              disabled={!canGenerate}
              className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-sm font-medium shadow-sm transition ${
                canGenerate
                  ? "bg-blue-700 hover:bg-blue-800 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Keywords</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Upload Documents */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Upload Documents</h2>

          {!file ? (
            <>
              <input id="fileUpload" type="file" className="hidden" onChange={handleFileSelect} />
              <label
                htmlFor="fileUpload"
                className="cursor-pointer inline-flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg text-sm font-medium transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Select File to Upload</span>
              </label>
            </>
          ) : (
            <div className="text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setProgress(0);
                    setStatus("idle");
                  }}
                  className="text-gray-400 hover:text-red-600 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className={`${
                    status === "error"
                      ? "bg-red-600"
                      : status === "done"
                      ? "bg-green-600"
                      : "bg-blue-600"
                  } h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keywords + Fetch */}
      {keywords.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-100 rounded-xl p-6 shadow-sm mt-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <span>Generated Keywords</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {keywords.map((word, i) => (
                <span
                  key={i}
                  className="bg-white border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-sm font-medium shadow-sm"
                >
                  {word}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowIngestModal(true)}
              disabled={isIngesting || isAnalyzing}
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition ${
                isIngesting || isAnalyzing
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              Fetch Papers
            </button>
          </div>
        </div>
      )}

      {/* Ingest Modal */}
      {showIngestModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!isIngesting) setShowIngestModal(false);
            }}
          />

          <div className="relative max-w-3xl w-full bg-white rounded-xl shadow-xl p-6 z-10">
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-lg font-semibold">Ingest discovered papers</h4>
              <button
                onClick={() => {
                  if (!isIngesting) setShowIngestModal(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-gray-600">
                Limit (max papers to save)
                <input
                  type="number"
                  min={1}
                  value={ingestLimit}
                  onChange={(e) =>
                    setIngestLimit(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="optional"
                  disabled={isIngesting}
                />
              </label>

              <label className="text-xs text-gray-600">
                Min citations
                <input
                  type="number"
                  min={0}
                  value={minCitations}
                  onChange={(e) =>
                    setMinCitations(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="optional"
                  disabled={isIngesting}
                />
              </label>

              <label className="text-xs text-gray-600">
                Year min
                <input
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  value={yearMin}
                  onChange={(e) =>
                    setYearMin(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="optional"
                  disabled={isIngesting}
                />
              </label>

              <label className="text-xs text-gray-600">
                Year max
                <input
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  value={yearMax}
                  onChange={(e) =>
                    setYearMax(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="optional"
                  disabled={isIngesting}
                />
              </label>

              <label className="text-xs text-gray-600">
                Quartile (comma-separated)
                <input
                  type="text"
                  value={quartileIn}
                  onChange={(e) => setQuartileIn(e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g. Q1,Q2"
                  disabled={isIngesting}
                />
              </label>
            </div>

            {/* Loader / Progress */}
            {isIngesting && (
              <div className="mt-6 flex items-center gap-3 text-blue-700 text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Ingesting papers... please wait</span>
              </div>
            )}

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  if (!isIngesting) setShowIngestModal(false);
                }}
                className="px-4 py-2 rounded bg-gray-100 text-sm text-gray-700"
                disabled={isIngesting}
              >
                Cancel
              </button>

              <button
                onClick={handleStartIngest}
                className="px-4 py-2 rounded bg-blue-700 text-white text-sm flex items-center space-x-2"
                disabled={isIngesting}
              >
                {isIngesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Ingesting...</span>
                  </>
                ) : (
                  <span>Start Ingest</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadDocumentsPage;
