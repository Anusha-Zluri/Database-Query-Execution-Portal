import { useState, useEffect } from "react";
import { getMySubmissions, cloneSubmission, getSubmissionDetails } from "../api/submissions.api";

export default function MySubmissions({ onClone }) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getMySubmissions();
      setSubmissions(data || []);
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
      setError("Failed to load submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleClone = async (submissionId) => {
    try {
      const result = await cloneSubmission(submissionId);
      // Notify parent to switch to Submit Requests tab and load the draft
      if (onClone) {
        onClone(result.id);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to clone submission");
    }
  };

  const handleViewDetails = async (submissionId, status) => {
    if (status === "EXECUTED" || status === "FAILED") {
      try {
        const details = await getSubmissionDetails(submissionId);
        console.log("=== FULL SUBMISSION DETAILS ===");
        console.log("Full object:", details);
        console.log("Content field:", details.content);
        console.log("Content type:", typeof details.content);
        console.log("Content length:", details.content?.length);
        console.log("Request type:", details.requestType);
        console.log("All keys:", Object.keys(details));
        setSelectedSubmission(details);
        setShowDetailsModal(true);
      } catch (err) {
        console.error("Error loading details:", err);
        setError(err.response?.data?.message || "Failed to load submission details");
      }
    }
  };

  const handleDownloadResults = async (executionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/executions/${executionId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `execution_${executionId}_results.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError("Failed to download results");
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "EXECUTED":
        return "✓";
      case "PENDING":
        return "⏳";
      case "REJECTED":
        return "✗";
      case "FAILED":
        return "△";
      default:
        return "";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "EXECUTED":
        return "bg-green-100 text-green-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "REJECTED":
        return "bg-red-100 text-red-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const filteredSubmissions = statusFilter === "ALL" 
    ? submissions 
    : submissions.filter(s => s.status === statusFilter);

  const getStatusCount = (status) => {
    if (status === "ALL") return submissions.length;
    return submissions.filter(s => s.status === status).length;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getQueryPreview = (submission) => {
    if (submission.request_type === "SCRIPT") {
      return (
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-blue-600 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span>JavaScript Execution Script</span>
        </div>
      );
    }
    // For queries, show first 50 chars
    const content = submission.query_text || submission.content || "";
    return content.length > 50 ? content.substring(0, 50) + "..." : content;
  };

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "ALL"
                ? "bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] text-white shadow-md"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            All ({getStatusCount("ALL")})
          </button>
          <button
            onClick={() => setStatusFilter("PENDING")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "PENDING"
                ? "bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] text-white shadow-md"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Pending ({getStatusCount("PENDING")})
          </button>
          <button
            onClick={() => setStatusFilter("EXECUTED")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "EXECUTED"
                ? "bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] text-white shadow-md"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Executed ({getStatusCount("EXECUTED")})
          </button>
          <button
            onClick={() => setStatusFilter("REJECTED")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "REJECTED"
                ? "bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] text-white shadow-md"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Rejected ({getStatusCount("REJECTED")})
          </button>
          <button
            onClick={() => setStatusFilter("FAILED")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "FAILED"
                ? "bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] text-white shadow-md"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Failed ({getStatusCount("FAILED")})
          </button>
        </div>

        <button
          onClick={() => fetchSubmissions()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] text-white rounded-lg hover:shadow-md transition-all disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredSubmissions.length === 0 ? (
          <div className="text-center py-16">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-slate-300 mx-auto mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No submissions found</h3>
            <p className="text-slate-600 text-sm">Submit a query from the Submit Requests page</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Database</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Query Preview</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSubmissions.map((submission) => (
                <tr key={submission.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{submission.id}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{submission.db_instance} / {submission.db_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">{getQueryPreview(submission)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                      <span>{getStatusIcon(submission.status)}</span>
                      {submission.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{formatDate(submission.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetails(submission.id, submission.status)}
                        disabled={submission.status !== "EXECUTED" && submission.status !== "FAILED"}
                        className={`p-2 rounded-lg transition-colors ${
                          submission.status === "EXECUTED" || submission.status === "FAILED"
                            ? "text-slate-600 hover:text-[#1a9d7c] hover:bg-slate-100"
                            : "text-slate-300 cursor-not-allowed"
                        }`}
                        title={
                          submission.status === "EXECUTED" || submission.status === "FAILED"
                            ? "View Details" 
                            : "Only available for executed/failed submissions"
                        }
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleClone(submission.id)}
                        className="p-2 text-slate-600 hover:text-[#1a9d7c] hover:bg-slate-100 rounded-lg transition-colors"
                        title="Clone & Resubmit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      {filteredSubmissions.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Legend:</span>
              <span className="text-slate-600">👁️ = View Details</span>
              <span className="text-slate-600">🔄 = Clone & Resubmit</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-slate-700">Status:</span>
              <span className="text-slate-600">✓ Executed</span>
              <span className="text-slate-600">⏳ Pending</span>
              <span className="text-slate-600">✗ Rejected</span>
              <span className="text-slate-600">△ Failed</span>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Submission Details</h2>
                <p className="text-sm text-slate-600 mt-0.5">Request ID: {selectedSubmission.id}</p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedSubmission(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Request Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Database Instance</label>
                  <p className="text-sm text-slate-900 mt-1">{selectedSubmission.dbInstance}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Database Name</label>
                  <p className="text-sm text-slate-900 mt-1">{selectedSubmission.dbName}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Request Type</label>
                  <p className="text-sm text-slate-900 mt-1">{selectedSubmission.requestType}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                  <p className="text-sm text-slate-900 mt-1">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedSubmission.status)}`}>
                      <span>{getStatusIcon(selectedSubmission.status)}</span>
                      {selectedSubmission.status}
                    </span>
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted At</label>
                  <p className="text-sm text-slate-900 mt-1">
                    {new Date(selectedSubmission.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {/* Comment */}
              {selectedSubmission.comment && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comment</label>
                  <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-lg p-3 border border-slate-200">
                    {selectedSubmission.comment}
                  </p>
                </div>
              )}

              {/* Query/Script */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {selectedSubmission.requestType === "SCRIPT" ? "Script File" : "Query"}
                </label>
                {selectedSubmission.content ? (
                  <pre className="text-sm text-slate-100 mt-1 bg-slate-900 rounded-lg p-4 overflow-x-auto font-mono whitespace-pre-wrap">
{selectedSubmission.content}
                  </pre>
                ) : (
                  <div className="mt-1 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-600">No content available</p>
                    <p className="text-xs text-red-500 mt-1">Debug: {JSON.stringify(selectedSubmission)}</p>
                  </div>
                )}
              </div>

              {/* Execution Details */}
              {selectedSubmission.execution && (
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Execution Details</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Execution Status</label>
                      <p className="text-sm text-slate-900 mt-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                          selectedSubmission.execution.status === "SUCCESS" 
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                        }`}>
                          {selectedSubmission.execution.status === "SUCCESS" ? "✓" : "✗"} {selectedSubmission.execution.status}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {selectedSubmission.execution.durationMs ? `${selectedSubmission.execution.durationMs}ms` : "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Started At</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {selectedSubmission.execution.startedAt 
                          ? new Date(selectedSubmission.execution.startedAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Finished At</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {selectedSubmission.execution.finishedAt 
                          ? new Date(selectedSubmission.execution.finishedAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Error Message */}
                  {selectedSubmission.execution.error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <label className="text-xs font-semibold text-red-700 uppercase tracking-wider">Error Message</label>
                      <pre className="text-sm text-red-900 mt-2 whitespace-pre-wrap font-mono">
{selectedSubmission.execution.error}
                      </pre>
                    </div>
                  )}

                  {/* Result */}
                  {selectedSubmission.execution.result && selectedSubmission.execution.status === "SUCCESS" && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Result</label>
                        {selectedSubmission.execution.isTruncated && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded">
                              ⚠️ Showing preview (100 rows)
                            </span>
                            {selectedSubmission.execution.hasFullResultFile && (
                              <button
                                onClick={() => handleDownloadResults(selectedSubmission.execution.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] text-white text-xs font-medium rounded-lg hover:shadow-md transition-all"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                Download Full Results (10,000 rows)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-96 overflow-auto">
                        <pre className="text-xs text-slate-900 font-mono whitespace-pre-wrap">
{JSON.stringify(selectedSubmission.execution.result, null, 2)}
                        </pre>
                      </div>
                      {selectedSubmission.execution.isTruncated && (
                        <p className="text-xs text-slate-600 mt-2 italic">
                          Results with more than 10,000 rows are truncated. Download the full results file to see the first 10,000 rows.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedSubmission(null);
                }}
                className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
