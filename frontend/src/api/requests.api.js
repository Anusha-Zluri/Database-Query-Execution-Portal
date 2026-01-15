import axios from "../utils/axios";

export const getDatabaseTypes = async () => {
  const res = await axios.get("/requests/database-types");
  return res.data;
};

export const getInstances = async (type) => {
  const params = type ? { type } : {};
  const res = await axios.get("/requests/instances", { params });
  return res.data;
};

export const getDatabases = async (instance) => {
  const res = await axios.get("/requests/databases", { 
    params: { instance } 
  });
  return res.data;
};

export const submitRequest = async (formData) => {
  const res = await axios.post("/requests", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};
