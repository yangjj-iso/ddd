# PartsBox · 电子元器件物料管理

面向个人电子工作台与小型实验室的物料管理系统。中文响应式界面、真实 MySQL 存储、标准 REST API，以及供智能体使用的只读 MCP 适配器。

## 功能

- **物料库**：元件名称、编号、分类、制造商、封装、电气参数、数据手册、备注与单价；搜索、筛选、分页、表格 / 卡片视图。
- **库存**：入库、出库、低库存 / 缺货提醒、不可直接改写的库存流水。金额以人民币计算；数量为整数“件”。
- **库位**：收纳盒 / 抽屉 / 货架编号、物料归位与建议容量。容量用于展示，可临时超出。
- **项目 BOM**：计划制作数量、单台用量、位号、库存缺口与成本计算。BOM **不预占、不自动扣减**库存。
- **导入导出**：UTF-8 CSV 批量导入（事务校验，失败不部分写入）、CSV 导出、完整业务数据 JSON 导出。
- **智能体**：OpenAPI / Swagger、独立只读 / 读写 API 密钥、撤销与最近使用时间、MCP 只读查询工具。
- **演示数据**：显式载入 24 种元件、6 个库位及配套流水；默认生产库为空，可在系统设置中载入 / 清除。

## 技术栈

React 19 + TypeScript + Vite + Lucide / FastAPI + Pydantic / SQLAlchemy 2 + Alembic / **MySQL 8.4 LTS（InnoDB、utf8mb4）**。没有 SQLite 替代模式，也没有把业务记录存进浏览器。框架与依赖采用开源软件；数据库可以独立迁移到自己的服务器。

官方资料：[React](https://react.dev/)、[FastAPI](https://fastapi.tiangolo.com/)、[SQLAlchemy](https://docs.sqlalchemy.org/en/20/)、[MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/)、[MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)。

## 一键运行（Windows / Docker Desktop）

前提：Docker Desktop 正在运行，启用 Linux 容器。

```powershell
git clone https://github.com/yangjj-iso/ddd.git
cd ddd
./scripts/setup.ps1
```

首次运行自动生成随机数据库密码、管理员密码和会话密钥，写入本机 `.env`（已加入 Git 忽略），随后构建前端、启动 MySQL、执行数据库迁移并启动服务。

- 网页：<http://localhost:8000>
- Swagger：<http://localhost:8000/docs>
- OpenAPI：<http://localhost:8000/openapi.json>
- 登录信息：查看 `.env` 的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`。
- 可选择 `./scripts/setup.ps1 -Demo` 载入演示数据，已有物料时不会重复载入。

```powershell
docker compose logs -f app
docker compose stop
docker compose up -d --build --wait
```

MySQL 数据保留在 `mysql_data` Docker 卷中。`docker compose down` 不删除数据卷；**不要执行 `docker compose down -v`，除非确实要永久删除数据库**。

## 本地开发

要求 Python 3.12+、Node.js 22+、MySQL 8.4。只使用 Docker 启动数据库：

```powershell
./scripts/setup.ps1 -DatabaseOnly
./scripts/dev.ps1
```

另开终端启动网页：

```powershell
cd frontend
npm ci
npm run dev
```

开发地址 <http://127.0.0.1:5173>；Vite 代理 `/api`、`/docs`、`/openapi.json` 到后端。前后端在浏览器中保持同源。

已有 MySQL 时，可运行 `./scripts/setup.ps1 -ConfigureOnly` 生成配置，再修改 `.env` 的 `DATABASE_URL`，指向已创建的 `utf8mb4` 数据库；随后执行 `./scripts/dev.ps1`。密码包含特殊字符时，URL 中的用户名和密码需要百分号编码。Docker 配置使用自动生成的十六进制密码，避免 URL 编码歧义。

### 本机完整应用（已有 MySQL，无需 Docker）

先执行 `./scripts/setup.ps1 -ConfigureOnly`，修改 `.env` 的 `DATABASE_URL` 指向自己的 MySQL 数据库，然后运行：

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install --require-hashes -r backend/requirements.lock.txt
./scripts/start-local.ps1
```

首次运行会构建前端并启动完整应用，打开 <http://127.0.0.1:8000>。后续可双击根目录的 `启动工作台.cmd`，或执行 `./scripts/start-local.ps1 -SkipBuild`。如果源码有更新，请运行不带 `-SkipBuild` 的命令重新构建网页。

GitHub 仓库仅包含源码与示例配置，不包含 `.env`、MySQL 程序、数据库文件、Python 虚拟环境或前端构建产物。全新下载项目时，请完成 Docker 部署或上述本机安装后再使用快捷启动入口。

原始交付电脑已准备便携 MySQL 并载入 24 种演示物料；该电脑的数据位于 **`.runtime/mysql-data/`**，运行配置在 `.runtime/my.ini`。这份持久化数据需要保留，不能作为临时缓存清理。便携 MySQL 与 Docker 使用各自独立的数据目录；切换部署方式时先备份。自动化测试使用独立测试库，不会清空工作台数据。

新数据库迁移：

生产依赖锁定于 `backend/requirements.lock.txt`，开发依赖锁定于 `backend/requirements-dev.lock.txt`，前端锁定于 `frontend/package-lock.json`。升级 Python 依赖后，可用 `uv pip compile --universal --generate-hashes` 重新生成锁文件，再执行测试。

```powershell
cd backend
../.venv/Scripts/python.exe -m alembic revision --autogenerate -m "describe change"
../.venv/Scripts/python.exe -m alembic upgrade head
```

提交生成的迁移文件。生产启动只执行迁移，不自动初始化演示数据。

## API 与外部智能体

登录 → 智能体接入 → 创建 API 密钥 → 选择**只读**。完整密钥只显示一次，服务端仅存 SHA-256 摘要。通过 `X-API-Key` 请求头传入。

```bash
curl 'http://localhost:8000/api/v1/parts?q=STM32&page=1&page_size=20' \
  -H "X-API-Key: $PARTSBOX_API_KEY"
```

| 端点 | 作用 |
| --- | --- |
| `GET /api/v1/parts` | 搜索 / 筛选 / 分页 |
| `GET /api/v1/parts/{id}` | 元件详情与参数 |
| `GET /api/v1/summary` | 汇总与低库存 |
| `GET /api/v1/locations` | 库位与库存分布 |
| `GET /api/v1/movements` | 分页库存流水 |
| `GET /api/v1/projects` | BOM、需求与缺口 |
| `POST /api/v1/parts/{id}/stock` | 带权限和事务检查的出入库 |
| `GET /openapi.json` | 可供代码生成或智能体读取的接口定义 |

只读密钥不能创建 / 修改记录；读写密钥可维护物料、库位、BOM 及出入库，不能管理密钥、导入演示数据或导出完整备份。`/docs` 和 OpenAPI 定义可公开阅读，业务数据接口均需认证。

出入库支持 `Idempotency-Key` 请求头，建议每笔业务生成 UUID，重试时复用同一个键与相同请求体。相同键重复请求返回原流水；参数或操作者不同则返回 409。库存更新对元件行加锁，并与流水在同一事务内提交，避免并发出库导致负库存。所有时间字段返回 UTC ISO 8601；前端按浏览器时区显示。

```json
{"kind":"out","quantity":2,"reason":"温控器项目领料"}
```

`unit_price` 是十进制字符串，后端按 DECIMAL(12,4) 存储，避免二进制浮点写入金额；汇总以人民币两位小数显示。

## MCP 只读适配器

`integrations/mcp_server.py` 基于官方 MCP Python SDK 2.x，通过 HTTP API 查询，不直接访问数据库，不暴露写工具。

```powershell
.venv/Scripts/python.exe -m pip install --require-hashes -r integrations/requirements.lock.txt
```

在支持 MCP stdio 的客户端中添加配置，替换 Python 与脚本的**绝对路径**：

```json
{
  "mcpServers": {
    "partsbox": {
      "command": "C:/your-project/.venv/Scripts/python.exe",
      "args": ["C:/your-project/integrations/mcp_server.py"],
      "env": {
        "PARTSBOX_URL": "http://127.0.0.1:8000",
        "PARTSBOX_API_KEY": "替换为自己的只读密钥"
      }
    }
  }
}
```

工具：`search_parts`、`get_part`、`inventory_summary`、`list_locations`、`list_project_boms`、`stock_history`。远程 API 地址必须使用 HTTPS；本机允许 HTTP。MCP SDK 升级前请重新验证客户端兼容性。

## 导入与备份

导入窗口可下载 CSV 模板。必填 `sku`、`name`、`category`；分类限电阻、电容、电感、集成电路、二极管、晶体管、连接器、模块、其他。可选 `location_code` 必须已存在。初始库存自动产生入库流水。单次最多 1,000 行 / 2 MB，整批通过验证才提交；不覆盖相同编号。

网页 JSON 导出用于业务数据留存和后续迁移，**不等价于可直接恢复的 MySQL 备份**。完整备份请使用 MySQL 工具，备份含凭据摘要，注意保管：

```powershell
# Docker 内执行，密码使用容器内环境变量，备份通过 docker cp 取出。
docker compose exec mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -u root --single-transaction --routines --triggers "$MYSQL_DATABASE" > /tmp/partsbox.sql'
docker compose cp mysql:/tmp/partsbox.sql ./partsbox-backup.sql
```

恢复到一个已建好的独立空数据库后再切换 `DATABASE_URL`；先验证备份，避免直接覆盖仍在使用的数据。不要把 `.env`、SQL 备份或数据库目录提交到 Git。

## 部署说明

默认仅监听本机 `127.0.0.1`，适用于个人工作台。部署到其他机器可修改 Compose 端口绑定，置于 HTTPS 反向代理后，并设置 `COOKIE_SECURE=true`、`TRUSTED_ORIGINS=["https://你的域名"]`。只向可信网络开放应用，不向公网暴露 MySQL 端口。对外部署应使用固定域名和 HTTPS；管理员账号目前是单用户模式，团队多用户权限、供应商采购流程、条码打印与附件上传尚未实现。

## 验证

```powershell
cd frontend
npm run build

# 后端集成测试必须连接专用 MySQL 测试库；绝不使用正式库。
cd ../backend
$env:TEST_DATABASE_URL='mysql+pymysql://user:password@127.0.0.1:3307/partsbox_test?charset=utf8mb4'
../.venv/Scripts/python.exe -m pytest -q
```

测试库名必须以 `_test` 结尾。测试会重建该库内的应用表，覆盖库存事务、幂等重试、并发出库、密钥权限、批量导入回滚和 BOM 缺口计算。

### 本次交付验证

- 实际运行 MySQL 8.4.13，Alembic 初始迁移成功；管理员密码与数据库密码均为本机随机生成。
- 前端 TypeScript 检查与 Vite 生产构建通过。
- 专用 MySQL 测试库执行 **11 项集成测试，全部通过**。
- 官方 MCP SDK 客户端实际调用全部 **6 个只读工具**成功；临时验证密钥已撤销并清理。
- 浏览器验证了登录、参数搜索、列表 / 卡片切换、物料详情、出入库表单、实际新增、库位、总览与智能体接入页。临时验收物料已清理。
- Windows PowerShell 启动脚本实际验证通过；Docker Compose 通过配置校验。当前电脑 Docker 引擎未运行成功，**尚未执行完整容器构建与容器运行验证**。
- [工作台截图](docs/screenshots/workspace.jpg)。
