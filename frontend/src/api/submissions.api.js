import axios from "../utils/axios";

export const getMySubmissions = async (page = 1, limit = 10, status = 'ALL') => {
  const res = await axios.get("/submissions", {
    params: { page, limit, status }
  });
  return res.data;
};

export const getSubmissionStatusCounts = async () => {
  const res = await axios.get("/submissions/counts");
  return res.data;
};

export const getSubmissionDetails = async (id) => {
  const res = await axios.get(`/submissions/${id}`);
  return res.data;
};

export const cloneSubmission = async (id) => {
  const res = await axios.post(`/submissions/${id}/clone`);
  return res.data;
};

export const getSubmissionForEdit = async (id) => {
  const res = await axios.get(`/submissions/${id}/edit`);
  return res.data;
};
