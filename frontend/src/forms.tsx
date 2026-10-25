import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Copy,
  FileDown,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Papa from "papaparse";
import { api, post, type Part, type Location, type Project } from "./api";
import { Modal, Notice, PartArt, StockBadge, downloadBlob } from "./ui";

export const categories = [
  "电阻",
  "电容",
  "电感",
  "集成电路",
  "二极管",
  "晶体管",
  "连接器",
  "模块",
  "其他",
];
type FormProps = {
  onClose: () => void;
  onSaved: () => void;
  notify: (m: string) => void;
};
export function PartForm({
  part,
  locations,
  onClose,
  onSaved,
  notify,
}: { part?: Part; locations: Location[] } & FormProps) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [specs, setSpecs] = useState(
    Object.entries(part?.specs || {}).map(([key, value]) => ({ key, value })),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const body = {
      ...raw,
      quantity: Number(raw.quantity || 0),
      min_quantity: Number(raw.min_quantity),
      unit_price: raw.unit_price || "0",
      location_id: raw.location_id ? Number(raw.location_id) : null,
      specs: Object.fromEntries(
        specs.filter((s) => s.key.trim()).map((s) => [s.key.trim(), s.value]),
      ),
    };
    try {
      await api("/api/v1/parts" + (part ? "/" + part.id : ""), {
        method: part ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      notify(part ? "物料信息已更新" : "物料已加入你的物料库");
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={part ? "编辑物料" : "新增物料"}
      subtitle="录入元件档案，让下一次查找更轻松。"
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          {error && <Notice error>{error}</Notice>}
          <div className="form-section-label">
            基本信息 <span>01</span>
          </div>
          <div className="form-grid">
            <label>
              物料名称 <em>*</em>
              <input
                name="name"
                required
                maxLength={160}
                defaultValue={part?.name}
                placeholder="例如：STM32F103C8T6"
              />
            </label>
            <label>
              物料编号 <em>*</em>
              <input
                name="sku"
                required
                maxLength={60}
                defaultValue={part?.sku}
                placeholder="例如：IC-006"
              />
            </label>
            <label>
              物料分类 <em>*</em>
              <select
                name="category"
                defaultValue={part?.category || "集成电路"}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              封装
              <input
                name="package"
                maxLength={60}
                defaultValue={part?.package}
                placeholder="例如：LQFP-48"
              />
            </label>
            <label>
              制造商
              <input
                name="manufacturer"
                maxLength={100}
                defaultValue={part?.manufacturer}
                placeholder="例如：ST 意法半导体"
              />
            </label>
            <label>
              存放库位
              <select name="location_id" defaultValue={part?.location_id || ""}>
                <option value="">暂不分配</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} · {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="span-two">
              规格描述
              <input
                name="description"
                maxLength={500}
                defaultValue={part?.description}
                placeholder="简述主要参数，用于快速检索"
              />
            </label>
          </div>
          <div className="form-section-label">
            库存与成本 <span>02</span>
          </div>
          <div className="form-grid thirds">
            {!part && (
              <label>
                初始库存
                <input
                  name="quantity"
                  type="number"
                  min={0}
                  max={1000000000}
                  step={1}
                  defaultValue={0}
                />
              </label>
            )}
            <label>
              低库存阈值
              <input
                name="min_quantity"
                type="number"
                min={0}
                max={1000000000}
                step={1}
                defaultValue={part?.min_quantity ?? 10}
                required
              />
            </label>
            <label>
              单价（人民币 / 件）
              <input
                name="unit_price"
                type="number"
                min={0}
                max={99999999}
                step="0.0001"
                defaultValue={part?.unit_price || "0"}
                required
              />
            </label>
          </div>
          {part && (
            <p className="field-hint">
              当前库存 {part.quantity} 件，数量请通过出入库操作调整。
            </p>
          )}
          <div className="form-section-label">
            详细参数 <span>03</span>
          </div>
          {specs.map((s, i) => (
            <div className="spec-row" key={i}>
              <input
                aria-label={"参数名称 " + (i + 1)}
                value={s.key}
                maxLength={80}
                onChange={(e) =>
                  setSpecs((v) =>
                    v.map((x, j) =>
                      j === i ? { ...x, key: e.target.value } : x,
                    ),
                  )
                }
                placeholder="参数名称，如：主频"
              />
              <input
                aria-label={"参数值 " + (i + 1)}
                value={s.value}
                maxLength={200}
                onChange={(e) =>
                  setSpecs((v) =>
                    v.map((x, j) =>
                      j === i ? { ...x, value: e.target.value } : x,
                    ),
                  )
                }
                placeholder="参数值，如：72MHz"
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="删除参数"
                onClick={() => setSpecs((v) => v.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            className="text-btn"
            type="button"
            disabled={specs.length >= 30}
            onClick={() => setSpecs((v) => [...v, { key: "", value: "" }])}
          >
            <Plus size={15} />
            添加参数
          </button>
          <div className="form-grid single">
            <label>
              数据手册链接
              <input
                name="datasheet_url"
                type="url"
                maxLength={1000}
                defaultValue={part?.datasheet_url}
                placeholder="https://…"
              />
            </label>
            <label>
              备注
              <textarea
                name="notes"
                rows={2}
                maxLength={5000}
                defaultValue={part?.notes}
                placeholder="采购来源、使用提示或替代型号…"
              />
            </label>
          </div>
        </div>
        <footer>
          <button className="btn" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "保存中…" : part ? "保存更改" : "创建物料"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function StockForm({
  part,
  kind = "in",
  onClose,
  onSaved,
  notify,
}: { part: Part; kind?: "in" | "out" } & FormProps) {
  const [mode, setMode] = useState(kind),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [qty, setQty] = useState(1);
  const [requestKey] = useState(() => crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(`/api/v1/parts/${part.id}/stock`, {
        method: "POST",
        headers: { "Idempotency-Key": requestKey },
        body: JSON.stringify({
          kind: mode,
          quantity: qty,
          reason: values.reason,
        }),
      });
      notify(`${mode === "in" ? "入库" : "出库"}成功，库存已同步`);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="库存变动"
      subtitle="每一次领用与补货，都会留下记录。"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          {error && <Notice error>{error}</Notice>}
          <div className="selected-part">
            <PartArt category={part.category} />
            <div>
              <strong>{part.name}</strong>
              <small>
                {part.sku} · 当前库存 {part.quantity} 件
              </small>
            </div>
            <StockBadge part={part} />
          </div>
          <div className="stock-mode">
            <button
              className={mode === "in" ? "active" : ""}
              type="button"
              onClick={() => setMode("in")}
            >
              <ArrowDownToLine size={18} />
              物料入库
            </button>
            <button
              className={mode === "out" ? "active" : ""}
              type="button"
              onClick={() => setMode("out")}
            >
              <ArrowUpFromLine size={18} />
              物料出库
            </button>
          </div>
          <div className="form-grid single">
            <label>
              {mode === "in" ? "入库" : "出库"}数量 <em>*</em>
              <input
                type="number"
                min={1}
                max={mode === "out" ? part.quantity : 1000000000}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                required
                autoFocus
              />
            </label>
            <label>
              操作原因 <em>*</em>
              <input
                name="reason"
                maxLength={300}
                required
                placeholder={
                  mode === "in"
                    ? "例如：立创商城采购补货"
                    : "例如：智能温控器项目领料"
                }
              />
            </label>
          </div>
          <div className="balance-preview">
            <span>操作后库存</span>
            <strong>
              {part.quantity + (mode === "in" ? qty : -qty)} <small>件</small>
            </strong>
          </div>
        </div>
        <footer>
          <button className="btn" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            disabled={busy || (mode === "out" && qty > part.quantity)}
          >
            {busy ? "处理中…" : `确认${mode === "in" ? "入库" : "出库"}`}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function LocationForm({
  location,
  onClose,
  onSaved,
  notify,
}: { location?: Location } & FormProps) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/api/v1/locations" + (location ? "/" + location.id : ""), {
        method: location ? "PUT" : "POST",
        body: JSON.stringify({ ...data, capacity: Number(data.capacity) }),
      });
      notify(location ? "库位已更新" : "新库位已创建");
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={location ? "编辑库位" : "新增库位"}
      subtitle="为收纳盒、抽屉或货架创建一个容易记住的地址。"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          {error && <Notice error>{error}</Notice>}
          <div className="form-grid">
            <label>
              库位编号 <em>*</em>
              <input
                name="code"
                defaultValue={location?.code}
                required
                maxLength={40}
                pattern="[A-Za-z0-9_\-]+"
                placeholder="例如：A-03"
              />
            </label>
            <label>
              库位名称 <em>*</em>
              <input
                name="name"
                defaultValue={location?.name}
                required
                maxLength={100}
                placeholder="例如：电阻收纳盒"
              />
            </label>
            <label className="span-two">
              位置说明
              <input
                name="description"
                defaultValue={location?.description}
                maxLength={500}
                placeholder="例如：工作台左侧 · 第三层"
              />
            </label>
            <label className="span-two">
              建议物料种类容量
              <input
                name="capacity"
                type="number"
                min={1}
                max={100000}
                defaultValue={location?.capacity ?? 24}
                required
              />
              <small className="field-hint">
                用于展示收纳空间使用情况，允许临时超出容量。
              </small>
            </label>
          </div>
        </div>
        <footer>
          <button className="btn" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "保存中…" : "保存库位"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function ImportForm({ onClose, onSaved, notify }: FormProps) {
  const [file, setFile] = useState<File | null>(null),
    [rows, setRows] = useState<Record<string, string>[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function choose(file: File) {
    setError("");
    setFile(file);
    setRows([]);
    if (file.size > 2 * 1024 * 1024) {
      setError("文件大小不能超过 2 MB");
      setFile(null);
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (r) => {
        if (
          !r.meta.fields?.includes("sku") ||
          !r.meta.fields?.includes("name") ||
          !r.meta.fields?.includes("category")
        ) {
          setError("文件需要包含 sku、name、category 列，请使用导入模板");
          return;
        }
        if (r.errors.length) {
          setError("CSV 格式错误：" + r.errors[0].message);
          return;
        }
        setRows(r.data);
      },
      error: (e) => setError(e.message),
    });
  }
  async function submit() {
    if (!file) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await api<{ imported: number }>("/api/v1/parts/import", {
        method: "POST",
        body: form,
      });
      notify(`已成功导入 ${r.imported} 种物料`);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="批量导入物料"
      subtitle="将散落在表格里的元件，整齐地收进物料库。"
      onClose={onClose}
      wide
    >
      <div className="modal-body">
        <div className="import-tip">
          <div>
            <strong>第一次导入？从模板开始</strong>
            <p>支持 UTF-8 CSV，最多 1,000 行；Excel 可另存为 CSV UTF-8。</p>
          </div>
          <button
            className="btn"
            onClick={() =>
              downloadBlob(
                "\ufeffsku,name,category,manufacturer,package,description,quantity,min_quantity,unit_price,location_code,datasheet_url,notes\nRES-NEW,10kΩ 电阻,电阻,YAGEO,0603,10kΩ ±1%,100,20,0.01,,,\n",
                "partsbox-import-template.csv",
              )
            }
          >
            <FileDown size={15} />
            下载模板
          </button>
        </div>
        <label
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files[0]) choose(e.dataTransfer.files[0]);
          }}
        >
          <Upload size={26} />
          <strong>
            {file ? file.name : "点击选择，或拖拽 CSV 文件到这里"}
          </strong>
          <span>CSV · 最大 2 MB</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              if (e.target.files?.[0]) choose(e.target.files[0]);
            }}
          />
        </label>
        {error && <Notice error>{error}</Notice>}
        {rows.length > 0 && (
          <>
            <div className="section-heading">
              <strong>导入预览</strong>
              <small>共 {rows.length} 行 · 展示前 5 行</small>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>物料编号</th>
                    <th>名称</th>
                    <th>分类</th>
                    <th>数量</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      <td className="mono">{r.sku}</td>
                      <td>{r.name}</td>
                      <td>{r.category}</td>
                      <td>{r.quantity || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="field-hint">
          相同编号不会覆盖现有物料。所有行通过校验后才会写入；填写的库位须提前创建。
        </p>
      </div>
      <footer>
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn primary"
          disabled={!file || !rows.length || !!error || busy}
          onClick={submit}
        >
          {busy
            ? "校验并导入中…"
            : `确认导入${rows.length ? " " + rows.length + " 种物料" : ""}`}
        </button>
      </footer>
    </Modal>
  );
}

export function KeyForm({ onClose, onSaved, notify }: FormProps) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [token, setToken] = useState(""),
    [copied, setCopied] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await post<{ token: string }>(
        "/api/v1/keys",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      setToken(r.token);
      onSaved();
      notify("API 密钥已创建");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={token ? "妥善保存你的密钥" : "创建 API 密钥"}
      subtitle={
        token
          ? "完整密钥仅在此处显示一次，关闭后无法再次查看。"
          : "给每一个智能体独立的身份与权限。"
      }
      onClose={onClose}
    >
      {token ? (
        <>
          <div className="modal-body">
            <Notice>请复制并保存到密码管理器或智能体的环境变量。</Notice>
            <div className="token-box">
              <code>{token}</code>
              <button
                className="icon-btn"
                aria-label="复制密钥"
                onClick={async () => {
                  await navigator.clipboard.writeText(token);
                  setCopied(true);
                }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <p className="field-hint">
              后续通过请求头 X-API-Key 传入密钥；服务端仅保存摘要。
            </p>
          </div>
          <footer>
            <button className="btn primary" onClick={onClose}>
              我已保存
            </button>
          </footer>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <Notice error>{error}</Notice>}
            <div className="form-grid single">
              <label>
                密钥名称
                <input
                  name="name"
                  placeholder="例如：我的库存助手"
                  required
                  maxLength={80}
                />
              </label>
              <label>
                访问权限
                <select name="scope" defaultValue="read">
                  <option value="read">
                    只读 — 查询物料、库存、库位与 BOM
                  </option>
                  <option value="write">读写 — 额外允许维护物料与出入库</option>
                </select>
              </label>
            </div>
            <Notice>
              建议为智能体使用只读权限。所有写入均会检查权限，库存操作记录操作者。
            </Notice>
          </div>
          <footer>
            <button className="btn" type="button" onClick={onClose}>
              取消
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? "创建中…" : "生成密钥"}
            </button>
          </footer>
        </form>
      )}
    </Modal>
  );
}

export function ProjectForm({
  project,
  onClose,
  onSaved,
  notify,
}: { project?: Project } & FormProps) {
  const [lines, setLines] = useState(
      project?.lines.map((v) => ({
        part_id: v.part_id,
        quantity: v.quantity,
        designator: v.designator,
      })) || [],
    ),
    [parts, setParts] = useState<Part[]>([]),
    [q, setQ] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      api<{ items: Part[] }>(
        `/api/v1/parts?page_size=100&q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      )
        .then((r) => setParts(r.items))
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        });
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/api/v1/projects" + (project ? "/" + project.id : ""), {
        method: project ? "PUT" : "POST",
        body: JSON.stringify({
          ...values,
          build_quantity: Number(values.build_quantity),
          lines,
        }),
      });
      onSaved();
      notify("项目 BOM 已保存");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={project ? "编辑项目 BOM" : "创建项目 BOM"}
      subtitle="整理项目用料，提前发现缺料。BOM 仅计算需求，不预占或扣减库存。"
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          {error && <Notice error>{error}</Notice>}
          <div className="form-grid">
            <label>
              项目名称
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={project?.name}
                placeholder="例如：桌面智能温控器"
              />
            </label>
            <label>
              计划制作数量
              <input
                name="build_quantity"
                type="number"
                min={1}
                max={1000000}
                defaultValue={project?.build_quantity || 1}
                required
              />
            </label>
            <label className="span-two">
              项目说明
              <input
                name="description"
                maxLength={500}
                defaultValue={project?.description}
                placeholder="记录项目用途与版本"
              />
            </label>
          </div>
          <div className="section-heading">
            <strong>用料清单</strong>
            <button
              className="text-btn"
              type="button"
              onClick={() =>
                setLines((v) => [
                  ...v,
                  { part_id: 0, quantity: 1, designator: "" },
                ])
              }
            >
              <Plus size={15} />
              添加物料
            </button>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索可选物料：名称、型号、参数…"
            aria-label="搜索 BOM 物料"
          />
          <div className="bom-edit-list">
            {lines.map((line, i) => (
              <div className="bom-edit-row" key={i}>
                <select
                  aria-label={"BOM 物料 " + (i + 1)}
                  value={line.part_id}
                  required
                  onChange={(e) =>
                    setLines((v) =>
                      v.map((x, j) =>
                        j === i ? { ...x, part_id: Number(e.target.value) } : x,
                      ),
                    )
                  }
                >
                  <option value="0">选择物料</option>
                  {line.part_id &&
                    !parts.some((p) => p.id === line.part_id) && (
                      <option value={line.part_id}>
                        {project?.lines.find((l) => l.part_id === line.part_id)
                          ?.part_name || "已选物料 #" + line.part_id}
                      </option>
                    )}
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={"单台用量 " + (i + 1)}
                  type="number"
                  min={1}
                  max={1000000}
                  required
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((v) =>
                      v.map((x, j) =>
                        j === i
                          ? { ...x, quantity: Number(e.target.value) }
                          : x,
                      ),
                    )
                  }
                />
                <input
                  aria-label={"位号 " + (i + 1)}
                  maxLength={100}
                  placeholder="位号 R1,R2"
                  value={line.designator}
                  onChange={(e) =>
                    setLines((v) =>
                      v.map((x, j) =>
                        j === i ? { ...x, designator: e.target.value } : x,
                      ),
                    )
                  }
                />
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="移除用料"
                  onClick={() => setLines((v) => v.filter((_, j) => j !== i))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          {!lines.length && (
            <p className="quiet-empty">点击“添加物料”，开始整理项目用料。</p>
          )}
        </div>
        <footer>
          <button className="btn" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            disabled={busy || lines.some((l) => !l.part_id)}
          >
            {busy ? "保存中…" : "保存项目"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
