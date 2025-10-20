// src/pages/LiteratureDetailPage.tsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/constant";
import {
  Loader2,
  Download,
  Trash2,
  ChevronLeft,
  AlertTriangle,
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

type ReviewResponse = {
  paper_id: number;
  summary_text?: string;
  strengths?: string[];
  weaknesses?: string[];
  gaps?: string[];
  peer_reviewed?: boolean;
  critique_score?: number;
  tone?: string;
  sentiment_score?: number;
  semantic_patterns?: string[];
  created_at?: string;
  message?: string;
  title?: string; // optional title if available
};

const LiteratureDetailPage: React.FC = () => {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // action states
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // custom delete modal flag
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Try to get project id from localStorage to find file path (optional)
  const projectId = Number(localStorage.getItem("selectedProjectId") || 0);

  // ref to the printable part of the page
  const printableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchReview = async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BASE_URL}/literature/review/${id}`, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Server returned ${res.status}: ${text}`);
        }
        const data = await res.json();
        setReview(data);
      } catch (err: any) {
        console.error(err);
        setError("Failed to load literature review.");
      } finally {
        setLoading(false);
      }
    };

    const fetchFilePath = async (id: number) => {
      if (!projectId) return;
      try {
        const res = await fetch(`${BASE_URL}/literature/project/${projectId}/papers`, {
          headers: { accept: "application/json" },
        });
        const data = await res.json();
        if (res.ok && data?.papers) {
          const found = (data.papers as any[]).find((p) => String(p.paper_id) === String(id));
          if (found?.file_path) setFilePath(found.file_path);
        }
      } catch (err) {
        console.warn("Could not fetch file path", err);
      }
    };

    if (paperId) {
      fetchReview(paperId);
      fetchFilePath(Number(paperId));
    }
  }, [paperId, projectId]);

  // Delete handler that calls API
  const performDelete = async () => {
    if (!review) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`${BASE_URL}/literature/paper/${review.paper_id}`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(`Delete failed: ${res.status} ${JSON.stringify(data)}`);
      }

      setSuccessMessage(data?.message ?? "Paper deleted.");
      setShowDeleteModal(false);

      // navigate back to list (user-friendly)
      navigate("/app/literature");
    } catch (err: any) {
      console.error("Delete error:", err);
      setError("Failed to delete paper. Try again or check server connectivity.");
    } finally {
      setDeleting(false);
    }
  };

  // Download page as PDF handler
  const handleDownloadPdf = async () => {
    if (!printableRef.current) return;
    setDownloading(true);
    setError(null);

    try {
      const canvas = await html2canvas(printableRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidthMm = pdfWidth;
      const imgHeightMm = (canvas.height / canvas.width) * imgWidthMm;

      let heightLeft = imgHeightMm;

      if (imgHeightMm <= pdfHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, imgWidthMm, imgHeightMm);
      } else {
        let y = 0;
        while (heightLeft > 0) {
          pdf.addImage(imgData, "PNG", 0, y, imgWidthMm, imgHeightMm);
          heightLeft -= pdfHeight;
          y -= pdfHeight;
          if (heightLeft > 0) pdf.addPage();
        }
      }

      const filename = `literature-review-${review?.paper_id ?? "paper"}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("PDF generation failed", err);
      setError("Failed to generate PDF. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  // New back action: prefer history back, otherwise go to literature list
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/app/literature");
    }
  };

  if (loading) {
    return (
      <div className="pt-20 p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading review...
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="pt-20 p-6 text-red-600">{error}</div>;
  }

  if (!review) {
    return <div className="pt-20 p-6 text-gray-500">No review found for this paper.</div>;
  }

  return (
    <div className="pt-20 p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-4">
          {/* BACK LINK BUTTON */}
          <button
            onClick={handleBack}
            aria-label="Back"
            className="inline-flex items-center gap-2 px-3 py-1.5 border rounded text-sm bg-white hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          <div>
            <h1 className="text-2xl font-bold">
              {review.title ? review.title + " — " : ""}Paper {review.paper_id}
            </h1>
            <p className="text-sm text-gray-500">
              {review.tone ? `${review.tone} • Critique score: ${review.critique_score ?? "—"}` : ""}
            </p>
          </div>
        </div>

        <div className="text-right flex items-center gap-3">
          {filePath && (
            <a
              href={`${BASE_URL}/${filePath.replace(/\\/g, "/")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-700"
            >
              <Download className="h-4 w-4" /> Download original
            </a>
          )}

          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            aria-label="Download page as PDF"
            className="inline-flex items-center gap-2 px-3 py-1.5 border rounded text-sm bg-white hover:bg-gray-50"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>{downloading ? "Preparing PDF..." : "Download page (PDF)"}</span>
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={deleting}
            aria-label="Delete paper"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded text-sm hover:bg-red-100"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span>{deleting ? "Deleting..." : "Delete paper"}</span>
          </button>
        </div>
      </div>

      {/* Show success / error */}
      {successMessage && <div className="text-green-600">{successMessage}</div>}
      {error && <div className="text-red-600">{error}</div>}

      {/* Printable area */}
      <div ref={printableRef} className="space-y-6">
        {review.summary_text && (
          <div className="bg-white border rounded p-4">
            <h3 className="font-semibold mb-2">Summary</h3>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">{review.summary_text}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border rounded p-4">
            <h4 className="font-semibold">Strengths</h4>
            {review.strengths?.length ? (
              <ul className="list-disc list-inside text-sm text-gray-700 mt-2">
                {review.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 mt-2">No strengths listed.</p>
            )}
          </div>

          <div className="bg-white border rounded p-4">
            <h4 className="font-semibold">Weaknesses</h4>
            {review.weaknesses?.length ? (
              <ul className="list-disc list-inside text-sm text-gray-700 mt-2">
                {review.weaknesses.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 mt-2">No weaknesses listed.</p>
            )}
          </div>

          <div className="bg-white border rounded p-4">
            <h4 className="font-semibold">Gaps</h4>
            {review.gaps?.length ? (
              <ul className="list-disc list-inside text-sm text-gray-700 mt-2">
                {review.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 mt-2">No gaps listed.</p>
            )}
          </div>
        </div>

        <div className="bg-white border rounded p-4">
          <h4 className="font-semibold mb-2">Metadata</h4>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
            <div>
              Peer reviewed: <span className="font-medium">{review.peer_reviewed ? "Yes" : "No"}</span>
            </div>
            <div>
              Critique score: <span className="font-medium">{review.critique_score ?? "—"}</span>
            </div>
            <div>
              Created at: <span className="font-medium">{review.created_at ?? "—"}</span>
            </div>
            <div>
              Sentiment:{" "}
              <span className="font-medium">
                {typeof review.sentiment_score === "number" ? review.sentiment_score : "—"}
              </span>
            </div>
          </div>
        </div>

        {review.semantic_patterns?.length ? (
          <div className="bg-white border rounded p-4">
            <h4 className="font-semibold mb-2">Semantic Patterns / Keywords</h4>
            <div className="flex flex-wrap gap-2">
              {review.semantic_patterns.map((s, i) => (
                <span key={i} className="text-sm bg-gray-100 px-3 py-1 rounded">
                  {s}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Link to="/app/literature" className="text-sm text-blue-700 hover:underline">
          ← Back to literature list
        </Link>
      </div>

      {/* DELETE CONFIRMATION MODAL (styled) */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-lg p-6 text-center">
            <AlertTriangle className="h-10 w-10 text-red-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Paper?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-900">
                {review.title ? review.title : `Paper ${review.paper_id}`}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={performDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>{deleting ? "Deleting..." : "Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiteratureDetailPage;
