import axios from '../utils/axios';

export const getApprovalAnalytics = async () => {
  const response = await axios.get('/analytics/approvals');
  return response.data;
};
