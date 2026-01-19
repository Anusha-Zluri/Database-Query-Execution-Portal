const { pool } = require('../config/db');

/**
 * Get manager's PODs
 */
const getManagerPods = async (userId) => {
  const result = await pool.query(
    `SELECT id FROM pods WHERE manager_user_id = $1 AND is_active = true`,
    [userId]
  );
  return result.rows.map(row => row.id);
};

/**
 * Get top submitters for given PODs
 */
const getTopSubmitters = async (podIds) => {
  const result = await pool.query(
    `
    SELECT 
      u.username,
      u.email,
      COUNT(*) as request_count
    FROM requests r
    JOIN users u ON r.requester_id = u.id
    WHERE r.pod_id = ANY($1)
    GROUP BY u.id, u.username, u.email
    ORDER BY request_count DESC
    LIMIT 10
    `,
    [podIds]
  );
  return result.rows;
};

/**
 * Get request type breakdown
 */
const getRequestTypes = async (podIds) => {
  const result = await pool.query(
    `
    SELECT 
      request_type,
      COUNT(*) as count
    FROM requests
    WHERE pod_id = ANY($1)
    GROUP BY request_type
    `,
    [podIds]
  );
  return result.rows;
};

/**
 * Get status breakdown
 */
const getStatusBreakdown = async (podIds) => {
  const result = await pool.query(
    `
    SELECT 
      CASE 
        WHEN status IN ('APPROVED', 'EXECUTED') THEN 'APPROVED'
        ELSE status
      END as status,
      COUNT(*) as count
    FROM requests
    WHERE pod_id = ANY($1)
    GROUP BY CASE 
        WHEN status IN ('APPROVED', 'EXECUTED') THEN 'APPROVED'
        ELSE status
      END
    `,
    [podIds]
  );
  return result.rows;
};

/**
 * Get POD distribution
 */
const getPodDistribution = async (podIds) => {
  const result = await pool.query(
    `
    SELECT 
      p.name as pod_name,
      COUNT(*) as count
    FROM requests r
    JOIN pods p ON r.pod_id = p.id
    WHERE r.pod_id = ANY($1)
    GROUP BY p.id, p.name
    ORDER BY count DESC
    `,
    [podIds]
  );
  return result.rows;
};

/**
 * Get recent activity for last 7 days
 */
const getRecentActivity = async (podIds) => {
  const result = await pool.query(
    `
    WITH date_series AS (
      SELECT generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        '1 day'::interval
      )::date AS date
    )
    SELECT 
      TO_CHAR(ds.date, 'YYYY-MM-DD') as date,
      COUNT(r.id)::integer as count
    FROM date_series ds
    LEFT JOIN requests r ON DATE(r.created_at) = ds.date AND r.pod_id = ANY($1)
    GROUP BY ds.date
    ORDER BY ds.date ASC
    `,
    [podIds]
  );
  return result.rows;
};

/**
 * Get database type breakdown
 */
const getDbTypes = async (podIds) => {
  const result = await pool.query(
    `
    SELECT 
      db_instance,
      COUNT(*) as count
    FROM requests
    WHERE pod_id = ANY($1)
    GROUP BY db_instance
    ORDER BY count DESC
    LIMIT 5
    `,
    [podIds]
  );
  return result.rows;
};

module.exports = {
  getManagerPods,
  getTopSubmitters,
  getRequestTypes,
  getStatusBreakdown,
  getPodDistribution,
  getRecentActivity,
  getDbTypes
};
