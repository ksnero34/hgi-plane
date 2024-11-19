import axios, { AxiosInstance } from "axios";
import { config } from "dotenv";

config();

export const API_BASE_URL = process.env.API_BASE_URL 
  ? new URL(process.env.API_BASE_URL).toString()  // 유효한 URL인지 확인
  : "http://localhost:8000";  // 기본값 설정

export abstract class APIService {
  protected baseURL: string;
  private axiosInstance: AxiosInstance;

  constructor(baseURL: string) {
    this.baseURL = baseURL.startsWith('http') 
      ? baseURL 
      : new URL(baseURL, API_BASE_URL).toString();

    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      withCredentials: true,
    });
  }

  get(url: string, params = {}, config = {}) {
    return this.axiosInstance.get(url, {
      ...params,
      ...config,
    });
  }

  post(url: string, data = {}, config = {}) {
    return this.axiosInstance.post(url, data, config);
  }

  put(url: string, data = {}, config = {}) {
    return this.axiosInstance.put(url, data, config);
  }

  patch(url: string, data = {}, config = {}) {
    return this.axiosInstance.patch(url, data, config);
  }

  delete(url: string, data?: any, config = {}) {
    return this.axiosInstance.delete(url, { data, ...config });
  }

  request(config = {}) {
    return this.axiosInstance(config);
  }
}
