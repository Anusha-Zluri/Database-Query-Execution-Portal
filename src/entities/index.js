// Central export for all entities
const { User } = require('./User.entity');
const { Pod } = require('./Pod.entity');
const { Request } = require('./Request.entity');
const { RequestQuery } = require('./RequestQuery.entity');
const { RequestScript } = require('./RequestScript.entity');
const { Execution } = require('./Execution.entity');
const { DbInstance } = require('./DbInstance.entity');
const { UserPod } = require('./UserPod.entity');

module.exports = {
  User,
  Pod,
  Request,
  RequestQuery,
  RequestScript,
  Execution,
  DbInstance,
  UserPod
};
