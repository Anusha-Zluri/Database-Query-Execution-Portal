import axios from "../utils/axios";

export const getPendingApprovals = async (filters = {}) => {
  const res = await axios.get("/approvals/pending", { params: filters });
  return res.data;
};

export const approveRequest = async (requestId) => {
  const res = await axios.post(`/approvals/${requestId}/approve`);
  return res.data;
};

export const rejectRequest = async (requestId, reason) => {
  const res = await axios.post(`/approvals/${requestId}/reject`, { reason });
  return res.data;
};
