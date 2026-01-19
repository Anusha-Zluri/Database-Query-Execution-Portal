import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getPendingApprovals, approveRequest, rejectRequest } from "../api/approvals.api";
import { getPods } from "../api/pods.api";
import { getApprovalAnalytics } from "../api/analytics.api";
import axios from "../utils/axios";

export default function ApprovalDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [podFilter, setPodFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pods, setPods] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [viewModal, setViewModal] = useState({ open: false, content: "", type: "", id: null, metadata: null });
  const [rejectModal, setRejectModal] = useState({ open: false, requestId: null });
  const [rejectReason, setRejectReason] = useState("");
  const [approving, setApproving] = useState(null); // Track which request is being approved
  const [copySuccess, setCopySuccess] = useState(false);
  const [insightsModal, setInsightsModal] = useState({ open: false, data: null, loading: false });
  const itemsPerPage = 10;

  const toggleComment = (id) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedComments(newExpanded);
  };

  // Fetch PODs on mount
  useEffect(() => {
    const loadPods = async () => {
      try {
        const data = await getPods();
        setPods(data || []); // Backend returns rows directly
      } catch (err) {
        console.error("Failed to fetch pods:", err);
      }
    };
    loadPods();
  }, []);

  // Fetch approvals
  useEffect(() => {
    fetchApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, podFilter, dateFrom, dateTo, searchQuery, currentPage]);

  const fetchApprovals = async () => {
    setLoading(true);
    setError("");
    try {
      const filters = {
        page: currentPage,
        limit: itemsPerPage
      };
      if (statusFilter) {
        filters.status = statusFilter;
      }
      if (podFilter) {
        filters.pod_id = podFilter;
      }
      if (dateFrom) {
        filters.from = dateFrom;
      }
      if (dateTo) {
        filters.to = dateTo;
      }
      if (searchQuery.trim()) {
        filters.search = searchQuery.trim();
      }
      const data = await getPendingApprovals(filters);
      setApprovals(data.requests || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch approvals:", err);
      // Show specific error message from backend (403, 404, etc.)
      setError(err.response?.data?.message || "Failed to load approvals. Please try again.");
      // Clear approvals on error
      setApprovals([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async () => {
    setInsightsModal({ open: true, data: null, loading: true });
    try {
      const data = await getApprovalAnalytics();
      setInsightsModal({ open: true, data, loading: false });
    } catch (err) {
      console.error("Failed to fetch insights:", err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || "Failed to load insights";
      toast.error(errorMsg);
      setInsightsModal({ open: false, data: null, loading: false });
    }
  };

  const handleApprove = async (requestId) => {
    setApproving(requestId);
    setError("");
    try {
      await approveRequest(requestId);
      toast.success("Request approved successfully!");
      // Refresh the list
      fetchApprovals();
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to approve request";
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (requestId) => {
    setRejectModal({ open: true, requestId });
    setRejectReason("");
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      setError("Please provide a reason for rejection");
      return;
    }

    try {
      await rejectRequest(rejectModal.requestId, rejectReason);
      toast.success("Request rejected successfully!");
      setRejectModal({ open: false, requestId: null });
      setRejectReason("");
      setError(""); // Clear any previous errors
      // Refresh the list
      fetchApprovals();
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to reject request";
      toast.error(errorMsg);
      setError(errorMsg);
    }
  };

  const cancelReject = () => {
    setRejectModal({ open: false, requestId: null });
    setRejectReason("");
    setError(""); // Clear error when canceling
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, podFilter, dateFrom, dateTo, searchQuery]);

  const handleViewContent = async (approval) => {
    if (approval.type === "SCRIPT") {
      // Fetch script content from API
      try {
        const response = await axios.get(`/approvals/${approval.id}/script`);
        setViewModal({
          open: true,
          content: response.data.preview,
          type: "SCRIPT",
          id: approval.id,
          metadata: approval,
        });
      } catch (err) {
        console.error("Failed to load script:", err);
        const errorMsg = err.response?.data?.message || "Failed to load script content";
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } else {
      // For queries, content is already available
      setViewModal({
        open: true,
        content: approval.content,
        type: "QUERY",
        id: approval.id,
        metadata: approval,
      });
    }
  };

  const closeModal = () => {
    setViewModal({ open: false, content: "", type: "", id: null, metadata: null });
    setCopySuccess(false); // Reset copy state
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ESC to close modals
      if (e.key === 'Escape') {
        if (viewModal.open) {
          closeModal();
        }
        if (rejectModal.open) {
          cancelReject();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewModal.open, rejectModal.open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter approvals by search query - NO LONGER NEEDED, search is server-side
  const filteredApprovals = approvals;

  return (
    <div className="space-y-6">
      {/* COMMENTED OUT: Risk Detection Advisory - No longer using risk detection */}
      {/*
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
        <div className="flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900 mb-1">Risk Detection Advisory</h3>
            <p className="text-sm text-amber-800">
              Automated risk detection is <strong>advisory only</strong> and may not catch all dangerous operations. 
              Please <strong>carefully review all requests</strong> regardless of risk level before approving. 
              When in doubt, reject and request clarification.
            </p>
          </div>
        </div>
      </div>
      */}

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a9d7c] focus:border-transparent"
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* POD Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">POD</label>
            <select
              value={podFilter}
              onChange={(e) => setPodFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a9d7c] focus:border-transparent"
            >
              <option value="">All PODs</option>
              {pods.map((pod) => (
                <option key={pod.id} value={pod.id}>
                  {pod.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                const newFrom = e.target.value;
                setDateFrom(newFrom);
                // If "To" date is before "From" date, clear "To"
                if (dateTo && newFrom && new Date(newFrom) > new Date(dateTo)) {
                  setDateTo("");
                }
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a9d7c] focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">To</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a9d7c] focus:border-transparent"
            />
          </div>

          {(dateFrom || dateTo || podFilter) && (
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setPodFilter("");
              }}
              className="text-xs text-slate-600 hover:text-slate-900 underline ml-2"
            >
              Clear filters
            </button>
          )}

          {/* Search - pushed to right */}
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="text"
              placeholder="Search all results..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a9d7c] focus:border-transparent"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchApprovals}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] text-white rounded-lg hover:shadow-md transition-all disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>

          {/* Insights Button */}
          <button
            onClick={fetchInsights}
            title="View Insights"
            className="flex items-center justify-center p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a9d7c]"></div>
            <p className="text-slate-600 text-sm mt-3">Loading approvals...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[6%]" />
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[7%]" />
                <col className="w-[10%]" />
                <col className="w-[23%]" />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Database
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Request
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    POD
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Comments
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredApprovals.map((approval) => (
                  <tr 
                    key={approval.id} 
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-4 text-sm text-slate-900 font-medium truncate">
                      {approval.database}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {approval.id}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {approval.type === "SCRIPT" ? (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-blue-600 flex-shrink-0">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <span className="text-sm text-slate-600 truncate">JavaScript Execution Script</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-900 font-mono truncate flex-1 min-w-0">
                            {approval.content?.substring(0, 60) + (approval.content?.length > 60 ? "..." : "")}
                          </span>
                        )}
                        
                        {/* COMMENTED OUT: Risk Warning Icon - No longer using risk detection */}
                        {/*
                        {approval.risk_level === 'HIGH' && approval.has_dangerous_ops && (
                          <div className="relative group flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-600">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-10 pointer-events-none">
                              <div className="bg-slate-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
                                ⚠️ High Risk - Contains dangerous operations
                                <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-1">
                                  <div className="border-4 border-transparent border-t-slate-900"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        */}
                        
                        <button
                          onClick={() => handleViewContent(approval)}
                          className="flex-shrink-0 p-1.5 text-slate-400 hover:text-[#1a9d7c] hover:bg-slate-100 rounded transition-colors"
                          title="View full content"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600 truncate">
                      {approval.requester}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {approval.pod}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          approval.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-800"
                            : approval.status === "APPROVED" || approval.status === "EXECUTED"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {approval.status === "EXECUTED" ? "APPROVED" : approval.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <div className="text-sm text-slate-600 break-words">
                          {approval.comments && approval.comments.length > 80 ? (
                            <>
                              {expandedComments.has(approval.id) ? (
                                <div className="whitespace-pre-wrap">
                                  {approval.comments}
                                  <button
                                    onClick={() => toggleComment(approval.id)}
                                    className="block mt-1 text-[#1a9d7c] hover:text-[#14b8a6] font-medium text-xs"
                                  >
                                    Show less
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="line-clamp-2">
                                    {approval.comments}
                                  </span>
                                  <button
                                    onClick={() => toggleComment(approval.id)}
                                    className="block mt-1 text-[#1a9d7c] hover:text-[#14b8a6] font-medium text-xs"
                                  >
                                    Show more
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <span className="break-words">{approval.comments}</span>
                          )}
                        </div>
                        {approval.status === "PENDING" && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleApprove(approval.id)}
                              disabled={approving === approval.id}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] rounded-md hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {approving === approval.id ? "Approving..." : "Approve"}
                            </button>
                            <button
                              onClick={() => handleReject(approval.id)}
                              disabled={approving === approval.id}
                              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredApprovals.length === 0 && (
          <div className="text-center py-12">
            {error ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-red-400 mx-auto mb-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-red-600 text-sm font-medium">
                  {error}
                </p>
                <button
                  onClick={() => setPodFilter("")}
                  className="mt-3 text-sm text-[#1a9d7c] hover:text-[#14b8a6] underline font-medium"
                >
                  View all PODs
                </button>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-slate-400 mx-auto mb-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-slate-600 text-sm">
                  {searchQuery 
                    ? `No approvals match "${searchQuery}"` 
                    : `No ${statusFilter.toLowerCase()} approvals found`}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-2 text-sm text-[#1a9d7c] hover:text-[#14b8a6] underline"
                  >
                    Clear search
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && total > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, total)} of {total} results
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &lt; Previous
            </button>
            
            {/* Show first page */}
            {currentPage > 3 && (
              <>
                <button
                  onClick={() => setCurrentPage(1)}
                  className="px-3 py-1.5 text-sm rounded-md text-slate-600 hover:bg-slate-100"
                >
                  1
                </button>
                {currentPage > 4 && <span className="px-2 text-sm text-slate-400">...</span>}
              </>
            )}
            
            {/* Show pages around current */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => page >= currentPage - 2 && page <= currentPage + 2)
              .map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    currentPage === page
                      ? "bg-[#1a9d7c] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {page}
                </button>
              ))}
            
            {/* Show last page */}
            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && <span className="px-2 text-sm text-slate-400">...</span>}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className="px-3 py-1.5 text-sm rounded-md text-slate-600 hover:bg-slate-100"
                >
                  {totalPages}
                </button>
              </>
            )}
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next &gt;
            </button>
          </div>
        </div>
      )}

      {/* View Content Modal */}
      {viewModal.open && viewModal.metadata && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1a9d7c] to-[#14b8a6] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {viewModal.type === "SCRIPT" ? "Script Content" : "Query Content"}
                  </h3>
                  <p className="text-sm text-slate-500">Request ID: {viewModal.id}</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Request Metadata */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Database</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{viewModal.metadata.database}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Type</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{viewModal.metadata.type}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">POD</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{viewModal.metadata.pod}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</p>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                      viewModal.metadata.status === "PENDING"
                        ? "bg-yellow-100 text-yellow-800"
                        : viewModal.metadata.status === "APPROVED" || viewModal.metadata.status === "EXECUTED"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {viewModal.metadata.status === "EXECUTED" ? "APPROVED" : viewModal.metadata.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Submitted By</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{viewModal.metadata.requester}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Submitted At</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {viewModal.metadata.submitted_at ? new Date(viewModal.metadata.submitted_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    }) : 'N/A'}
                  </p>
                </div>
                {viewModal.metadata.comments && (
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Comments</p>
                    <p className="text-sm text-slate-700 mt-1 line-clamp-2">{viewModal.metadata.comments}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* COMMENTED OUT: Risk Warning - No longer using risk detection */}
              {/*
              {viewModal.metadata.risk_level === 'HIGH' && viewModal.metadata.has_dangerous_ops && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-red-900 mb-1">⚠️ High Risk Operation Detected</h4>
                    <p className="text-sm text-red-700">
                      {viewModal.type === "SCRIPT" 
                        ? "This script contains potentially dangerous APIs or operations. Please review carefully before approval."
                        : "This query contains destructive operations (DROP, DELETE, TRUNCATE, etc.). Please verify before approval."}
                    </p>
                  </div>
                </div>
              )}
              */}
              
              <div className="bg-slate-900 rounded-lg p-4 max-h-96 overflow-auto">
                <pre className="text-sm text-slate-100 font-mono whitespace-pre-wrap break-words">
                  {viewModal.content}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-600">
                {viewModal.type === "SCRIPT" ? "JavaScript file" : "SQL/MongoDB query"}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(viewModal.content);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {copySuccess ? "✓ Copied!" : "Copy"}
                </button>
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] rounded-lg hover:shadow-md transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={cancelReject}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Reject Request</h3>
              </div>
              <button
                onClick={cancelReject}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Portal Name Bar */}
            <div className="px-6 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-xs text-slate-500">Database Query Execution Portal</p>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                onKeyDown={(e) => {
                  // Allow Ctrl/Cmd+Enter to submit
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && rejectReason.trim()) {
                    e.preventDefault();
                    confirmReject();
                  }
                }}
                placeholder="Please provide a detailed reason for rejecting this request..."
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-2">
                This reason will be shared with the requester. Press Ctrl+Enter to submit.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={cancelReject}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insights Modal */}
      {insightsModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <h2 className="text-xl font-bold text-white">Approval Insights</h2>
              </div>
              <button
                onClick={() => setInsightsModal({ open: false, data: null, loading: false })}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {insightsModal.loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a9d7c]"></div>
                </div>
              ) : insightsModal.data ? (
                <div className="space-y-6">
                  {/* Status Overview Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {insightsModal.data.statusBreakdown.map((status) => (
                      <div key={status.status} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                        <div className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-1">{status.status}</div>
                        <div className="text-3xl font-bold text-slate-900">{status.count}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Submitters */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[#1a9d7c]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        Top Submitters
                      </h3>
                      <div className="space-y-3">
                        {insightsModal.data.topSubmitters.slice(0, 5).map((submitter, idx) => {
                          const maxCount = insightsModal.data.topSubmitters[0]?.request_count || 1;
                          const percentage = (submitter.request_count / maxCount) * 100;
                          return (
                            <div key={idx}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="font-medium text-slate-700">{submitter.username}</span>
                                <span className="text-slate-600">{submitter.request_count} requests</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                  className="bg-gradient-to-r from-[#1a9d7c] to-[#14b8a6] h-2 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Request Types */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[#1a9d7c]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                        </svg>
                        Request Types
                      </h3>
                      <div className="space-y-3">
                        {insightsModal.data.requestTypes.map((type) => {
                          const total = insightsModal.data.requestTypes.reduce((sum, t) => sum + parseInt(t.count), 0);
                          const percentage = ((type.count / total) * 100).toFixed(1);
                          return (
                            <div key={type.request_type} className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`w-3 h-3 rounded-full ${type.request_type === 'QUERY' ? 'bg-[#1a9d7c]' : 'bg-slate-700'}`}></div>
                                <span className="text-sm font-medium text-slate-700">{type.request_type}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-slate-900">{type.count}</div>
                                <div className="text-xs text-slate-500">{percentage}%</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* POD Distribution */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[#1a9d7c]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                        POD Distribution
                      </h3>
                      <div className="space-y-3">
                        {insightsModal.data.podDistribution.map((pod, idx) => {
                          const maxCount = insightsModal.data.podDistribution[0]?.count || 1;
                          const percentage = (pod.count / maxCount) * 100;
                          return (
                            <div key={idx}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="font-medium text-slate-700">{pod.pod_name}</span>
                                <span className="text-slate-600">{pod.count}</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                  className="bg-gradient-to-r from-slate-700 to-slate-900 h-2 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Database Types */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[#1a9d7c]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                        </svg>
                        Database Instances
                      </h3>
                      <div className="space-y-2">
                        {insightsModal.data.dbTypes.filter(db => db.db_instance).map((db, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                            <span className="text-sm font-medium text-slate-700">{db.db_instance}</span>
                            <span className="text-sm font-semibold text-slate-900">{db.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[#1a9d7c]">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      Recent Activity (Last 7 Days)
                    </h3>
                    {insightsModal.data.recentActivity && insightsModal.data.recentActivity.length > 0 ? (
                      <div className="flex items-end justify-between gap-2 h-48">
                        {insightsModal.data.recentActivity.map((day, idx) => {
                          const maxCount = Math.max(...insightsModal.data.recentActivity.map(d => Number(d.count) || 0), 1);
                          const count = Number(day.count) || 0;
                          const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                              <div className="relative w-full flex items-end justify-center" style={{ height: '160px' }}>
                                <div 
                                  className="w-full bg-gradient-to-t from-[#1a9d7c] to-[#14b8a6] rounded-t-lg transition-all hover:opacity-80" 
                                  style={{ 
                                    height: count > 0 ? `${Math.max(height, 5)}%` : '2px',
                                    minHeight: count > 0 ? '8px' : '2px'
                                  }}
                                ></div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs font-semibold text-slate-900">{count}</div>
                                <div className="text-xs text-slate-500">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">No activity in the last 7 days</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
