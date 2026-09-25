// One error shape for every endpoint. Clients switch on `code`, humans read `message`.
export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  version: string;
}
