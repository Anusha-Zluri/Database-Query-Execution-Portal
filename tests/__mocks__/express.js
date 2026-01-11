exports.mockReq = (overrides = {}) => ({
  params: {},
  query: {},
  body: {},
  user: { id: 1, email: 'a@b.com', role: 'USER' },
  ...overrides
});

exports.mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.type = jest.fn().mockReturnValue(res);
  return res;
};
