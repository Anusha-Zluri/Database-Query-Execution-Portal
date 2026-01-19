const {
  getManagerPods,
  getTopSubmitters,
  getRequestTypes,
  getStatusBreakdown,
  getPodDistribution,
  getRecentActivity,
  getDbTypes
} = require('../dal/analytics.dal');

/**
 * Get approval analytics for managers
 */
const getApprovalAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get manager's PODs
    const podIds = await getManagerPods(userId);
    
    if (podIds.length === 0) {
      return res.status(403).json({ error: 'Not a manager of any POD' });
    }

    // Fetch all analytics data
    const [topSubmitters, requestTypes, statusBreakdown, podDistribution, recentActivity, dbTypes] = await Promise.all([
      getTopSubmitters(podIds),
      getRequestTypes(podIds),
      getStatusBreakdown(podIds),
      getPodDistribution(podIds),
      getRecentActivity(podIds),
      getDbTypes(podIds)
    ]);

    res.json({
      topSubmitters,
      requestTypes,
      statusBreakdown,
      podDistribution,
      recentActivity,
      dbTypes
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

module.exports = { getApprovalAnalytics };
