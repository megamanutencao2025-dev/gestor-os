import { appApi } from "@/api/appClient";

const axiosInstance = {
  get: (url) => appApi.request(url),
  post: (url, data) => appApi.request(url, {
    method: "POST",
    body: JSON.stringify(data || {}),
  }),
  put: (url, data) => appApi.request(url, {
    method: "PUT",
    body: JSON.stringify(data || {}),
  }),
  delete: (url) => appApi.request(url, {
    method: "DELETE",
  }),
};

export default axiosInstance;
