import { useEffect, useRef, useId, type ReactNode } from "react";
import {
  X,
  Loader2,
  Box,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  AlertTriangle,
  PackageOpen,
} from "lucide-react";
import type { Part, Movement } from "./api";
import { dateText } from "./api";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={"brand " + (small ? "small" : "")}>
      <span className="brand-symbol">
        <Box size={25} strokeWidth={1.7} />
      </span>
      {!small && (
        <div>
          <strong>PartsBox</strong>
          <small>每一颗元件，都有迹可循</small>
        </div>
      )}
    </div>
  );
}
export function Spinner() {
  return (
    <div className="loading">
      <Loader2 size={22} className="spin" />
      <span>正在加载工作台…</span>
    </div>
  );
}
export function Empty({
  title = "这里还没有物料",
  description = "把你的第一颗元件收进来，开始有条理的创作。",
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-art">
        <PackageOpen size={38} strokeWidth={1.3} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null),
    label = useId();
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const root = dialog.current;
    const selectors =
      'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]';
    (
      (root?.querySelector(
        "input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
      ) as HTMLElement) || (root?.querySelector(selectors) as HTMLElement)
    )?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = Array.from(
          root?.querySelectorAll<HTMLElement>(selectors) || [],
        ).filter((n) => n.offsetParent !== null);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={label}
        ref={dialog}
      >
        <header>
          <div>
            <h2 id={label}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export function StockBadge({
  part,
}: {
  part: Pick<Part, "quantity" | "min_quantity">;
}) {
  return (
    <span
      className={
        "status-badge " +
        (part.quantity === 0
          ? "danger"
          : part.quantity <= part.min_quantity
            ? "warning"
            : "healthy")
      }
    >
      <i />
      {part.quantity === 0
        ? "已缺货"
        : part.quantity <= part.min_quantity
          ? "库存偏低"
          : "库存充足"}
    </span>
  );
}
export function PartArt({
  category,
  size = 46,
}: {
  category: string;
  size?: number;
}) {
  const colors: Record<string, string> = {
    电阻: "#edf3ef",
    电容: "#f4f0e7",
    集成电路: "#edf0f3",
    模块: "#e9f0ed",
    二极管: "#eef0f5",
    晶体管: "#f0edf4",
    连接器: "#f4eee7",
    电感: "#eceff6",
    其他: "#eff2ef",
  };
  return (
    <span
      className="part-art"
      style={{
        width: size,
        height: size,
        background: colors[category] || "#edf3ef",
      }}
    >
      <svg
        width="88%"
        height="88%"
        viewBox="0 0 60 60"
        fill="none"
        aria-hidden="true"
      >
        {category === "电阻" ? (
          <g transform="rotate(-33 30 30)">
            <path d="M4 30h12m28 0h12" stroke="#a6adb0" strokeWidth="3" />
            <rect x="14" y="21" width="32" height="18" rx="4" fill="#dbd6bd" />
            <rect x="14" y="21" width="5" height="18" rx="2" fill="#b5bdc1" />
            <rect x="41" y="21" width="5" height="18" rx="2" fill="#b5bdc1" />
            <path d="M23 21v18" stroke="#745144" strokeWidth="3" />
            <path d="M29 21v18" stroke="#333a36" strokeWidth="3" />
            <path d="M35 21v18" stroke="#bd834d" strokeWidth="3" />
          </g>
        ) : category === "电容" ? (
          <g transform="rotate(-27 30 30)">
            <path d="M19 37v14m22-14v14" stroke="#a6adb0" strokeWidth="2.5" />
            <rect x="14" y="15" width="32" height="25" rx="4" fill="#b6986b" />
            <rect x="14" y="15" width="7" height="25" rx="2" fill="#c2c8ca" />
            <rect x="39" y="15" width="7" height="25" rx="2" fill="#c2c8ca" />
            <rect x="23" y="18" width="13" height="18" rx="2" fill="#c5a77c" />
          </g>
        ) : category === "模块" ? (
          <g transform="rotate(-18 30 30)">
            <rect x="12" y="8" width="36" height="45" rx="3" fill="#356653" />
            <rect x="18" y="17" width="24" height="24" rx="2" fill="#bbc4c4" />
            <path
              d="M20 21h18m-18 4h13m-13 4h18m-18 4h10"
              stroke="#8c9a9c"
              strokeWidth="1.4"
            />
            <path
              d="M19 10v5h5v-5h5v5h5v-5h5v5"
              stroke="#d2b66a"
              strokeWidth="2"
            />
            {[17, 23, 29, 35, 41].map((x) => (
              <path key={x} d={`M${x} 45v6`} stroke="#d6bb76" strokeWidth="2" />
            ))}
          </g>
        ) : category === "连接器" ? (
          <g transform="rotate(-27 30 30)">
            <rect x="12" y="20" width="38" height="23" rx="3" fill="#333b39" />
            {[18, 27, 36, 45].map((x) => (
              <g key={x}>
                <path
                  d={`M${x} 10v12m0 19v10`}
                  stroke="#c2a56a"
                  strokeWidth="3"
                />
                <circle cx={x} cy="30" r="2.5" fill="#bfa264" />
              </g>
            ))}
          </g>
        ) : category === "二极管" ? (
          <g transform="rotate(-35 30 30)">
            <path d="M5 30h15m20 0h15" stroke="#abb3b8" strokeWidth="3" />
            <rect x="17" y="22" width="26" height="17" rx="3" fill="#363f42" />
            <path d="M36 23v15" stroke="#bec7ca" strokeWidth="4" />
            <path d="M21 25h10" stroke="#657074" strokeWidth="2" />
          </g>
        ) : category === "电感" ? (
          <g transform="rotate(-25 30 30)">
            <path d="M12 30h7m22 0h7" stroke="#acb7c2" strokeWidth="5" />
            <rect x="17" y="16" width="27" height="29" rx="5" fill="#526170" />
            <circle
              cx="30.5"
              cy="30.5"
              r="9"
              stroke="#cba579"
              strokeWidth="4"
            />
            <circle cx="30.5" cy="30.5" r="4" fill="#3f4b55" />
          </g>
        ) : (
          <g transform="rotate(-25 30 30)">
            {[19, 26, 33, 40].map((y) => (
              <path
                key={y}
                d={`M10 ${y}h9m22 0h9`}
                stroke="#aab5b8"
                strokeWidth="3"
              />
            ))}
            <rect x="17" y="12" width="26" height="36" rx="3" fill="#323c3f" />
            <rect x="20" y="15" width="20" height="29" rx="1" fill="#414d50" />
            <circle cx="24" cy="20" r="1.5" fill="#a1aaac" />
            <text
              x="23"
              y="34"
              fill="#aab6b8"
              fontSize="6"
              fontFamily="monospace"
            >
              {category === "晶体管" ? "NPN" : "IC"}
            </text>
          </g>
        )}
      </svg>
    </span>
  );
}
export function MovementList({ items }: { items: Movement[] }) {
  return (
    <div className="activity-list">
      {items.length ? (
        items.map((m) => (
          <div className="activity-item" key={m.id}>
            <span className={"movement-icon " + m.kind}>
              {m.kind === "in" ? (
                <ArrowDownToLine size={15} />
              ) : (
                <ArrowUpFromLine size={15} />
              )}
            </span>
            <div>
              <strong>{m.part_name}</strong>
              <p>
                {m.kind === "in" ? "采购入库" : "物料出库"}
                <span> · {dateText(m.created_at)}</span>
              </p>
            </div>
            <b className={m.kind === "in" ? "green-text" : "muted"}>
              {m.kind === "in" ? "+" : "−"}
              {m.quantity}
            </b>
          </div>
        ))
      ) : (
        <p className="quiet-empty">暂无出入库记录</p>
      )}
    </div>
  );
}
export function Notice({
  error,
  children,
}: {
  error?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role={error ? "alert" : undefined}
      className={"notice " + (error ? "error" : "")}
    >
      {error ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
      <div>{children}</div>
    </div>
  );
}
export function downloadBlob(
  content: string,
  name: string,
  type = "text/csv;charset=utf-8;",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Pagination({
  page,
  total,
  size,
  onPage,
}: {
  page: number;
  total: number;
  size: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        共 <b>{total}</b> 条记录 · 第 {page} /{" "}
        {Math.max(1, Math.ceil(total / size))} 页
      </span>
      <div>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
          上一页
        </button>
        {Array.from(
          { length: Math.min(5, Math.max(1, Math.ceil(total / size))) },
          (_, i) => {
            const n =
              Math.min(
                Math.max(1, page - 2),
                Math.max(1, Math.ceil(total / size) - 4),
              ) + i;
            return (
              <button
                key={n}
                className={n === page ? "active" : ""}
                onClick={() => onPage(n)}
              >
                {n}
              </button>
            );
          },
        )}
        <button
          disabled={page * size >= total}
          onClick={() => onPage(page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
