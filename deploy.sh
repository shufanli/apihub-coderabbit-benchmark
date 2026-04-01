#!/bin/bash
# 部署脚本：通过腾讯云 TAT 远程执行部署命令
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.env.dev"

# Convert SSH URL to HTTPS for server access
REPO_URL=$(git remote get-url origin | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||').git
BRANCH=$(git branch --show-current)
echo "Git repo: $REPO_URL, branch: $BRANCH"

# 确保代码已推送
echo "=== 推送代码到 GitHub ==="
git push origin "$BRANCH" 2>/dev/null || true

echo "=== 远程部署 ==="

DEPLOY_SCRIPT=$(cat << 'REMOTE_EOF'
#!/bin/bash
set -e

DEPLOY_DIR="/home/work/apihub-coderabbit"
REPO_URL="__REPO_URL__"
BRANCH="__BRANCH__"

# 拉取代码
if [ -d "$DEPLOY_DIR/.git" ]; then
  cd "$DEPLOY_DIR"
  git fetch origin
  git reset --hard "origin/$BRANCH"
else
  git clone "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
  git checkout "$BRANCH"
fi

cd "$DEPLOY_DIR"

# 找到主 nginx 容器使用的网络
SURVEY_NETWORK=$(docker inspect codepulse-survey-nginx-1 --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | head -1)
echo "Main nginx network: $SURVEY_NETWORK"

# 确保 docker-compose 中使用正确的外部网络名
sed -i "s/survey_default/$SURVEY_NETWORK/g" docker-compose.yml 2>/dev/null || true

if docker compose version &>/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

$COMPOSE down 2>/dev/null || true
$COMPOSE build --no-cache
$COMPOSE up -d

# 连接到主 nginx 网络（如果未自动连接）
docker network connect "$SURVEY_NETWORK" apihub-coderabbit-backend 2>/dev/null || true
docker network connect "$SURVEY_NETWORK" apihub-coderabbit-frontend 2>/dev/null || true

# 更新主 nginx 配置，添加 apihubcoderabbit 路由
NGINX_CONF="/home/work/survey/nginx.conf"
if [ -f "$NGINX_CONF" ]; then
  # 检查是否已有路由
  if ! grep -q "apihubcoderabbit" "$NGINX_CONF"; then
    echo "Adding apihubcoderabbit routes to main nginx..."
    # 在 443 server block 中最后一个 location 前添加路由
    sed -i '/location \/survey/i \
    location /apihubcoderabbit/_next/ {\
        proxy_pass http://apihub-coderabbit-frontend:3000/apihubcoderabbit/_next/;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
    }\
\
    location /apihubcoderabbit/api/ {\
        proxy_pass http://apihub-coderabbit-backend:8000/api/;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
    }\
\
    location /apihubcoderabbit/ {\
        proxy_pass http://apihub-coderabbit-frontend:3000/apihubcoderabbit/;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
    }' "$NGINX_CONF"

    # 重启 nginx
    docker exec codepulse-survey-nginx-1 nginx -s reload
    echo "Nginx reloaded with new routes"
  else
    echo "Routes already exist in nginx config"
    docker exec codepulse-survey-nginx-1 nginx -s reload
  fi
fi

echo "=== 部署完成 ==="
echo "等待服务启动..."
sleep 10

# 健康检查
curl -s http://apihub-coderabbit-backend:8000/api/health 2>/dev/null && echo " Backend OK" || curl -s http://localhost:8000/api/health 2>/dev/null && echo " Backend OK (localhost)" || echo "Backend check skipped"
echo "部署地址: https://teamocode.teamolab.com/apihubcoderabbit"
REMOTE_EOF
)

DEPLOY_SCRIPT="${DEPLOY_SCRIPT//__REPO_URL__/$REPO_URL}"
DEPLOY_SCRIPT="${DEPLOY_SCRIPT//__BRANCH__/$BRANCH}"

echo "Invoking command on instance $TENCENT_INSTANCE_ID..."
INVOCATION_ID=$($TCCLI tat RunCommand \
  --region "$TENCENT_REGION" \
  --Content "$(echo "$DEPLOY_SCRIPT" | base64)" \
  --CommandType "SHELL" \
  --InstanceIds "[\"$TENCENT_INSTANCE_ID\"]" \
  --Timeout 600 \
  --Username "root" \
  --WorkingDirectory "/root" \
  2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['InvocationId'])")

echo "Invocation ID: $INVOCATION_ID"

echo "等待远程执行..."
for i in $(seq 1 60); do
  STATUS=$($TCCLI tat DescribeInvocations \
    --region "$TENCENT_REGION" \
    --InvocationIds "[\"$INVOCATION_ID\"]" \
    2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
tasks = data['InvocationSet'][0]['InvocationTaskBasicInfoSet']
print(tasks[0].get('TaskStatus', tasks[0].get('InvocationTaskStatus', 'UNKNOWN')))
" 2>/dev/null || echo "UNKNOWN")

  echo "  [$i/60] Status: $STATUS"

  if [ "$STATUS" = "SUCCESS" ]; then
    echo "=== 部署成功！==="
    $TCCLI tat DescribeInvocationTasks \
      --region "$TENCENT_REGION" \
      --Filters "[{\"Name\":\"invocation-id\",\"Values\":[\"$INVOCATION_ID\"]}]" \
      2>/dev/null | python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
for task in data.get('InvocationTaskSet', []):
    output = base64.b64decode(task.get('TaskResult', {}).get('Output', '')).decode('utf-8', errors='replace')
    print(output)
" 2>/dev/null || true
    break
  elif [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "TIMEOUT" ]; then
    echo "=== 部署失败: $STATUS ==="
    $TCCLI tat DescribeInvocationTasks \
      --region "$TENCENT_REGION" \
      --Filters "[{\"Name\":\"invocation-id\",\"Values\":[\"$INVOCATION_ID\"]}]" \
      2>/dev/null | python3 -c "
import sys, json, base64
data = json.load(sys.stdin)
for task in data.get('InvocationTaskSet', []):
    output = base64.b64decode(task.get('TaskResult', {}).get('Output', '')).decode('utf-8', errors='replace')
    err = base64.b64decode(task.get('TaskResult', {}).get('Error', '')).decode('utf-8', errors='replace')
    print('STDOUT:', output)
    print('STDERR:', err)
" 2>/dev/null || true
    exit 1
  fi

  sleep 10
done

echo ""
echo "部署地址: https://teamocode.teamolab.com/apihubcoderabbit"
