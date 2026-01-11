const { URL } = require('url');

exports.buildDbUrl = (baseUrl, dbName) => {
  const url = new URL(baseUrl);

  // Safety: block system DBs
  const blocked = ['template0', 'template1'];
  if (blocked.includes(dbName)) {
    throw new Error('System database access denied');
  }

  url.pathname = `/${dbName}`;
  return url.toString();
};
