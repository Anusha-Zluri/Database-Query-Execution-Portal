import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getPendingApprovals, approveRequest, rejectRequest } from "../api/approvals.api";
import { getPods } from "../api/pods.api";
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
                <col className="w-[18%]" /> {/* Database */}
                <col className="w-[6%]" />  {/* ID */}
                <col className="w-[22%]" /> {/* Request */}
                <col className="w-[14%]" /> {/* User */}
                <col className="w-[7%]" />  {/* POD */}
                <col className="w-[10%]" /> {/* Status */}
                <col className="w-[23%]" /> {/* Comments */}
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
                    className={`transition-colors ${
                      approval.risk_level === 'HIGH' && approval.has_dangerous_ops
                        ? 'bg-red-50 hover:bg-red-100'
                        : 'hover:bg-slate-50'
                    }`}
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
                        
                        {/* Risk Warning Icon */}
                        {approval.risk_level === 'HIGH' && approval.has_dangerous_ops && (
                          <div className="relative group flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-600">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            {/* Tooltip */}
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
              {/* Risk Warning */}
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
    </div>
  );
}
