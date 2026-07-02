export type ApiErrorKind = "network" | "unauthorized" | "forbidden" | "not-found" | "generic";

const friendlyMessages: Record<ApiErrorKind, string> = {
  network: "No fue posible conectar con la API. Verifique que el backend esté iniciado.",
  unauthorized: "Sesión no iniciada o expirada.",
  forbidden: "No tiene permisos para consultar esta información.",
  "not-found": "El recurso solicitado no fue encontrado.",
  generic: "Ocurrió un error inesperado al cargar la información."
};

export class FriendlyApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, status?: number) {
    super(friendlyMessages[kind]);
    this.name = "FriendlyApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function apiErrorKindFromStatus(status: number): ApiErrorKind {
  if (status === 401) {
    return "unauthorized";
  }

  if (status === 403) {
    return "forbidden";
  }

  if (status === 404) {
    return "not-found";
  }

  return "generic";
}

export function normalizeApiError(error: unknown): FriendlyApiError {
  if (error instanceof FriendlyApiError) {
    return error;
  }

  if (error instanceof TypeError) {
    return new FriendlyApiError("network");
  }

  return new FriendlyApiError("generic");
}

