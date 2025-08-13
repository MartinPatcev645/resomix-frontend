import axios, { AxiosInstance, AxiosResponse } from 'axios'

// Generic Axios wrapper to extract data from responses
const axiosWrapper = <T>(apiCall: Promise<AxiosResponse<T>>): Promise<T> => {
  return apiCall
    .then(response => response.data)
    .catch(err => Promise.reject(err))
}

const api = {
}

export default api;
