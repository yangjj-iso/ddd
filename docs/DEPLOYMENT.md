# Ubuntu 服务器部署

面向 Ubuntu 24.04、2 核 CPU / 2GB 内存的部署方式。网站由 Nginx 提供入口，FastAPI 只绑定宿主机 `127.0.0.1:8000`；生产覆盖配置不发布 MySQL 端口。

## 安装与启动

需要 Docker Engine、Compose v2.24+、Git、Python 3 和 Nginx。使用系统软件包或 Docker 官方安装文档配置运行环境。腾讯云服务器可按腾讯云官方文档配置内网镜像加速地址，其他网络不要直接照搬该地址。

```bash
git clone https://github.com/yangjj-iso/ddd.git ~/partsbox
cd ~/partsbox
sudo env PUBLIC_ORIGIN=http://你的公网IP bash scripts/setup-linux.sh
sudo install -d -m 755 /var/lib/letsencrypt
sudo install -m 644 deploy/nginx.conf /etc/nginx/sites-available/partsbox
sudo ln -s /etc/nginx/sites-available/partsbox /etc/nginx/sites-enabled/partsbox
# 新安装 Nginx 时，禁用其欢迎页站点，避免默认监听冲突。
sudo unlink /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

`setup-linux.sh` 首次生成独立随机凭据，保存于项目 `.env`（权限 600），重复执行时保留数据库密码及管理员密码。查看管理员账号时，使用 SSH 登录服务器后执行 `sudo grep '^ADMIN_' .env`。不要将该文件上传至 GitHub。

首次可选择载入演示数据：

```bash
sudo docker compose -f compose.yaml -f deploy/compose.production.yaml exec app python -m app.seed
```

## IP HTTPS

先确保公网 TCP 80 / 443 可以访问，并已配置上述 HTTP 站点，然后运行：

```bash
sudo bash scripts/enable-https-ip.sh 你的公网IPv4
```

脚本使用 Certbot 和 Let's Encrypt 的短期 IP 证书，将 HTTP 转至 HTTPS，启用安全会话 Cookie，并配置每天两次的证书续期检查。HTTP 80 仍需保留，以便 ACME 自动验证。证书与 ACME 私钥保存在 `/etc/letsencrypt`，不会写入源码。

```bash
sudo systemctl list-timers partsbox-certbot-renew.timer
sudo /opt/partsbox-certbot/bin/certbot renew --dry-run
```

## 端口

| TCP 端口 | 用途 | 云防火墙 / 安全组 |
| --- | --- | --- |
| 22 | SSH 部署和维护 | 保留，建议仅允许自己的公网 IP |
| 80 | HTTP 跳转、证书验证 | 放行 |
| 443 | HTTPS 网页与智能体 API | 使用 HTTPS 时放行 |
| 8000 | FastAPI 内部服务 | 不向公网放行，仅宿主机回环 |
| 3306 / 3307 | MySQL | 不向公网放行，生产配置仅容器内连接 |

公网 API 与网页共用 HTTPS 的 443 端口，MCP 适配器不需要额外开放服务器端口。

## 运行与更新

```bash
cd ~/partsbox
sudo docker compose -f compose.yaml -f deploy/compose.production.yaml ps
sudo docker compose -f compose.yaml -f deploy/compose.production.yaml logs --tail 100 app
sudo docker compose -f compose.yaml -f deploy/compose.production.yaml logs --tail 100 mysql
sudo docker stats --no-stream
git pull --ff-only
sudo bash scripts/setup-linux.sh
```

MySQL 和应用会自动重启；数据库保存在 `partsbox_mysql_data` 卷中，正常更新不会重建该卷。生产覆盖配置限制 MySQL 内存为 640MB、应用内存为 384MB，并将 InnoDB 缓冲池调整为 128MB，适合个人库存规模。已有其他业务时应根据实际资源情况调整。

## 备份

```bash
sudo docker compose -f compose.yaml -f deploy/compose.production.yaml exec -T mysql \
  sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -u root --single-transaction --routines --triggers "$MYSQL_DATABASE"' \
  | gzip > partsbox-backup.sql.gz
```

将备份复制到服务器之外并验证可恢复。不要使用 `docker compose down -v`，该操作会删除数据库卷。

参考：[Docker Ubuntu 安装](https://docs.docker.com/engine/install/ubuntu/)、[腾讯云镜像加速](https://cloud.tencent.com/document/product/1207/45596)、[Certbot IP 证书说明](https://letsencrypt.org/2026/03/11/shorter-certs-certbot.html)。
