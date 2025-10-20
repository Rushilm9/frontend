import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Download, Eye, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { BASE_URL } from "../utils/constant";

type LitPaper = {
  paper_id: number;
  title: string;
  file_type?: string;
  file_path?: string;
  has_review?: boolean;
  created_at?: string;
};

const LiteratureListPage: React.FC = () => {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [papers, setPapers] = useState<LitPaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("Fetching literature papers...");

  useEffect(() => {
    const storedId = localStorage.getItem("selectedProjectId");
    if (storedId) setProjectId(Number(storedId));
    else setStatusMsg("⚠️ No project selected.");
  }, []);

  const fetchLiteraturePapers = async (id: number) => {
    setLoading(true);
    setStatusMsg("⚙️ Fetching literature papers...");
    try {
      const res = await fetch(`${BASE_URL}/literature/project/${id}/papers`, {
        headers: { accept: "application/json" },
      });
      const data = await res.json();
      if (res.ok && data?.papers) {
        setPapers(data.papers);
        setStatusMsg(`✅ Loaded ${data.papers.length} literature items.`);
      } else {
        setStatusMsg("⚠️ No literature papers found for this project.");
        setPapers([]);
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("❌ Failed to load literature papers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    fetchLiteraturePapers(projectId);

    // refresh when other components emit an update
    const onChanged = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      if (!detail || detail.projectId === projectId) fetchLiteraturePapers(projectId);
    };
    window.addEventListener("projectLiteratureChanged", onChanged);
    return () => window.removeEventListener("projectLiteratureChanged", onChanged);
  }, [projectId]);

  const sorted = useMemo(() => {
    return [...papers].sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return (b.paper_id || 0) - (a.paper_id || 0);
    });
  }, [papers]);

  return (
    // PT added so content sits below fixed header — adjust pt-20 if you need more/less
    <div className="pt-20 p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">📚 Literature for Project</h1>
          <p className="text-sm text-gray-500">{statusMsg}</p>
        </div>

        {/* Upload button always visible on this page */}
        <div>
          <Link
            to="/app/literature/upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium shadow"
          >
            <Plus className="h-4 w-4" /> Upload Literature
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-6 bg-white border rounded text-sm text-gray-600">
          No literature reviews found. Use the button above to upload documents and generate reviews.
        </div>
      ) : (
        <div className="grid gap-4">
          {sorted.map((p) => (
            <div key={p.paper_id} className="p-4 bg-white border rounded-lg flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <div className="text-xs text-gray-500 mt-1">ID: {p.paper_id} • Type: {p.file_type || "PDF"}</div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {p.file_path && (
                  <a
                    href={`${BASE_URL}/${p.file_path.replace(/\\/g, "/")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-700 flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" /> Download
                  </a>
                )}

                <Link
                  to={`/app/literature/${p.paper_id}`}
                  className="text-sm text-blue-700 flex items-center gap-1"
                >
                  <Eye className="h-4 w-4" /> View more
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiteratureListPage;
