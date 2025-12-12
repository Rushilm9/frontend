import React, { useEffect, useRef, useState } from "react";
import {
  Plus,
  FileText,
  Loader2,
  X,
  CheckCircle,
  Eye,
  Trash2,
  CloudLightning,
  RotateCw,
  UploadCloud,
  ArrowLeft,
} from "lucide-react";
import { BASE_URL } from "../utils/constant";
import { Link, useNavigate } from "react-router-dom";

/* --- Types --- */
type UploadResult = {
  file_name: string;
  paper_id: number;
  analysis_id: number;
  metadata: { author?: string | null; title?: string | null; year?: string | null };
  message: string;
};

type FileStatus = "queued" | "uploading" | "done" | "error" | "canceled";

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: FileStatus;
  message?: string | null;
  xhr?: XMLHttpRequest | null;
  result?: UploadResult | null;
};

/* --- Helpers --- */
const makeId = (f: File) => `${Date.now()}-${Math.floor(Math.random() * 10000)}-${f.name}`;
const CONCURRENCY = 3;

/* --- Component --- */
const LiteratureUploadPage: React.FC = () => {
  const navigate = useNavigate();

  const [project, setProject] = useState<any | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const activeCountRef = useRef(0);
  const queueRef = useRef<UploadItem[]>([]);
  const abortMapRef = useRef<Record<string, XMLHttpRequest | null>>({});
  const dropRef = useRef<HTMLDivElement | null>(null);

  // load project
  useEffect(() => {
    const projectId = localStorage.getItem("selectedProjectId");
    const projects = JSON.parse(localStorage.getItem("projects") || "[]");
    const selected = projects.find((p: any) => p.project_id?.toString() === projectId);
    if (selected) {
      setProject(selected);
      setAlertMsg(`📁 Loaded project: ${selected.project_name}`);
    } else {
      if (projectId) {
        setProject({ project_id: Number(projectId), project_name: "Selected Project" });
      } else {
        setAlertMsg("⚠️ No project selected. Please select a project first.");
      }
    }
  }, []);

  // small auto-hide alert
  useEffect(() => {
    if (!alertMsg) return;
    const t = setTimeout(() => setAlertMsg(null), 4500);
    return () => clearTimeout(t);
  }, [alertMsg]);

  /* --- drag & drop handlers --- */
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;

    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDrop = (e: DragEvent) => {
      prevent(e);
      const dt = e.dataTransfer;
      if (dt?.files?.length) {
        addFiles(Array.from(dt.files));
      }
    };
    el.addEventListener("dragenter", prevent);
    el.addEventListener("dragover", prevent);
    el.addEventListener("drop", onDrop);

    return () => {
      el.removeEventListener("dragenter", prevent);
      el.removeEventListener("dragover", prevent);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  const addFiles = (files: File[]) => {
    const newItems: UploadItem[] = files.map((f) => ({
      id: makeId(f),
      file: f,
      progress: 0,
      status: "queued",
      message: null,
      xhr: null,
      result: null,
    }));

    // dedupe by name+size
    setItems((prev) => {
      const existingKeys = new Set(prev.map((p) => `${p.file.name}-${p.file.size}`));
      const filtered = newItems.filter((n) => !existingKeys.has(`${n.file.name}-${n.file.size}`));
      return [...prev, ...filtered];
    });

    // enqueue and attempt to start
    queueRef.current.push(...newItems);
    tickQueue();
  };

  /* --- queue / concurrency --- */
  const tickQueue = () => {
    while (activeCountRef.current < CONCURRENCY && queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      startUpload(next);
    }
  };

  const startUpload = (item: UploadItem) => {
    setItems((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, status: "uploading", progress: 0, message: null } : p))
    );

    activeCountRef.current += 1;

    const projectId = Number(project?.project_id || localStorage.getItem("selectedProjectId") || 111);
    if (!projectId) {
      setAlertMsg("⚠️ Select a project first.");
      finishUploadSlot(item.id);
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, status: "error", message: "No project selected" } : p))
      );
      return;
    }

    const formData = new FormData();
    formData.append("files", item.file, item.file.name);

    const xhr = new XMLHttpRequest();
    abortMapRef.current[item.id] = xhr;

    // ✅ EXACT API CALL AS REQUESTED
    xhr.open("POST", `https://google-ai-backend.onrender.com/literature/project/${projectId}/upload-and-review`);
    xhr.setRequestHeader("accept", "application/json");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, progress: percent } : p)));
      }
    };

    xhr.onload = () => {
      abortMapRef.current[item.id] = null;
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          const newResults: UploadResult[] = Array.isArray(data.results)
            ? data.results
            : data.results
            ? [data.results]
            : [];
          const resForThis = newResults[0] ?? null;

          setItems((prev) =>
            prev.map((p) =>
              p.id === item.id
                ? {
                    ...p,
                    progress: 100,
                    status: resForThis ? "done" : "error",
                    message: resForThis ? "Analysis ready" : "No analysis returned",
                    result: resForThis,
                  }
                : p
            )
          );

          if (resForThis) {
            setResults((prev) => [resForThis, ...prev]);
            window.dispatchEvent(
              new CustomEvent("projectLiteratureChanged", { detail: { projectId } })
            );
            setAlertMsg("✅ Upload complete. Analysis stored.");
          } else {
            setAlertMsg("⚠️ Upload finished but no analysis returned.");
          }
        } catch {
          setItems((prev) =>
            prev.map((p) =>
              p.id === item.id ? { ...p, status: "error", message: "Could not parse server response" } : p
            )
          );
          setAlertMsg("❌ Could not parse server response.");
        }
      } else {
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, status: "error", message: `Upload failed (${xhr.status})` } : p
          )
        );
        setAlertMsg(`❌ Upload failed: ${xhr.status}`);
      }
      finishUploadSlot(item.id);
    };

    xhr.onerror = () => {
      abortMapRef.current[item.id] = null;
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "error", message: "Network error" } : p)));
      setAlertMsg("❌ Network error while uploading file.");
      finishUploadSlot(item.id);
    };

    xhr.onabort = () => {
      abortMapRef.current[item.id] = null;
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, status: "canceled", message: "Canceled by user" } : p))
      );
      finishUploadSlot(item.id);
    };

    setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, xhr } : p)));
    xhr.send(formData);
  };

  const finishUploadSlot = (id?: string) => {
    activeCountRef.current = Math.max(0, activeCountRef.current - 1);
    setTimeout(() => tickQueue(), 80);
  };

  /* --- controls --- */
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length) {
      addFiles(Array.from(e.target.files));
      e.currentTarget.value = "";
    }
  };

  const startAll = () => {
    const queued = items.filter((it) => it.status === "queued");
    queueRef.current.push(...queued);
    tickQueue();
  };

  const clearAll = () => {
    Object.keys(abortMapRef.current).forEach((k) => {
      abortMapRef.current[k]?.abort();
    });
    queueRef.current = [];
    abortMapRef.current = {};
    setItems([]);
    setAlertMsg("Cleared uploads");
  };

  const removeItem = (id: string) => {
    abortMapRef.current[id]?.abort();
    queueRef.current = queueRef.current.filter((q) => q.id !== id);
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const cancelItem = (id: string) => {
    abortMapRef.current[id]?.abort();
  };

  const retryItem = (id: string) => {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "queued", progress: 0, message: null, xhr: null } : p))
    );
    const it = items.find((p) => p.id === id);
    if (it) {
      queueRef.current.push({ ...it, status: "queued", progress: 0, message: null, xhr: null });
      tickQueue();
    } else {
      tickQueue();
    }
  };

  /* --- subcomponent --- */
  const UploadCard: React.FC<{ item: UploadItem }> = ({ item }) => {
    return (
      <div className="p-4 border rounded-lg flex justify-between items-start bg-white shadow-sm">
        <div className="flex gap-4">
          <FileText className="h-6 w-6 text-blue-600 mt-1" />
          <div>
            <div className="font-medium text-gray-900 break-words">{item.file.name}</div>
            <div className="text-xs text-gray-500">
              {(item.file.size / (1024 * 1024)).toFixed(2)} MB • {item.file.type || "unknown type"}
            </div>

            <div className="mt-2 w-72">
              <div className="w-full bg-gray-100 rounded-full h-2 mb-1 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-200 ${
                    item.status === "error" ? "bg-red-600" : item.status === "done" ? "bg-green-600" : "bg-blue-600"
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">
                {item.status === "queued" && "Queued"}
                {item.status === "uploading" && (
                  <>
                    Uploading… <span className="ml-1 font-medium">{item.progress}%</span>
                  </>
                )}
                {item.status === "done" && (
                  <>
                    <span className="text-green-600 font-medium">Done</span>{" "}
                    {item.message ? `• ${item.message}` : ""}
                  </>
                )}
                {item.status === "error" && (
                  <span className="text-red-600">Error • {item.message || "Failed"}</span>
                )}
                {item.status === "canceled" && <span className="text-yellow-700">Canceled</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {item.status === "done" && item.result ? (
              <>
                <Link
                  to={`/app/literature/${item.result.paper_id}`}
                  className="text-sm text-blue-700 flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" /> View
                </Link>
                <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 inline-block" /> Staged
                </span>
              </>
            ) : item.status === "uploading" ? (
              <>
                <button
                  onClick={() => cancelItem(item.id)}
                  title="Cancel"
                  className="text-sm text-red-600 hover:underline flex items-center gap-2"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              </>
            ) : item.status === "error" ? (
              <>
                <button
                  onClick={() => retryItem(item.id)}
                  className="text-sm text-blue-700 hover:underline flex items-center gap-2"
                >
                  <RotateCw className="h-4 w-4" /> Retry
                </button>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-sm text-red-600 hover:underline flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    queueRef.current.push(item);
                    tickQueue();
                  }}
                  className="text-sm text-green-600 hover:underline flex items-center gap-2"
                >
                  <CloudLightning className="h-4 w-4" /> Start
                </button>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-sm text-red-600 hover:underline flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </>
            )}
          </div>

          {item.message && <div className="text-xs text-gray-500">{item.message}</div>}
        </div>
      </div>
    );
  };

  const goBack = () => {
    try {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/app/projects");
      }
    } catch {
      navigate("/app/projects");
    }
  };

  return (
    <div className="pt-20 p-6 space-y-6 relative">
      {/* Back button */}
      <div className="absolute left-6 top-12 z-50">
        <button
          onClick={goBack}
          aria-label="Go back"
          className="inline-flex items-center gap-2 text-sm text-gray-700 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-md border hover:shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      {alertMsg && (
        <div className="fixed bottom-6 right-6 bg-blue-700 text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-fadeIn z-50">
          {alertMsg}
        </div>
      )}

      {project && (
        <div className="bg-gradient-to-r from-blue-600 to-teal-500 rounded-xl text-white shadow-md p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-words">
                {project.project_name || "Untitled Project"}
              </h1>
              <p className="text-blue-100 text-sm mt-1 max-w-2xl leading-relaxed">
                {project.project_desc || "Upload literature for this project."}
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

      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-2">Upload document(s) & request literature review</h2>
            <p className="text-sm text-gray-600 mb-4">
              You can drag & drop files or use the file picker. Multiple files are supported. Each file gets its own upload card with progress and controls.
            </p>

            <div
              ref={dropRef}
              className="border-dashed border-2 border-gray-200 rounded-lg p-6 text-center bg-gray-50 hover:border-blue-300 transition"
            >
              <input id="file-multiple" type="file" className="hidden" multiple onChange={handleFileInput} />
              <label htmlFor="file-multiple" className="inline-flex items-center gap-2 cursor-pointer text-gray-700">
                <Plus className="h-5 w-5 text-blue-700" />
                <span className="text-sm font-medium">Select files</span>
              </label>
              <div className="text-xs text-gray-500 mt-2">or drop files here</div>
            </div>

            <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
              <UploadCloud className="h-4 w-4" /> <span>Max file size enforced by backend. Supported: PDF, DOCX, TXT, etc.</span>
            </div>
          </div>

          <div className="w-full lg:w-64 flex flex-col items-end justify-between">
            <div className="w-full">
              <button
                onClick={startAll}
                disabled={!items.some((it) => it.status === "queued")}
                className={`w-full px-4 py-2 rounded text-white flex items-center justify-center gap-2 ${
                  items.some((it) => it.status === "queued") ? "bg-green-600 hover:bg-green-700" : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                <CloudLightning className="h-4 w-4" /> Start all
              </button>

              <button onClick={clearAll} className="mt-3 w-full text-sm text-red-600 hover:underline flex items-center justify-center gap-2">
                <Trash2 className="h-4 w-4" /> Clear all
              </button>

              <div className="mt-4 text-xs text-gray-500 text-right">
                {activeCountRef.current > 0 ? (
                  <div className="flex items-center justify-end gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> <span>Uploading {activeCountRef.current}…</span>
                  </div>
                ) : (
                  <div>Upload queue: {items.filter((i) => i.status === "queued").length} • Active: {activeCountRef.current}</div>
                )}
              </div>
            </div>
            <div className="mt-4 text-xs text-right text-gray-500">
              <div>Concurrency: {CONCURRENCY} simultaneous</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Upload queue</h3>
        <div className="space-y-3">
          {items.length === 0 && <p className="text-sm text-gray-500">No files added yet.</p>}
          {items.map((it) => (
            <UploadCard key={it.id} item={it} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Upload results</h3>
        <div className="space-y-3">
          {results.length === 0 && <p className="text-sm text-gray-500">No recent upload results to show.</p>}
          {results.map((r) => (
            <div key={r.analysis_id} className="p-4 border rounded-lg flex justify-between items-start bg-white">
              <div>
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium">{r.metadata.title || r.file_name}</div>
                    <div className="text-xs text-gray-500">Author: {r.metadata.author || "—"} • Year: {r.metadata.year || "—"}</div>
                  </div>
                </div>

                <div className="mt-2 text-sm text-gray-600">{r.message}</div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Link to={`/app/literature/${r.paper_id}`} className="text-sm text-blue-700 flex items-center gap-2">
                  <Eye className="h-4 w-4" /> View more
                </Link>
                <div className="text-green-600 text-sm font-medium"><CheckCircle className="h-4 w-4 inline-block mr-1" />Staged</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiteratureUploadPage;
