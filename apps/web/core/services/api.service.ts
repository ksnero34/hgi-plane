/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

export abstract class APIService {
  protected baseURL: string;
  private axiosInstance: AxiosInstance;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.axiosInstance = axios.create({
      baseURL,
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add CSRF token for POST/PUT/PATCH/DELETE requests
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
          try {
            // Get CSRF token directly from API
            const response = await axios.get(`${this.baseURL}/auth/get-csrf-token/`, {
              withCredentials: true
            });
            const { csrf_token } = response.data;
            config.headers['X-CSRFToken'] = csrf_token;
          } catch (error) {
            console.warn('Failed to get CSRF token:', error);
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          error.response?.status === 401 && 
          !error.config.url.includes('/api/instances/file-settings/')
        ) {
          const currentPath = window.location.pathname;
          window.location.replace(`/${currentPath ? `?next_path=${currentPath}` : ``}`);
        }
        return Promise.reject(error);
      }
    );
  }

  get(url: string, params = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.get(url, {
      ...params,
      ...config,
    });
  }

  post(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.post(url, data, config);
  }

  put(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.put(url, data, config);
  }

  patch(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.patch(url, data, config);
  }

  delete(url: string, data?: any, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.delete(url, { data, ...config });
  }

  request(config = {}) {
    return this.axiosInstance(config);
  }
}
