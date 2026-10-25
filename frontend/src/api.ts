export type Location = {
  id: number;
  code: string;
  name: string;
  description: string;
  capacity: number;
  part_count: number;
  quantity: number;
};
export type Part = {
  id: number;
  sku: string;
  name: string;
  category: string;
  manufacturer: string;
  package: string;
  description: string;
  quantity: number;
  min_quantity: number;
  unit_price: string;
  location_id: number | null;
  location: Location | null;
  specs: Record<string, string>;
  datasheet_url: string;
  notes: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};
export type Movement = {
  id: number;
  part_id: number;
  part_name: string;
  part_sku: string;
  category: string;
  kind: "in" | "out";
  quantity: number;
  balance: number;
  reason: string;
  actor: string;
  created_at: string;
};
export type Summary = {
  total_parts: number;
  total_quantity: number;
  total_value: number;
  low_stock: number;
  out_of_stock: number;
  location_count: number;
  categories: { name: string; count: number; quantity: number }[];
  recent_movements: Movement[];
  trend: { date: string; in: number; out: number }[];
  demo_parts: number;
};
export type ApiKey = {
  id: number;
  name: string;
  prefix: string;
  scope: "read" | "write";
  created_at: string;
  last_used_at: string | null;
  revoked: boolean;
};
export type Project = {
  id: number;
  name: string;
  description: string;
  build_quantity: number;
  ready: boolean;
  cost: number;
  lines: {
    part_id: number;
    quantity: number;
    designator: string;
    part_name: string;
    part_sku: string;
    stock: number;
    required: number;
    missing: number;
  }[];
};
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function api<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401 && !url.includes("/auth/login")) {
      window.dispatchEvent(new Event("partsbox:unauthorized"));
    }
    let message = `请求失败 (${response.status})`;
    try {
      const body = await response.json();
      message =
        typeof body.detail === "string"
          ? body.detail
          : Array.isArray(body.detail)
            ? body.detail
                .map(
                  (v: { msg: string; loc?: string[] }) =>
                    `${v.loc?.slice(1).join(".") || ""} ${v.msg}`,
                )
                .join("；")
            : JSON.stringify(body.detail);
    } catch {
      /* retain HTTP status */
    }
    throw new ApiError(message, response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const post = <T>(url: string, body: unknown) =>
  api<T>(url, { method: "POST", body: JSON.stringify(body) });
export const money = (v: number | string) =>
  Number(v).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const number = (v: number) => v.toLocaleString("zh-CN");
export function dateText(value: string) {
  return new Date(value.endsWith("Z") ? value : value + "Z").toLocaleString(
    "zh-CN",
    {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  );
}
