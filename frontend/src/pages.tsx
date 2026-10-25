import { useEffect, useState } from "react";
import { copyText } from "./browser";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  ArrowUpRight,
  Bot,
  Box,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  KeyRound,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  api,
  dateText,
  money,
  number,
  post,
  type ApiKey,
  type Location,
  type Movement,
  type Part,
  type Project,
  type Summary,
} from "./api";
import { CategoryChart, Stats, type WorkspaceProps } from "./Inventory";
import {
  Empty,
  Modal,
  MovementList,
  Notice,
  Pagination,
  PartArt,
  Spinner,
  StockBadge,
} from "./ui";

export function Overview(props: WorkspaceProps) {
  const { summary, onNavigate, setStockFilter, onAdd } = props;
  const [low, setLow] = useState<Part[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<{ items: Part[] }>("/api/v1/parts?stock=low&page_size=5&sort=quantity")
      .then((v) => setLow(v.items))
      .catch((e) => setError(e.message));
  }, [props.refresh]);
  const max = Math.max(
    1,
    ...(summary?.trend || []).flatMap((d) => [d.in, d.out]),
  );
  return (
    <>
      <Stats
        summary={summary}
        onLow={() => {
          setStockFilter("low");
          onNavigate("inventory");
        }}
      />
      <div className="overview-grid">
        <div className="panel trend-panel">
          <div className="section-heading">
            <div>
              <h3>出入库趋势</h3>
              <p>过去 14 天的元件流动 · UTC 日期</p>
            </div>
            <div className="chart-legend">
              <span>
                <i />
                入库
              </span>
              <span>
                <i />
                出库
              </span>
            </div>
          </div>
          <div className="bar-chart">
            {summary?.trend.map((day) => (
              <div
                key={day.date}
                className="bar-column"
                title={`${day.date} 入库 ${day.in} · 出库 ${day.out}`}
              >
                <div>
                  <i style={{ height: (day.in / max) * 100 + "%" }} />
                  <i style={{ height: (day.out / max) * 100 + "%" }} />
                </div>
                <span>{day.date.slice(5).replace("-", "/")}</span>
              </div>
            ))}
          </div>
        </div>
        <CategoryChart summary={summary} />
        <div className="panel">
          <div className="section-heading">
            <h3>需要补货</h3>
            <button
              className="text-btn"
              onClick={() => {
                setStockFilter("low");
                onNavigate("inventory");
              }}
            >
              查看全部
              <ArrowUpRight size={14} />
            </button>
          </div>
          {error && <Notice error>{error}</Notice>}
          {low.length ? (
            low.map((p) => (
              <button
                className="low-row"
                key={p.id}
                onClick={() => props.onDetail(p)}
              >
                <PartArt category={p.category} size={42} />
                <div>
                  <strong>{p.name}</strong>
                  <span>
                    {p.sku} · 补货阈值 {p.min_quantity} 件
                  </span>
                </div>
                <b>
                  {p.quantity}
                  <small>件</small>
                </b>
                <StockBadge part={p} />
              </button>
            ))
          ) : (
            <Empty
              title="库存状态不错"
              description="暂时没有需要补货的元件。"
            />
          )}
        </div>
        <div className="panel overview-activity">
          <div className="section-heading">
            <h3>最近动态</h3>
            <button
              className="icon-btn"
              aria-label="查看全部动态"
              onClick={() => onNavigate("movements")}
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
          <MovementList items={summary?.recent_movements || []} />
        </div>
      </div>
    </>
  );
}

export function LocationsPage({
  locations,
  onAdd,
  onEdit,
  onView,
  reload,
  notify,
}: {
  locations: Location[];
  onAdd: () => void;
  onEdit: (l: Location) => void;
  onView: (l: Location) => void;
  reload: () => void;
  notify: (s: string) => void;
}) {
  const [q, setQ] = useState(""),
    [pending, setPending] = useState<Location | null>(null),
    [error, setError] = useState("");
  const filtered = locations.filter((l) =>
    (l.code + l.name + l.description).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="location-summary">
        <div>
          <MapPin size={19} />
          <b>{locations.length}</b> 个库位
        </div>
        <div>
          <Box size={19} />
          <b>{locations.reduce((v, l) => v + l.part_count, 0)}</b> 种物料已归位
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索库位编号或名称"
            aria-label="搜索库位"
          />
        </label>
      </div>
      {filtered.length ? (
        <div className="locations-grid">
          {filtered.map((l, i) => (
            <article className="panel location-card" key={l.id}>
              <header>
                <span className={"location-illustration color-" + (i % 3)}>
                  <Box size={30} strokeWidth={1.3} />
                </span>
                <div>
                  <span className="mono">{l.code}</span>
                  <h3>{l.name}</h3>
                </div>
                <button
                  className="icon-btn"
                  onClick={() => onEdit(l)}
                  aria-label={"编辑 " + l.code}
                >
                  <Pencil size={16} />
                </button>
              </header>
              <p>{l.description || "还没有填写位置说明"}</p>
              <div className="location-metrics">
                <div>
                  <strong>{l.part_count}</strong>
                  <small>物料种类</small>
                </div>
                <div>
                  <strong>{number(l.quantity)}</strong>
                  <small>库存总量</small>
                </div>
                <div>
                  <strong>
                    {Math.round((l.part_count / l.capacity) * 100)}
                    <small>%</small>
                  </strong>
                  <small>空间使用</small>
                </div>
              </div>
              <div className="location-track">
                <i
                  style={{
                    width:
                      Math.min(100, (l.part_count / l.capacity) * 100) + "%",
                  }}
                />
              </div>
              <div className="capacity-label">
                {l.part_count} / {l.capacity} 种建议容量
                <span>
                  {l.part_count > l.capacity ? "建议整理空间" : "收纳有序"}
                </span>
              </div>
              <footer>
                <button className="text-btn" onClick={() => onView(l)}>
                  查看库位物料
                  <ArrowRight size={14} />
                </button>
                <button
                  className="icon-btn"
                  disabled={l.part_count > 0}
                  title={l.part_count ? "库位内有物料，不能删除" : "删除空库位"}
                  aria-label={"删除 " + l.code}
                  onClick={() => {
                    setPending(l);
                    setError("");
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title={q ? "没有找到这个库位" : "元件归位，从这里开始"}
            description="为抽屉、收纳盒或货架创建库位，查找更方便。"
          >
            <button className="btn primary" onClick={onAdd}>
              <Plus size={16} />
              新增库位
            </button>
          </Empty>
        </div>
      )}
      {pending && (
        <Modal
          title="删除空库位"
          subtitle={"即将删除 " + pending.code + " · " + pending.name}
          onClose={() => setPending(null)}
        >
          <div className="modal-body">
            {error && <Notice error>{error}</Notice>}
            <p>删除后可重新创建。仅空库位允许删除。</p>
          </div>
          <footer>
            <button className="btn" onClick={() => setPending(null)}>
              取消
            </button>
            <button
              className="btn danger-btn"
              onClick={async () => {
                try {
                  await api("/api/v1/locations/" + pending.id, {
                    method: "DELETE",
                  });
                  reload();
                  notify("空库位已删除");
                  setPending(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              确认删除
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}

export function MovementsPage({ refresh }: { refresh: number }) {
  const [items, setItems] = useState<Movement[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [kind, setKind] = useState(""),
    [q, setQ] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    setPage(1);
  }, [q, kind]);
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      api<{ items: Movement[]; total: number }>(
        `/api/v1/movements?page=${page}&page_size=15&kind=${kind}&q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      )
        .then((r) => {
          setItems(r.items);
          setTotal(r.total);
          setError("");
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 150);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [page, kind, q, refresh]);
  return (
    <>
      <div className="panel">
        <div className="table-toolbar">
          <div className="segmented">
            <button
              className={!kind ? "active" : ""}
              onClick={() => setKind("")}
            >
              全部记录
            </button>
            <button
              className={kind === "in" ? "active" : ""}
              onClick={() => setKind("in")}
            >
              入库
            </button>
            <button
              className={kind === "out" ? "active" : ""}
              onClick={() => setKind("out")}
            >
              出库
            </button>
          </div>
          <label className="search-field">
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索物料或操作原因"
              aria-label="搜索出入库记录"
            />
          </label>
        </div>
        {error && (
          <div className="padded">
            <Notice error>{error}</Notice>
          </div>
        )}
        {loading ? (
          <Spinner />
        ) : items.length ? (
          <>
            <div className="table-scroll">
              <table className="movement-table">
                <thead>
                  <tr>
                    <th>物料</th>
                    <th>操作类型</th>
                    <th>变动数量</th>
                    <th>操作后库存</th>
                    <th>操作原因</th>
                    <th>操作者</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="part-cell">
                          <PartArt category={m.category} size={38} />
                          <div>
                            <strong>{m.part_name}</strong>
                            <small>{m.part_sku}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={"movement-type " + m.kind}>
                          {m.kind === "in" ? (
                            <ArrowDownToLine size={13} />
                          ) : (
                            <ArrowUpFromLine size={13} />
                          )}{" "}
                          {m.kind === "in" ? "入库" : "出库"}
                        </span>
                      </td>
                      <td className={m.kind === "in" ? "green-text" : "muted"}>
                        <b>
                          {m.kind === "in" ? "+" : "−"}
                          {m.quantity}
                        </b>
                      </td>
                      <td>{number(m.balance)}</td>
                      <td>
                        <span className="reason-cell" title={m.reason}>
                          {m.reason}
                        </span>
                      </td>
                      <td>
                        <span className="actor-tag">{m.actor}</span>
                      </td>
                      <td className="muted nowrap">{dateText(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} size={15} total={total} onPage={setPage} />
          </>
        ) : (
          <Empty
            title="还没有出入库记录"
            description="在物料详情中执行入库或出库，流水会自动保存在这里。"
          />
        )}
      </div>
      <div className="inline-note">
        <ShieldCheck size={15} />
        库存流水保留完整追溯信息，无法直接编辑或删除。录入错误时请通过反向出入库修正。
      </div>
    </>
  );
}

export function ProjectsPage({
  refresh,
  onAdd,
  onEdit,
  reload,
  notify,
}: {
  refresh: number;
  onAdd: () => void;
  onEdit: (p: Project) => void;
  reload: () => void;
  notify: (s: string) => void;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null),
    [expanded, setExpanded] = useState<number | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState<Project | null>(null);
  useEffect(() => {
    api<Project[]>("/api/v1/projects")
      .then(setProjects)
      .catch((e) => setError(e.message));
  }, [refresh]);
  return (
    <>
      {error && <Notice error>{error}</Notice>}
      {projects === null ? (
        <Spinner />
      ) : projects.length ? (
        <div className="project-list">
          {projects.map((p) => (
            <article key={p.id} className="panel project-card">
              <header>
                <span className="project-icon">
                  <FolderKanban size={25} />
                </span>
                <div>
                  <h3>{p.name}</h3>
                  <p>{p.description || "还没有项目说明"}</p>
                </div>
                <span
                  className={
                    "status-badge " + (p.ready ? "healthy" : "warning")
                  }
                >
                  <i />
                  {p.ready
                    ? "物料齐备"
                    : p.lines.length
                      ? "存在缺料"
                      : "待添加用料"}
                </span>
                <button
                  className="icon-btn"
                  aria-label={"编辑 " + p.name}
                  onClick={() => onEdit(p)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-btn"
                  aria-label={"删除 " + p.name}
                  onClick={() => setPending(p)}
                >
                  <Trash2 size={16} />
                </button>
              </header>
              <div className="project-metrics">
                <span>
                  制作数量 <b>{p.build_quantity} 台</b>
                </span>
                <span>
                  物料种类 <b>{p.lines.length} 种</b>
                </span>
                <span>
                  预计用料成本 <b>¥ {money(p.cost)}</b>
                </span>
                <button
                  className="text-btn"
                  onClick={() => setExpanded((v) => (v === p.id ? null : p.id))}
                >
                  {expanded === p.id ? "收起清单" : "展开清单"}
                  <ChevronRight size={15} />
                </button>
              </div>
              {expanded === p.id && (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>物料</th>
                        <th>位号</th>
                        <th>单台用量</th>
                        <th>总需求</th>
                        <th>现有库存</th>
                        <th>缺口</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.lines.map((l) => (
                        <tr key={l.part_id}>
                          <td>
                            <strong>{l.part_name}</strong>
                            <small className="block muted mono">
                              {l.part_sku}
                            </small>
                          </td>
                          <td>{l.designator || "—"}</td>
                          <td>{l.quantity}</td>
                          <td>{l.required}</td>
                          <td>{l.stock}</td>
                          <td>
                            <b
                              className={
                                l.missing ? "amber-text" : "green-text"
                              }
                            >
                              {l.missing || "齐备"}
                            </b>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title="下一个项目，从这里开始"
            description="创建一份 BOM，系统会根据计划数量自动核算现有库存与缺口。"
          >
            <button className="btn primary" onClick={onAdd}>
              <Plus size={16} />
              创建第一个项目
            </button>
          </Empty>
        </div>
      )}
      <div className="inline-note">
        <FileText size={15} />
        BOM 用于计划和备料，不预占或自动扣减库存。实际领料请在物料库中执行出库。
      </div>
      {pending && (
        <Modal
          title="删除项目"
          subtitle={pending.name}
          onClose={() => setPending(null)}
        >
          <div className="modal-body">
            <p>将删除此项目及其 BOM 清单，物料库存和出入库记录不受影响。</p>
          </div>
          <footer>
            <button className="btn" onClick={() => setPending(null)}>
              取消
            </button>
            <button
              className="btn danger-btn"
              onClick={async () => {
                try {
                  await api("/api/v1/projects/" + pending.id, {
                    method: "DELETE",
                  });
                  setPending(null);
                  reload();
                  notify("项目已删除");
                } catch (e) {
                  setPending(null);
                  setError((e as Error).message);
                }
              }}
            >
              确认删除
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}

export function AgentsPage({
  refresh,
  onAdd,
  reload,
  notify,
}: {
  refresh: number;
  onAdd: () => void;
  reload: () => void;
  notify: (s: string) => void;
}) {
  const [keys, setKeys] = useState<ApiKey[]>([]),
    [error, setError] = useState(""),
    [pending, setPending] = useState<ApiKey | null>(null),
    [tab, setTab] = useState("rest"),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    api<ApiKey[]>("/api/v1/keys")
      .then(setKeys)
      .catch((e) => setError(e.message));
  }, [refresh]);
  const origin = window.location.origin;
  const example =
    tab === "rest"
      ? `curl "${origin}/api/v1/parts?q=STM32" \
  -H "X-API-Key: $PARTSBOX_API_KEY"`
      : tab === "python"
        ? `import os\nimport httpx\n\nresponse = httpx.get(\n    "${origin}/api/v1/parts",\n    params={"q": "STM32", "page_size": 20},\n    headers={"X-API-Key": os.environ["PARTSBOX_API_KEY"]},\n)\nresponse.raise_for_status()\nprint(response.json())`
        : JSON.stringify(
            {
              mcpServers: {
                partsbox: {
                  command: "python",
                  args: ["/absolute/path/integrations/mcp_server.py"],
                  env: {
                    PARTSBOX_URL: origin,
                    PARTSBOX_API_KEY: "<替换为只读密钥>",
                    ...(window.location.protocol === "http:" &&
                    !["localhost", "127.0.0.1", "[::1]"].includes(
                      window.location.hostname,
                    )
                      ? { PARTSBOX_ALLOW_INSECURE_HTTP: "true" }
                      : {}),
                  },
                },
              },
            },
            null,
            2,
          );
  return (
    <>
      <div className="agent-banner">
        <span className="agent-art">
          <Bot size={43} strokeWidth={1.3} />
        </span>
        <div>
          <span className="eyebrow">OPEN BY DESIGN</span>
          <h2>你的物料数据，现在可以对话了。</h2>
          <p>标准 REST API · OpenAPI 文档 · MCP 只读工具 · 独立密钥权限</p>
        </div>
        <a className="btn" href="/docs" target="_blank" rel="noreferrer">
          浏览 API 文档
          <ExternalLink size={15} />
        </a>
      </div>
      {error && <Notice error>{error}</Notice>}
      <div className="panel">
        <div className="section-heading">
          <h3>
            API 密钥{" "}
            <span className="count-label">
              {keys.filter((k) => !k.revoked).length} 个有效
            </span>
          </h3>
          <ShieldCheck size={17} className="muted" />
        </div>
        {keys.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>密钥</th>
                  <th>权限</th>
                  <th>创建时间</th>
                  <th>最近使用</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className={k.revoked ? "revoked" : ""}>
                    <td>
                      <span className="key-name">
                        <KeyRound size={15} />
                        {k.name}
                      </span>
                    </td>
                    <td className="mono muted">{k.prefix}••••••••</td>
                    <td>
                      <span className={"scope-tag " + k.scope}>
                        {k.revoked
                          ? "已撤销"
                          : k.scope === "read"
                            ? "只读"
                            : "读写"}
                      </span>
                    </td>
                    <td className="muted">{dateText(k.created_at)}</td>
                    <td className="muted">
                      {k.last_used_at ? dateText(k.last_used_at) : "尚未使用"}
                    </td>
                    <td>
                      <button
                        className="text-btn danger-text"
                        disabled={k.revoked}
                        onClick={() => setPending(k)}
                      >
                        撤销密钥
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="key-empty">
            <KeyRound size={26} />
            <div>
              <strong>创建你的第一把 API 密钥</strong>
              <p>为智能体配置只读密钥，即可安全查询你的物料库。</p>
            </div>
            <button className="btn" onClick={onAdd}>
              创建密钥
              <ArrowUpRight size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="agent-docs-grid">
        <div className="panel code-panel">
          <div className="section-heading">
            <h3>几行代码，即可连接</h3>
            <button
              className="icon-btn"
              aria-label="复制接入示例"
              onClick={async () => {
                try {
                  await copyText(example);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  notify("复制失败，请手动选中代码复制");
                }
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <div className="code-tabs">
            {[
              ["rest", "cURL"],
              ["python", "Python"],
              ["mcp", "MCP 配置"],
            ].map(([v, l]) => (
              <button
                key={v}
                className={tab === v ? "active" : ""}
                onClick={() => setTab(v)}
              >
                {l}
              </button>
            ))}
          </div>
          <pre>
            <code>{example}</code>
          </pre>
          {tab === "mcp" && (
            <p className="field-hint">
              先安装 integrations/requirements.txt，替换脚本绝对路径。MCP
              适配器提供查询工具。
            </p>
          )}
        </div>
        <div className="panel api-guide">
          <div className="section-heading">
            <h3>为自动化做好准备</h3>
          </div>
          {[
            [
              Search,
              "结构化查询",
              "按名称、型号、封装、库位和库存状态筛选，支持分页。",
            ],
            [
              ShieldCheck,
              "权限清晰可控",
              "只读与读写密钥分离，密钥管理仅允许管理员操作。",
            ],
            [
              RefreshCw,
              "可追溯的库存变动",
              "写入支持幂等请求键；同一请求重试不会重复扣库存。",
            ],
          ].map(([Icon, title, desc]) => {
            const I = Icon as typeof Search;
            return (
              <div className="guide-item" key={String(title)}>
                <I size={19} />
                <div>
                  <strong>{String(title)}</strong>
                  <p>{String(desc)}</p>
                </div>
              </div>
            );
          })}
          <a href="/openapi.json" target="_blank" rel="noreferrer">
            下载 OpenAPI 定义
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
      {pending && (
        <Modal
          title="撤销 API 密钥"
          subtitle={pending.name}
          onClose={() => setPending(null)}
        >
          <div className="modal-body">
            <Notice error>
              撤销后，此密钥会立即失效。正在使用它的智能体需要重新配置。
            </Notice>
          </div>
          <footer>
            <button className="btn" onClick={() => setPending(null)}>
              取消
            </button>
            <button
              className="btn danger-btn"
              onClick={async () => {
                try {
                  await api("/api/v1/keys/" + pending.id, { method: "DELETE" });
                  setPending(null);
                  reload();
                  notify("API 密钥已撤销");
                } catch (e) {
                  setPending(null);
                  setError((e as Error).message);
                }
              }}
            >
              确认撤销
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}

export function SettingsPage({
  summary,
  reload,
  notify,
}: {
  summary: Summary | null;
  reload: () => void;
  notify: (s: string) => void;
}) {
  const [system, setSystem] = useState<Record<string, string> | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Record<string, string>>("/api/v1/system")
      .then(setSystem)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      {error && <Notice error>{error}</Notice>}
      <div className="settings-grid">
        <div className="panel settings-panel">
          <div className="section-heading">
            <h3>
              <Database size={18} />
              系统状态
            </h3>
            <span className="status-badge healthy">
              <i />
              {system ? "运行正常" : "连接中"}
            </span>
          </div>
          <dl className="settings-fields">
            <div>
              <dt>应用版本</dt>
              <dd>PartsBox {system?.app_version || "1.0.0"}</dd>
            </div>
            <div>
              <dt>数据库</dt>
              <dd>MySQL {system?.database_version || "—"}</dd>
            </div>
            <div>
              <dt>存储引擎 / 字符集</dt>
              <dd>{system?.storage || "InnoDB · utf8mb4"}</dd>
            </div>
            <div>
              <dt>开源技术栈</dt>
              <dd>React · FastAPI · SQLAlchemy</dd>
            </div>
            <div>
              <dt>日期与金额</dt>
              <dd>本地时区显示 · 人民币 CNY</dd>
            </div>
            <div>
              <dt>数据所有权</dt>
              <dd>自主部署 · 私有数据库</dd>
            </div>
          </dl>
        </div>
        <div className="panel settings-panel">
          <div className="section-heading">
            <h3>
              <Download size={18} />
              数据导出
            </h3>
          </div>
          <p>
            带走你的物料档案、库位、出入库记录和项目 BOM，保留完整的创作记忆。
          </p>
          <a className="btn" href="/api/v1/backup">
            <Download size={16} />
            导出全部数据（JSON）
          </a>
          <a className="btn" href="/api/v1/parts/export">
            <FileText size={16} />
            导出物料（CSV）
          </a>
          <div className="field-hint">
            JSON 为逻辑数据导出，密钥与登录凭据不会被导出。完整备份与恢复请使用
            README 中的 MySQL 备份流程。
          </div>
        </div>
        <div className="panel settings-panel">
          <div className="section-heading">
            <h3>
              <Box size={18} />
              演示物料
            </h3>
            <span className="muted-label">{summary?.demo_parts || 0} 种</span>
          </div>
          <p>先用一组常见元器件了解工作台，再整理你自己的元件收藏。</p>
          <div className="settings-actions">
            <button
              className="btn"
              disabled={
                busy || !!summary?.total_parts || !!summary?.location_count
              }
              onClick={() => setPending("seed")}
            >
              载入演示数据
            </button>
            <button
              className="btn danger-btn"
              disabled={busy || !summary?.demo_parts}
              onClick={() => setPending("clear")}
            >
              清除演示数据
            </button>
          </div>
          <p className="field-hint">
            仅空白库可载入演示数据。已产生新流水或被 BOM
            引用的演示物料不能清除，避免丢失使用记录。
          </p>
        </div>
        <div className="panel settings-panel about-panel">
          <div className="section-heading">
            <h3>专注元件，尽情创造。</h3>
          </div>
          <p>
            PartsBox
            是为个人工作台与小型电子实验室设计的物料管理系统。让工具保持轻盈，让你的每一个想法有据可依。
          </p>
          <div className="tech-badges">
            <span>MySQL</span>
            <span>React</span>
            <span>FastAPI</span>
            <span>OpenAPI</span>
            <span>MCP</span>
          </div>
          <span className="about-stamp">Made for makers. Built to last.</span>
        </div>
      </div>
      {pending && (
        <Modal
          title={pending === "seed" ? "载入演示物料" : "清除演示数据"}
          subtitle={
            pending === "seed"
              ? "将创建 24 种常见元器件、6 个库位及出入库记录。"
              : "这会删除尚未被实际使用的演示物料及其演示流水。"
          }
          onClose={() => setPending("")}
        >
          <div className="modal-body">
            <p>
              {pending === "seed"
                ? "这组数据帮助你熟悉工作台，后续可在这里清除。"
                : "清除后无法撤销。你自己录入的物料和流水会保留；已有新流水的演示物料会阻止此次清除。"}
            </p>
          </div>
          <footer>
            <button
              className="btn"
              disabled={busy}
              onClick={() => setPending("")}
            >
              取消
            </button>
            <button
              className={
                "btn " + (pending === "seed" ? "primary" : "danger-btn")
              }
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/api/v1/demo", {
                    method: pending === "seed" ? "POST" : "DELETE",
                  });
                  notify(
                    pending === "seed" ? "演示数据已就绪" : "演示数据已清除",
                  );
                  reload();
                  setPending("");
                } catch (e) {
                  setError((e as Error).message);
                  setPending("");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "处理中…" : "确认操作"}
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}
