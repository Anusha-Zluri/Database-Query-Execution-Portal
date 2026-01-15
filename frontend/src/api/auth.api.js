import axios from "../utils/axios";

export const login = async (email, password) => {
  const res = await axios.post("/auth/login", {
    email,
    password,
  });
  return res.data;
};

export const getMe = async () => {
  const res = await axios.get("/auth/me");
  return res.data;
};