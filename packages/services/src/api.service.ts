/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { IndexedDBService } from "./indexedDB.service";

/**
 * Abstract base class for making HTTP requests using axios
 * @abstract
 */
export abstract class APIService {
  protected baseURL: string;
  private axiosInstance: AxiosInstance;

  /**
   * Creates an instance of APIService
   * @param {string} baseURL - The base URL for all HTTP requests
   */
  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.axiosInstance = axios.create({
      baseURL,
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  /**
   * Sets up axios interceptors for handling responses
   * Currently handles 401 unauthorized responses by redirecting to login
   * @private
   */
  private setupInterceptors() {
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          const currentPath = window.location.pathname;
          // 경로 정규화 - 중복 슬래시 제거 및 마지막 슬래시 처리
          const normalizedPath = currentPath
            .replace(/\/+/g, '/') // 중복 슬래시를 단일 슬래시로
            .replace(/\/+$/, ''); // 끝의 슬래시 제거
            
          // god-mode 페이지인 경우 next_path를 /god-mode/general로 설정
          const nextPath = normalizedPath === '/god-mode' 
            ? '/god-mode/general' 
            : normalizedPath;
            
          window.location.replace(`/god-mode?next_path=${nextPath}`);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Makes a GET request to the specified URL
   * @param {string} url - The endpoint URL
   * @param {object} [params={}] - URL parameters
   * @param {AxiosRequestConfig} [config={}] - Additional axios configuration
   * @returns {Promise} Axios response promise
   */
  get(url: string, params = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.get(url, {
      ...params,
      ...config,
    });
  }

  /**
   * Makes a POST request to the specified URL
   * @param {string} url - The endpoint URL
   * @param {object} [data={}] - Request body data
   * @param {AxiosRequestConfig} [config={}] - Additional axios configuration
   * @returns {Promise} Axios response promise
   */
  post(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.post(url, data, config);
  }

  /**
   * Makes a PUT request to the specified URL
   * @param {string} url - The endpoint URL
   * @param {object} [data={}] - Request body data
   * @param {AxiosRequestConfig} [config={}] - Additional axios configuration
   * @returns {Promise} Axios response promise
   */
  put(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.put(url, data, config);
  }

  /**
   * Makes a PATCH request to the specified URL
   * @param {string} url - The endpoint URL
   * @param {object} [data={}] - Request body data
   * @param {AxiosRequestConfig} [config={}] - Additional axios configuration
   * @returns {Promise} Axios response promise
   */
  patch(url: string, data = {}, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.patch(url, data, config);
  }

  /**
   * Makes a DELETE request to the specified URL
   * @param {string} url - The endpoint URL
   * @param {any} [data] - Request body data
   * @param {AxiosRequestConfig} [config={}] - Additional axios configuration
   * @returns {Promise} Axios response promise
   */
  delete(url: string, data?: any, config: AxiosRequestConfig = {}) {
    return this.axiosInstance.delete(url, { data, ...config });
  }

  /**
   * Makes a custom request with the provided configuration
   * @param {object} [config={}] - Axios request configuration
   * @returns {Promise} Axios response promise
   */
  request(config = {}) {
    return this.axiosInstance(config);
  }
}
