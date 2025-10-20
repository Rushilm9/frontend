import React, { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  RefreshCw,
  Download,
  Search,
  PlusCircle,
  Eye,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { BASE_URL } from "../utils/constant";

const ShowPapersPage: React.FC = () => {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState<string>("Selected Project");
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("Idle");
  const [ingesting, setIngesting] = useState(false);
  const [filterState, setFilterState] = useState<any>({
    search: "",
    sort: "citations",
  });
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const papersPerPage = 10;

  // Load project data
  useEffect(() => {
    const storedId = localStorage.getItem("selectedProjectId");
    const storedName = localStorage.getItem("selectedProjectName");
    if (storedId) setProjectId(parseInt(storedId));
    if (storedName) setProjectName(storedName);
    else setStatusMsg("⚠️ No project selected in navbar.");
  }, []);

  // Fetch papers (default)
  const fetchPapers = async (id: number) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${BASE_URL}/papers/project/${id}?limit=100&sort_by=citations&order=desc&include_authors=true`,
        { headers: { accept: "application/json" } }
      );
      const data = await res.json();
      if (res.ok && data?.papers) {
        setPapers(data.papers);
        setStatusMsg(`✅ Loaded ${data.paper_count} papers.`);
      } else {
        setStatusMsg("⚠️ No papers found.");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("❌ Failed to load papers.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch recommended papers
  const fetchRecommendedPapers = async (id: number) => {
    try {
      setLoading(true);
      setStatusMsg("✨ Loading AI-recommended papers...");
      const res = await fetch(
        `http://127.0.0.1:8000/papers/recommended/${id}?limit=200`,
        { headers: { accept: "application/json" } }
      );
      const data = await res.json();
      if (res.ok && data?.recommended_papers) {
        setPapers(data.recommended_papers);
        setStatusMsg(`🤖 Loaded ${data.recommendation_count} AI-recommended papers.`);
      } else {
        setStatusMsg("⚠️ No recommendations found.");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("❌ Failed to load recommendations.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    if (!projectId) return setStatusMsg("⚠️ Select a project first.");
    setIngesting(true);
    setStatusMsg("⚙️ Fetching papers...");
    try {
      await fetchPapers(projectId);
      setStatusMsg("✅ Papers fetched successfully.");
    } catch {
      setStatusMsg("❌ Fetch failed.");
    } finally {
      setIngesting(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchPapers(projectId);
  }, [projectId]);

  // Filtering (still works for search etc.)
  const filteredPapers = useMemo(() => {
    let filtered = [...papers];
    const { search, sort } = filterState;

    if (search?.trim()) {
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.abstract?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (sort === "citations")
      filtered.sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0));
    else if (sort === "year")
      filtered.sort(
        (a, b) => (b.publication_year || 0) - (a.publication_year || 0)
      );

    return filtered;
  }, [papers, filterState]);

  // Pagination
  const totalPages = Math.ceil(filteredPapers.length / papersPerPage);
  const currentPapers = filteredPapers.slice(
    (currentPage - 1) * papersPerPage,
    currentPage * papersPerPage
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const availableFilters = [
    { key: "year", label: "📅 Year" },
    { key: "journal", label: "🧾 Journal" },
    { key: "citations", label: "📈 Citations" },
    { key: "impact", label: "⭐ Impact Factor" },
  ];

  const handleAddFilter = (key: string) => {
    setFilterState((prev: any) => ({
      ...prev,
      [key]: key === "year" || key === "journal" ? "all" : 0,
    }));
    setShowAddMenu(false);
  };

  const handleRemoveFilter = (key: string) => {
    setFilterState((prev: any) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  return (
    <div className="p-8 space-y-8 transition-all">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mt-16">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📄 {projectName}</h1>
          <p className="text-sm text-gray-500">{statusMsg}</p>
        </div>

        <button
          onClick={handleFetch}
          disabled={ingesting}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition shadow-sm ${
            ingesting
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-700 hover:bg-blue-800 text-white"
          }`}
        >
          {ingesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {ingesting ? "Fetching..." : "Fetch Papers"}
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 shadow-sm rounded-xl p-4">
        <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 w-full sm:w-2/3">
          <Search className="text-gray-500 h-4 w-4 mr-2" />
          <input
            type="text"
            placeholder="Search by title or abstract..."
            className="bg-transparent outline-none w-full text-sm"
            value={filterState.search}
            onChange={(e) =>
              setFilterState((prev: any) => ({
                ...prev,
                search: e.target.value,
              }))
            }
          />
        </div>

        <div className="flex items-center gap-3">
          {/* AI Recommendations Button */}
          <button
            onClick={() => {
              if (projectId) fetchRecommendedPapers(projectId);
              else setStatusMsg("⚠️ Select a project first.");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              loading
                ? "bg-purple-300 text-gray-200 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            }`}
          >
            <Sparkles className="h-4 w-4" /> AI Recommendations
          </button>

          {/* Add Filter Button */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              Add Filter
            </button>

            {showAddMenu && (
              <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 w-40">
                {availableFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => handleAddFilter(f.key)}
                    disabled={filterState[f.key] !== undefined}
                    className={`block w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-gray-100 ${
                      filterState[f.key] !== undefined
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-gray-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Papers List */}
      {loading ? (
        <div className="flex justify-center items-center py-10 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading papers...
        </div>
      ) : currentPapers.length > 0 ? (
        <>
          <div className="space-y-6">
            {currentPapers.map((paper) => (
              <div
                key={paper.paper_id}
                className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-4">
                    <h3 className="font-semibold text-lg text-gray-900 mb-2">
                      {paper.title}
                    </h3>
                    {paper.abstract && (
                      <div className="text-gray-600 text-sm mb-4">
                        <p>{paper.abstract.slice(0, 350)}...</p>
                      </div>
                    )}
                    <hr className="border-t border-gray-200 my-3" />
                  </div>

                  <div className="text-sm text-gray-700 font-medium text-right min-w-[160px] space-y-1">
                    <p>📅 {paper.publication_year || "—"}</p>
                    <p>📈 {paper.citation_count || 0} Citations</p>
                    <p>⭐ {paper.impact_factor || "—"} Impact</p>
                    <p>🧾 {paper.journal || "—"}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4">
                  {paper.oa_url && (
                    <a
                      href={paper.oa_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Download className="h-4 w-4" /> Download
                    </a>
                  )}

                  <Link
                    to={`/app/papers/${paper.paper_id}`}
                    className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Eye className="h-4 w-4" />
                    View More
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-2 text-sm rounded-lg border ${
                  currentPage === 1
                    ? "text-gray-400 border-gray-200 cursor-not-allowed"
                    : "text-blue-700 border-blue-300 hover:bg-blue-50"
                }`}
              >
                ← Prev
              </button>

              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-2 text-sm rounded-lg border ${
                      currentPage === page
                        ? "bg-blue-600 text-white border-blue-600"
                        : "text-blue-700 border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-3 py-2 text-sm rounded-lg border ${
                  currentPage === totalPages
                    ? "text-gray-400 border-gray-200 cursor-not-allowed"
                    : "text-blue-700 border-blue-300 hover:bg-blue-50"
                }`}
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500 text-sm">No matching papers found.</p>
      )}
    </div>
  );
};

export default ShowPapersPage;
