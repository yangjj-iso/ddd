import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Download,
  Grid2X2,
  List,
  MapPin,
  PanelRight,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
  X,
  ArrowUpFromLine,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";
import Papa from "papaparse";
import {
  api,
  money,
  number,
  type Part,
  type Location,
  type Summary,
  type Movement,
} from "./api";
import {
  Empty,
  Modal,
  MovementList,
  Notice,
  Pagination,
  PartArt,
  Spinner,
  StockBadge,
  downloadBlob,
} from "./ui";
import { categories } from "./forms";
import { getProductType } from "./productTypes";

export type WorkspaceProps = {
  summary: Summary | null;
  locations: Location[];
  refresh: number;
  reload: () => void;
  notify: (m: string) => void;
  onAdd: () => void;
  onImport: () => void;
  onDetail: (p: Part) => void;
  onStock: (p: Part, k: "in" | "out") => void;
  onEdit: (p: Part) => void;
  onNavigate: (p: string) => void;
  search: string;
  setSearch: (s: string) => void;
  stockFilter: string;
  setStockFilter: (s: string) => void;
  locationFilter: string;
  setLocationFilter: (s: string) => void;
  category: string;
  setCategory: (s: string) => void;
};

export function Stats({
  summary,
  onLow,
}: {
  summary: Summary | null;
  onLow: () => void;
}) {
  const cards = [
    {
      label: "物料种类",
      value: summary ? number(summary.total_parts) : "—",
      unit: "种",
      note: "元件档案，井井有条",
      icon: "box",
      color: "sage",
    },
    {
      label: "库存总量",
      value: summary ? number(summary.total_quantity) : "—",
      unit: "件",
      note: "让每一次创作有备而来",
      icon: "layers",
      color: "blue",
    },
    {
      label: "库存总价值",
      value: summary ? "¥ " + money(summary.total_value) : "—",
      unit: "",
      note: "按录入单价计算 · CNY",
      icon: "value",
      color: "sand",
    },
    {
      label: "低库存预警",
      value: summary ? number(summary.low_stock) : "—",
      unit: "种",
      note: summary
        ? `其中 ${summary.out_of_stock} 种物料已缺货`
        : "及时补货，灵感不断线",
      icon: "warning",
      color: "amber",
    },
  ];
  return (
    <div className="stats-grid">
      {cards.map((c, i) => (
        <div className={"stat-card " + c.color} key={c.label}>
          <div className="stat-label">
            {c.label}
            <span className="stat-icon">
              {i === 0 ? (
                <svg
                  viewBox="0 0 20 20"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="m10 2 7 4v8l-7 4-7-4V6l7-4Zm0 0v8m-7-4 7 4 7-4m-7 4v8" />
                </svg>
              ) : i === 1 ? (
                <List size={17} />
              ) : i === 2 ? (
                <span>¥</span>
              ) : (
                <SlidersHorizontal size={17} />
              )}
            </span>
          </div>
          <div className="stat-number">
            {c.value}
            <small>{c.unit}</small>
          </div>
          <div className="stat-note">
            {c.note}
            {i === 3 && (
              <button aria-label="查看低库存物料" onClick={onLow}>
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Inventory(props: WorkspaceProps) {
  const {
    summary,
    locations,
    refresh,
    onAdd,
    onImport,
    onDetail,
    onStock,
    onEdit,
    search,
    setSearch,
    stockFilter,
    setStockFilter,
    locationFilter,
    setLocationFilter,
    category,
    setCategory,
    onNavigate,
  } = props;
  const [items, setItems] = useState<Part[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [view, setView] = useState<"list" | "grid">("list"),
    [selected, setSelected] = useState<number[]>([]),
    [filters, setFilters] = useState(false),
    [showAside, setShowAside] = useState(false),
    [sort, setSort] = useState("newest");
  const hasFilters = Boolean(
    search || category || stockFilter || locationFilter,
  );
  function clearFilters() {
    setSearch("");
    setCategory("");
    setStockFilter("");
    setLocationFilter("");
    setSort("newest");
    setPage(1);
    setSelected([]);
  }
  const size = 10;
  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [search, category, stockFilter, locationFilter]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({
        q: search,
        category,
        stock: stockFilter,
        location_id: locationFilter,
        sort,
        page: String(page),
        page_size: String(size),
      });
      if (!locationFilter) params.delete("location_id");
      api<{ items: Part[]; total: number }>("/api/v1/parts?" + params, {
        signal: controller.signal,
      })
        .then((r) => {
          setItems(r.items);
          setTotal(r.total);
          setError("");
          if (page > 1 && r.items.length === 0) setPage(1);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search, category, stockFilter, locationFilter, page, sort, refresh]);
  function exportRows() {
    if (selected.length) {
      const data = items
        .filter((p) => selected.includes(p.id))
        .map((p) => ({
          sku: p.sku,
          name: p.name,
          category: p.category,
          product_type: p.specs["商品类型"] || p.specs["器件类型"] || "",
          manufacturer: p.manufacturer,
          package: p.package,
          description: p.description,
          quantity: p.quantity,
          min_quantity: p.min_quantity,
          unit_price: p.unit_price,
          location_code: p.location?.code || "",
          datasheet_url: p.datasheet_url,
          notes: p.notes,
        }));
      downloadBlob(
        "\ufeff" + Papa.unparse(data, { escapeFormulae: true }),
        "partsbox-selected.csv",
      );
    } else {
      const params = new URLSearchParams({
        q: search,
        category,
        stock: stockFilter,
      });
      if (locationFilter) params.set("location_id", locationFilter);
      window.location.href = "/api/v1/parts/export?" + params;
    }
  }
  const tabs = ["", "电阻", "电容", "集成电路", "模块"];
  return (
    <>
      <div
        className={
          "inventory-layout inventory-workspace" +
          (showAside ? " with-aside" : "")
        }
      >
        <div className="inventory-main panel">
          <div className="inventory-panel-header">
            <div className="inventory-tabs">
              {tabs.map((c) => (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  {c || "全部物料"}
                  <span>
                    {c
                      ? summary?.categories.find((v) => v.name === c)?.count ||
                        0
                      : summary?.total_parts || 0}
                  </span>
                </button>
              ))}
              <select
                aria-label="更多物料分类"
                value={tabs.includes(category) ? "" : category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">更多分类</option>
                {categories
                  .filter((c) => !tabs.includes(c))
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>
            <div
              className="inventory-panel-actions"
              role="toolbar"
              aria-label="物料操作"
            >
              <button className="btn" onClick={onImport}>
                <Upload size={16} />
                导入物料
              </button>
              <button className="btn primary" onClick={onAdd}>
                <Plus size={17} />
                新增物料
              </button>
            </div>
          </div>
          <div className="table-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="搜索物料"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索型号、商品类型、参数…"
              />
              {search && (
                <button
                  className="icon-btn tiny"
                  aria-label="清除搜索"
                  onClick={() => setSearch("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="toolbar-actions">
              <button
                className={
                  "btn compact " +
                  (filters || stockFilter || locationFilter || sort !== "newest"
                    ? "filter-active"
                    : "")
                }
                onClick={() => setFilters((v) => !v)}
                aria-expanded={filters}
                aria-controls="inventory-filters"
              >
                <SlidersHorizontal size={15} />
                筛选
                {(stockFilter || locationFilter) && (
                  <i className="filter-dot" />
                )}
              </button>
              <button
                className={
                  "btn compact overview-toggle" +
                  (showAside ? " filter-active" : "")
                }
                onClick={() => setShowAside((v) => !v)}
                aria-expanded={showAside}
                aria-controls="inventory-insights"
                title="查看最近动态与物料分布"
              >
                <PanelRight size={15} />
                概览
              </button>
              <button className="btn compact" onClick={exportRows}>
                <Download size={15} />
                {selected.length ? "导出已选" : "导出"}
              </button>
              <div className="view-switch">
                <button
                  className={view === "list" ? "active" : ""}
                  aria-label="列表视图"
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                >
                  <List size={17} />
                </button>
                <button
                  className={view === "grid" ? "active" : ""}
                  aria-label="卡片视图"
                  aria-pressed={view === "grid"}
                  onClick={() => setView("grid")}
                >
                  <Grid2X2 size={16} />
                </button>
              </div>
            </div>
          </div>
          {filters && (
            <div className="filter-row" id="inventory-filters">
              <select
                aria-label="库存状态"
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
              >
                <option value="">全部库存状态</option>
                <option value="normal">库存充足</option>
                <option value="low">低库存 / 缺货</option>
                <option value="out">仅缺货</option>
              </select>
              <select
                aria-label="库位筛选"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="">所有库位</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} · {l.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="排序方式"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                  setSelected([]);
                }}
              >
                <option value="newest">最近添加</option>
                <option value="name">名称排序</option>
                <option value="quantity">库存从少到多</option>
              </select>
              <button className="text-btn" onClick={clearFilters}>
                重置
              </button>
            </div>
          )}
          {hasFilters && (
            <div className="active-filters" aria-label="当前筛选">
              {[
                search && {
                  label: `搜索：${search}`,
                  clear: () => setSearch(""),
                },
                category && { label: category, clear: () => setCategory("") },
                stockFilter && {
                  label:
                    stockFilter === "out"
                      ? "仅缺货"
                      : stockFilter === "low"
                        ? "低库存 / 缺货"
                        : "库存充足",
                  clear: () => setStockFilter(""),
                },
                locationFilter && {
                  label: `库位：${locations.find((l) => String(l.id) === locationFilter)?.code || locationFilter}`,
                  clear: () => setLocationFilter(""),
                },
              ]
                .filter((f): f is { label: string; clear: () => void } =>
                  Boolean(f),
                )
                .map((f) => (
                  <button
                    key={f.label}
                    className="filter-chip"
                    onClick={f.clear}
                    aria-label={`移除筛选 ${f.label}`}
                  >
                    <span>{f.label}</span>
                    <X size={12} />
                  </button>
                ))}
              <button className="text-btn" onClick={clearFilters}>
                清除全部
              </button>
              <span className="filter-result" role="status">
                {loading ? "正在搜索…" : `${total} 种物料`}
              </span>
            </div>
          )}
          {selected.length > 0 && (
            <div className="selection-bar">
              已选择 {selected.length} 项
              <button className="text-btn" onClick={() => setSelected([])}>
                取消选择
              </button>
            </div>
          )}
          {error ? (
            <div className="padded">
              <Notice error>{error}</Notice>
            </div>
          ) : loading ? (
            <Spinner />
          ) : !items.length ? (
            <Empty
              title={
                search || category || stockFilter || locationFilter
                  ? "没有找到匹配的物料"
                  : undefined
              }
              description={
                search || category || stockFilter || locationFilter
                  ? "换个关键词，或清除筛选条件试试。"
                  : undefined
              }
            >
              <button
                className="btn primary"
                onClick={hasFilters ? clearFilters : onAdd}
              >
                {hasFilters ? <X size={16} /> : <Plus size={16} />}
                {hasFilters ? "清除筛选" : "添加第一种物料"}
              </button>
            </Empty>
          ) : view === "list" ? (
            <div className="table-scroll">
              <table className="parts-table">
                <thead>
                  <tr>
                    <th className="check-cell">
                      <input
                        type="checkbox"
                        aria-label="选择本页全部物料"
                        checked={
                          items.length > 0 &&
                          items.every((p) => selected.includes(p.id))
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked ? items.map((p) => p.id) : [],
                          )
                        }
                      />
                    </th>
                    <th>物料信息</th>
                    <th>商品类型</th>
                    <th>封装</th>
                    <th>库存数量</th>
                    <th>存放位置</th>
                    <th>状态</th>
                    <th className="last-th">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr
                      key={p.id}
                      className={selected.includes(p.id) ? "selected" : ""}
                    >
                      <td className="check-cell">
                        <input
                          type="checkbox"
                          aria-label={"选择 " + p.name}
                          checked={selected.includes(p.id)}
                          onChange={(e) =>
                            setSelected((v) =>
                              e.target.checked
                                ? [...v, p.id]
                                : v.filter((id) => id !== p.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="part-cell"
                          onClick={() => onDetail(p)}
                        >
                          <PartArt category={p.category} />
                          <div>
                            <strong title={p.name}>{p.name}</strong>
                            <span title={p.description}>{p.description}</span>
                            <small>
                              <b>{p.sku}</b>
                              {p.manufacturer && (
                                <>
                                  <i>·</i>
                                  {p.manufacturer}
                                </>
                              )}
                            </small>
                          </div>
                        </button>
                      </td>
                      <td>
                        <span
                          className="product-type-tag"
                          data-category={p.category}
                          title={getProductType(p)}
                        >
                          {getProductType(p)}
                        </span>
                      </td>
                      <td>
                        <span className="package-tag">{p.package || "—"}</span>
                      </td>
                      <td>
                        <div className="quantity-cell">
                          <strong>{number(p.quantity)}</strong>
                          <small>件</small>
                        </div>
                        <div className="stock-track">
                          <i
                            style={{
                              width:
                                Math.min(
                                  100,
                                  (p.quantity /
                                    Math.max(p.min_quantity * 5, 1)) *
                                    100,
                                ) + "%",
                              background:
                                p.quantity <= p.min_quantity
                                  ? "#d3a158"
                                  : undefined,
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        <button
                          className="location-tag"
                          onClick={() =>
                            setLocationFilter(String(p.location_id || ""))
                          }
                        >
                          <MapPin size={12} />
                          {p.location?.code || "未分配"}
                        </button>
                      </td>
                      <td>
                        <StockBadge part={p} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            aria-label={"入库 " + p.name}
                            title="入库"
                            className="icon-btn"
                            onClick={() => onStock(p, "in")}
                          >
                            <ArrowDownToLine size={16} />
                          </button>
                          <button
                            aria-label={"出库 " + p.name}
                            title="出库"
                            className="icon-btn"
                            onClick={() => onStock(p, "out")}
                          >
                            <ArrowUpFromLine size={16} />
                          </button>
                          <button
                            aria-label={"编辑 " + p.name}
                            title="编辑"
                            className="icon-btn"
                            onClick={() => onEdit(p)}
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="parts-grid">
              {items.map((p) => (
                <article className="part-card" key={p.id}>
                  <div>
                    <PartArt category={p.category} size={64} />
                    <StockBadge part={p} />
                  </div>
                  <button onClick={() => onDetail(p)}>
                    <h3>{p.name}</h3>
                    <span
                      className="product-type-tag"
                      data-category={p.category}
                    >
                      {getProductType(p)}
                    </span>
                    <p>{p.description}</p>
                    <small>
                      {p.sku} · {p.package}
                    </small>
                  </button>
                  <footer>
                    <span>
                      <b>{number(p.quantity)}</b> 件
                    </span>
                    <span className="location-tag">
                      <MapPin size={12} />
                      {p.location?.code || "未分配"}
                    </span>
                    <button
                      className="icon-btn"
                      aria-label={"入库 " + p.name}
                      onClick={() => onStock(p, "in")}
                    >
                      <Plus size={17} />
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          )}
          {!loading && total > 0 && (
            <Pagination
              page={page}
              total={total}
              size={size}
              onPage={(p) => {
                setPage(p);
                setSelected([]);
              }}
            />
          )}
        </div>
        {showAside && (
          <aside
            className="inventory-aside"
            id="inventory-insights"
            aria-label="物料概览"
          >
            <div className="panel quick-panel">
              <div className="section-heading">
                <h3>最近动态</h3>
                <span className="live-dot" />
              </div>
              <MovementList items={summary?.recent_movements || []} />
              <button
                className="panel-link"
                onClick={() => onNavigate("movements")}
              >
                查看全部记录
                <ArrowRight size={14} />
              </button>
            </div>
            <CategoryChart summary={summary} />
          </aside>
        )}
      </div>
    </>
  );
}

export function CategoryChart({ summary }: { summary: Summary | null }) {
  const colors = [
    "#225f4d",
    "#71a58e",
    "#a7c7b3",
    "#c8d9cb",
    "#d6c9aa",
    "#93a7ad",
    "#b5bdc9",
    "#d6dbdb",
    "#dce5dc",
  ];
  const total = summary?.total_parts || 0;
  let cursor = 0;
  const segments = (summary?.categories || []).map((v, i) => {
    const start = cursor;
    cursor += total ? (v.count / total) * 100 : 0;
    return `${colors[i % colors.length]} ${start}% ${cursor}%`;
  });
  return (
    <div className="panel category-panel">
      <div className="section-heading">
        <h3>物料分布</h3>
        <span className="muted-label">按种类</span>
      </div>
      <div
        className="donut"
        style={{
          background: segments.length
            ? "conic-gradient(" + segments.join(",") + ")"
            : "#e8ede9",
        }}
      >
        <div>
          <strong>{total}</strong>
          <span>物料种类</span>
        </div>
      </div>
      <div className="category-legend">
        {summary?.categories.slice(0, 5).map((c, i) => (
          <div key={c.name}>
            <span>
              <i style={{ background: colors[i] }} />
              {c.name}
            </span>
            <b>
              {c.count}
              <small>{total ? Math.round((c.count / total) * 100) : 0}%</small>
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Detail({
  part,
  onClose,
  onEdit,
  onStock,
  notify,
  reload,
}: {
  part: Part;
  onClose: () => void;
  onEdit: (p: Part) => void;
  onStock: (p: Part, k: "in" | "out") => void;
  notify: (s: string) => void;
  reload: () => void;
}) {
  const [movements, setMovements] = useState<Movement[]>([]),
    [tab, setTab] = useState("details"),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ items: Movement[] }>(
      `/api/v1/movements?part_id=${part.id}&page_size=100`,
    )
      .then((r) => setMovements(r.items))
      .catch((e) => setError(e.message));
  }, [part.id]);
  return (
    <Modal
      title="物料详情"
      subtitle={part.sku + " · " + part.category}
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        <div className="detail-hero">
          <PartArt category={part.category} size={86} />
          <div>
            <h2>{part.name}</h2>
            <p>{part.description || "暂无规格描述"}</p>
            <StockBadge part={part} />
          </div>
        </div>
        <div className="detail-numbers">
          <div>
            <span>当前库存</span>
            <strong>
              {number(part.quantity)}
              <small>件</small>
            </strong>
          </div>
          <div>
            <span>单价</span>
            <strong>
              ¥
              {Number(part.unit_price).toLocaleString("zh-CN", {
                maximumFractionDigits: 4,
              })}
            </strong>
          </div>
          <div>
            <span>库存价值</span>
            <strong>¥{money(part.quantity * Number(part.unit_price))}</strong>
          </div>
        </div>
        <div className="detail-tabs">
          <button
            className={tab === "details" ? "active" : ""}
            onClick={() => setTab("details")}
          >
            基本信息
          </button>
          <button
            className={tab === "movements" ? "active" : ""}
            onClick={() => setTab("movements")}
          >
            出入库记录
          </button>
        </div>
        {error && <Notice error>{error}</Notice>}
        {tab === "details" ? (
          <>
            <dl className="detail-fields">
              <div>
                <dt>商品类型</dt>
                <dd>
                  <span
                    className="product-type-tag"
                    data-category={part.category}
                  >
                    {getProductType(part)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>制造商</dt>
                <dd>{part.manufacturer || "—"}</dd>
              </div>
              <div>
                <dt>封装</dt>
                <dd>{part.package || "—"}</dd>
              </div>
              <div>
                <dt>存放库位</dt>
                <dd>
                  {part.location
                    ? `${part.location.code} · ${part.location.name}`
                    : "未分配"}
                </dd>
              </div>
              <div>
                <dt>低库存阈值</dt>
                <dd>{part.min_quantity} 件</dd>
              </div>
              {Object.entries(part.specs)
                .filter(([k]) => k !== "商品类型" && k !== "器件类型")
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
            {part.datasheet_url && (
              <a
                className="btn"
                href={part.datasheet_url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} />
                查看数据手册
              </a>
            )}
            {part.notes && (
              <div className="detail-notes">
                <span>备注</span>
                <p>{part.notes}</p>
              </div>
            )}
            {part.is_demo && (
              <p className="field-hint">
                这是一条演示物料，用于帮助你了解工作台。
              </p>
            )}
          </>
        ) : (
          <MovementList items={movements} />
        )}
      </div>
      <footer className="detail-footer">
        <div>
          {part.quantity === 0 && movements.length === 0 && (
            <button
              className="btn danger-btn"
              disabled={busy}
              onClick={async () => {
                if (!confirm) {
                  setConfirm(true);
                  return;
                }
                setBusy(true);
                try {
                  await api("/api/v1/parts/" + part.id, { method: "DELETE" });
                  notify("物料已删除");
                  reload();
                  onClose();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={15} />
              {confirm ? "再次点击确认删除" : "删除"}
            </button>
          )}
          <button className="btn" onClick={() => onEdit(part)}>
            <Pencil size={15} />
            编辑
          </button>
        </div>
        <div>
          <button className="btn" onClick={() => onStock(part, "out")}>
            <ArrowUpFromLine size={15} />
            出库
          </button>
          <button className="btn primary" onClick={() => onStock(part, "in")}>
            <ArrowDownToLine size={15} />
            入库
          </button>
        </div>
      </footer>
    </Modal>
  );
}
