import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Database,
  FolderKanban,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  post,
  type Location,
  type Part,
  type Project,
  type Summary,
} from "./api";
import { Detail, Inventory, type WorkspaceProps } from "./Inventory";
import {
  AgentsPage,
  LocationsPage,
  MovementsPage,
  Overview,
  ProjectsPage,
  SettingsPage,
} from "./pages";
import {
  ImportForm,
  KeyForm,
  LocationForm,
  PartForm,
  ProjectForm,
  StockForm,
} from "./forms";
import { Logo, Modal, Notice, Spinner } from "./ui";

type User = { name: string; scope: string; admin: boolean };
const nav = [
  { id: "overview", label: "工作台总览", icon: LayoutDashboard },
  { id: "inventory", label: "物料库", icon: Package },
  { id: "locations", label: "库位管理", icon: MapPin },
  { id: "movements", label: "出入库记录", icon: History },
  { id: "projects", label: "项目 BOM", icon: FolderKanban },
  { id: "agents", label: "智能体接入", icon: Bot },
];
type Dialog =
  | { type: "part"; part?: Part }
  | { type: "detail"; part: Part }
  | { type: "stock"; part: Part; kind: "in" | "out" }
  | { type: "location"; location?: Location }
  | { type: "project"; project?: Project }
  | { type: "import" }
  | { type: "key" }
  | { type: "help" }
  | null;

function LoginScreen({ onLogin }: { onLogin: (u: User) => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    try {
      onLogin(await post<User>("/api/auth/login", raw));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <Logo />
        <div className="login-story-copy">
          <span className="eyebrow">A SMALL PART. A BIG POSSIBILITY.</span>
          <h1>
            整理好元件，
            <br />
            留更多时间给<span>创造。</span>
          </h1>
          <p>
            从一颗电阻，到下一个灵感。
            <br />
            让你的每一颗元件，都有迹可循。
          </p>
          <div className="login-diagram" aria-hidden="true">
            <div className="diagram-chip">
              <Box size={72} strokeWidth={1} />
            </div>
            <i />
            <i />
            <i />
            <i />
            <span>Ideas begin with a part.</span>
          </div>
        </div>
        <div className="login-story-footer">
          <ShieldCheck size={16} />
          自主部署 · 数据私有 · 为创造者而生
        </div>
      </div>
      <div className="login-form-wrap">
        <div className="login-top-caption">
          YOUR PERSONAL COMPONENT WORKSPACE
        </div>
        <form className="login-form" onSubmit={submit}>
          <span className="login-welcome">很高兴，见到你。</span>
          <h2>进入你的元件工作台</h2>
          <p>找回每一颗元件，连接每一个灵感。</p>
          {error && <Notice error>{error}</Notice>}
          <label>
            用户名
            <input
              name="username"
              autoComplete="username"
              defaultValue="admin"
              required
              placeholder="输入用户名"
            />
          </label>
          <label>
            密码
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="输入你的登录密码"
            />
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? "正在进入…" : "进入工作台"}
            <ArrowRight size={17} />
          </button>
          <div className="login-hint">
            <ShieldCheck size={15} />
            <span>初始账号与密码保存在部署目录的 .env 文件中。</span>
          </div>
        </form>
        <div className="login-bottom">
          PartsBox <span>Made for makers.</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(false),
    [page, setPage] = useState(() => {
      const hash = location.hash.slice(1);
      return [...nav.map((v) => v.id), "settings"].includes(hash)
        ? hash
        : "inventory";
    }),
    [summary, setSummary] = useState<Summary | null>(null),
    [locations, setLocations] = useState<Location[]>([]),
    [refresh, setRefresh] = useState(0),
    [dialog, setDialog] = useState<Dialog>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(""),
    [stockFilter, setStockFilter] = useState(""),
    [locationFilter, setLocationFilter] = useState(""),
    [category, setCategory] = useState("");
  const close = useCallback(() => setDialog(null), []);
  const reload = useCallback(() => setRefresh((v) => v + 1), []);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    function expired() {
      setUser(null);
      setDialog(null);
    }
    window.addEventListener("partsbox:unauthorized", expired);
    return () => window.removeEventListener("partsbox:unauthorized", expired);
  }, []);
  useEffect(() => {
    api<User>("/api/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    if (!user) return;
    let live = true;
    Promise.all([
      api<Summary>("/api/v1/summary"),
      api<Location[]>("/api/v1/locations"),
    ])
      .then(([s, l]) => {
        if (live) {
          setSummary(s);
          setLocations(l);
          setError("");
        }
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401) {
          setUser(null);
          return;
        }
        setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [user, refresh]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    }
    window.addEventListener("keydown", key);
    function hash() {
      const next = location.hash.slice(1);
      if ([...nav.map((v) => v.id), "settings"].includes(next)) setPage(next);
    }
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  function navigate(next: string) {
    setPage(next);
    location.hash = next;
    setMobile(false);
  }
  const props: WorkspaceProps = {
    summary,
    locations,
    refresh,
    reload,
    notify,
    onAdd: () => setDialog({ type: "part" }),
    onImport: () => setDialog({ type: "import" }),
    onDetail: (p) => setDialog({ type: "detail", part: p }),
    onStock: (p, kind) => setDialog({ type: "stock", part: p, kind }),
    onEdit: (p) => setDialog({ type: "part", part: p }),
    onNavigate: navigate,
    search,
    setSearch,
    stockFilter,
    setStockFilter,
    locationFilter,
    setLocationFilter,
    category,
    setCategory,
  };
  if (!authReady)
    return (
      <div className="boot-screen">
        <Logo />
        <Spinner />
      </div>
    );
  if (!user)
    return (
      <LoginScreen
        onLogin={(u) => {
          setUser(u);
          reload();
        }}
      />
    );
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-backdrop" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-btn mobile-close"
            aria-label="关闭导航"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">M</span>
          <div>
            <strong>我的电子工作台</strong>
            <small>个人物料空间</small>
          </div>
          <span className="workspace-dot" title="个人空间" />
        </div>
        <div className="nav-label">
          工作空间<span>WORKSPACE</span>
        </div>
        <nav>
          {nav.map((v) => (
            <button
              className={page === v.id ? "active" : ""}
              key={v.id}
              onClick={() => navigate(v.id)}
            >
              <v.icon size={19} strokeWidth={1.7} />
              <span>{v.label}</span>
              {v.id === "inventory" ? (
                <b>{summary?.total_parts || 0}</b>
              ) : v.id === "agents" ? (
                <span className="new-tag">API</span>
              ) : page === v.id ? (
                <ChevronRight size={14} />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-separator" />
        <div className="sidebar-tools">
          <button
            className={page === "settings" ? "active" : ""}
            onClick={() => navigate("settings")}
          >
            <Settings size={18} strokeWidth={1.7} />
            系统设置
          </button>
          <button onClick={() => setDialog({ type: "help" })}>
            <CircleHelp size={18} strokeWidth={1.7} />
            使用指南
            <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="database-card">
            <div>
              <span className="database-icon">
                <Database size={16} />
              </span>
              <strong>你的数据，由你掌控</strong>
              <span className="live-dot" />
            </div>
            <p>MySQL 私有存储 · 开放 API</p>
            <button onClick={() => navigate("agents")}>
              连接你的智能体
              <ArrowRight size={13} />
            </button>
          </div>
          <div className="user-profile">
            <span className="user-avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>工作台管理员</small>
            </div>
            <button
              className="icon-btn"
              aria-label="退出登录"
              title="退出登录"
              onClick={async () => {
                try {
                  await post("/api/auth/logout", {});
                  setUser(null);
                  setSummary(null);
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn mobile-menu"
              aria-label="打开导航"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <Box size={16} />
            <span>我的工作台</span>
            <ChevronRight size={13} />
            <strong>
              {page === "settings"
                ? "系统设置"
                : nav.find((v) => v.id === page)?.label}
            </strong>
          </div>
          <div className="topbar-right">
            <label className="global-search">
              <Search size={16} />
              <input
                id="global-search"
                placeholder="搜索你的元件…"
                aria-label="全局搜索"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (page !== "inventory") navigate("inventory");
                }}
              />
              <kbd>Ctrl K</kbd>
            </label>
            <span className={"connection-status" + (error ? " offline" : "")}>
              <i />
              {error ? "连接异常" : summary ? "工作台已连接" : "正在连接…"}
            </span>
            <button
              className={
                "notification-button " + (summary?.low_stock ? "has-alert" : "")
              }
              aria-label="查看低库存提醒"
              onClick={() => {
                setStockFilter("low");
                setCategory("");
                setLocationFilter("");
                setSearch("");
                navigate("inventory");
              }}
            >
              <Bell size={19} />
            </button>
            <span className="top-avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <main>
          {error && (
            <Notice error>
              {error}
              <button className="text-btn" onClick={reload}>
                重新连接
              </button>
            </Notice>
          )}
          {page === "inventory" ? (
            <Inventory {...props} />
          ) : page === "overview" ? (
            <Overview {...props} />
          ) : page === "locations" ? (
            <LocationsPage
              locations={locations}
              onAdd={() => setDialog({ type: "location" })}
              onEdit={(l) => setDialog({ type: "location", location: l })}
              onView={(l) => {
                setLocationFilter(String(l.id));
                setCategory("");
                setSearch("");
                setStockFilter("");
                navigate("inventory");
              }}
              reload={reload}
              notify={notify}
            />
          ) : page === "movements" ? (
            <MovementsPage refresh={refresh} />
          ) : page === "projects" ? (
            <ProjectsPage
              refresh={refresh}
              onAdd={() => setDialog({ type: "project" })}
              onEdit={(p) => setDialog({ type: "project", project: p })}
              reload={reload}
              notify={notify}
            />
          ) : page === "agents" ? (
            <AgentsPage
              refresh={refresh}
              onAdd={() => setDialog({ type: "key" })}
              reload={reload}
              notify={notify}
            />
          ) : (
            <SettingsPage summary={summary} reload={reload} notify={notify} />
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button aria-label="关闭提示" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {dialog?.type === "part" && (
        <PartForm
          part={dialog.part}
          locations={locations}
          onClose={close}
          onSaved={reload}
          notify={notify}
        />
      )}{" "}
      {dialog?.type === "stock" && (
        <StockForm
          part={dialog.part}
          kind={dialog.kind}
          onClose={close}
          onSaved={reload}
          notify={notify}
        />
      )}{" "}
      {dialog?.type === "detail" && (
        <Detail
          part={dialog.part}
          onClose={close}
          onEdit={props.onEdit}
          onStock={props.onStock}
          notify={notify}
          reload={reload}
        />
      )}{" "}
      {dialog?.type === "location" && (
        <LocationForm
          location={dialog.location}
          onClose={close}
          onSaved={reload}
          notify={notify}
        />
      )}{" "}
      {dialog?.type === "import" && (
        <ImportForm onClose={close} onSaved={reload} notify={notify} />
      )}{" "}
      {dialog?.type === "key" && (
        <KeyForm onClose={close} onSaved={reload} notify={notify} />
      )}{" "}
      {dialog?.type === "project" && (
        <ProjectForm
          project={dialog.project}
          onClose={close}
          onSaved={reload}
          notify={notify}
        />
      )}{" "}
      {dialog?.type === "help" && (
        <Modal
          title="认识你的元件工作台"
          subtitle="从收纳到创造，四步开始。"
          onClose={close}
        >
          <div className="modal-body help-steps">
            {[
              ["01", "创建库位", "为你的收纳盒、抽屉创建库位编号，如 A-01。"],
              [
                "02",
                "录入物料",
                "添加名称、型号、参数与单价，也可以用 CSV 批量导入。",
              ],
              [
                "03",
                "记录出入库",
                "补货时入库、领用时出库，系统自动保留库存与流水。",
              ],
              [
                "04",
                "连接智能体",
                "在智能体接入中创建只读密钥，使用 API 或 MCP 查询物料。",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </div>
            ))}
            <Notice>想先体验？可在系统设置中为全新物料库载入演示数据。</Notice>
          </div>
          <footer>
            <a className="btn" href="/docs" target="_blank" rel="noreferrer">
              接口文档
              <ArrowUpRight size={15} />
            </a>
            <button className="btn primary" onClick={close}>
              开始整理
            </button>
          </footer>
        </Modal>
      )}
    </div>
  );
}
