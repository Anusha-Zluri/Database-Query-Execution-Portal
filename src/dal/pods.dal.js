const { getORM } = require('../config/orm');

/**
 * Pods DAL - MikroORM version
 * Returns exact same data structure as pg pool version
 */

async function getActivePods() {
  const orm = await getORM();
  const em = orm.em.fork();
  
  const pods = await em.find('Pod', 
    { is_active: true },
    { 
      fields: ['id', 'name'],
      orderBy: { name: 'ASC' }
    }
  );
  
  // Return as plain objects with string IDs (matching pg pool behavior)
  return pods.map(pod => ({
    id: String(pod.id),
    name: pod.name
  }));
}

async function getManagerPods(managerId) {
  const orm = await getORM();
  const em = orm.em.fork();
  
  const pods = await em.find('Pod',
    { 
      manager_user_id: managerId,
      is_active: true 
    },
    {
      fields: ['id', 'name'],
      orderBy: { name: 'ASC' }
    }
  );
  
  // Return as plain objects with string IDs (matching pg pool behavior)
  return pods.map(pod => ({
    id: String(pod.id),
    name: pod.name
  }));
}

module.exports = {
  getActivePods,
  getManagerPods
};
