export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  message?: string;
}

export interface RequestOptions {
  idempotencyKey?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    pages?: number;
    total_pages?: number;
    page: number;
    size: number;
    page_size?: number;
  };
}
