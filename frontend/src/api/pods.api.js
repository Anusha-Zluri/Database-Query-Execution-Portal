import axios from "../utils/axios";

export const getPods = async () => {
  const res = await axios.get("/pods");
  return res.data;
};
