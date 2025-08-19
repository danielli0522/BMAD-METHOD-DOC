#!/bin/bash

# AI-Agile-DAP 集成测试脚本
# Sprint 2 自动化测试框架

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试配置
BASE_URL="http://localhost:8000"
AI_ENGINE_URL="http://localhost:8002"
FRONTEND_URL="http://localhost:3000"

echo -e "${BLUE}🚀 AI-Agile-DAP 集成测试开始${NC}"
echo "=================================================="

# 全局变量
AUTH_TOKEN=""
TEST_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

# 测试结果记录函数
record_test() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    TEST_COUNT=$((TEST_COUNT + 1))
    
    if [ "$result" = "PASS" ]; then
        PASS_COUNT=$((PASS_COUNT + 1))
        echo -e "${GREEN}✅ $test_name: PASS${NC} $message"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo -e "${RED}❌ $test_name: FAIL${NC} $message"
    fi
}

# HTTP 请求函数
make_request() {
    local method="$1"
    local url="$2"
    local data="$3"
    local headers="$4"
    
    if [ -n "$headers" ]; then
        curl -s -X "$method" "$url" -H "Content-Type: application/json" -H "$headers" -d "$data"
    else
        curl -s -X "$method" "$url" -H "Content-Type: application/json" -d "$data"
    fi
}

# 1. 服务健康检查
echo -e "${YELLOW}📊 1. 服务健康检查${NC}"

# 后端服务检查
backend_health=$(curl -s "$BASE_URL/health" | jq -r '.status // "error"')
if [ "$backend_health" = "healthy" ]; then
    record_test "后端服务健康检查" "PASS" "($BASE_URL)"
else
    record_test "后端服务健康检查" "FAIL" "服务不可用"
    exit 1
fi

# AI引擎服务检查  
ai_health=$(curl -s "$AI_ENGINE_URL/health" | jq -r '.status // "error"')
if [ "$ai_health" = "healthy" ]; then
    record_test "AI引擎服务健康检查" "PASS" "($AI_ENGINE_URL)"
else
    record_test "AI引擎服务健康检查" "FAIL" "服务不可用"
    exit 1
fi

# 前端服务检查
frontend_status=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/simple-index.html")
if [ "$frontend_status" = "200" ]; then
    record_test "前端服务健康检查" "PASS" "($FRONTEND_URL)"
else
    record_test "前端服务健康检查" "FAIL" "服务不可用"
fi

# 2. 用户认证测试
echo -e "${YELLOW}🔐 2. 用户认证测试${NC}"

# 登录测试
login_response=$(make_request "POST" "$BASE_URL/api/auth/login" '{"username":"demo","password":"123456"}')
login_success=$(echo "$login_response" | jq -r '.success // false')

if [ "$login_success" = "true" ]; then
    AUTH_TOKEN=$(echo "$login_response" | jq -r '.data.token')
    record_test "用户登录" "PASS" "Token获取成功"
else
    record_test "用户登录" "FAIL" "登录失败"
    exit 1
fi

# 获取用户信息测试
profile_response=$(make_request "GET" "$BASE_URL/api/auth/profile" "" "Authorization: Bearer $AUTH_TOKEN")
profile_success=$(echo "$profile_response" | jq -r '.success // false')

if [ "$profile_success" = "true" ]; then
    username=$(echo "$profile_response" | jq -r '.data.username')
    record_test "获取用户信息" "PASS" "用户: $username"
else
    record_test "获取用户信息" "FAIL" "认证失败"
fi

# 3. AI查询功能测试
echo -e "${YELLOW}🤖 3. AI查询功能测试${NC}"

# 测试查询类型
test_queries=(
    "显示销售趋势|trend"
    "各部门对比分析|comparison" 
    "TOP10产品排名|ranking"
    "统计总销售额|statistics"
    "地区销售占比|proportion"
)

for query_info in "${test_queries[@]}"; do
    IFS='|' read -r query expected_type <<< "$query_info"
    
    # 发送查询请求
    query_response=$(make_request "POST" "$BASE_URL/api/queries" "{\"naturalQuery\":\"$query\",\"database\":\"default\"}")
    query_success=$(echo "$query_response" | jq -r '.success // false')
    
    if [ "$query_success" = "true" ]; then
        actual_type=$(echo "$query_response" | jq -r '.data.query.queryType')
        processing_time=$(echo "$query_response" | jq -r '.data.query.processingTime')
        confidence=$(echo "$query_response" | jq -r '.data.query.result.confidence')
        
        # 检查查询类型是否正确
        if echo "$actual_type" | grep -q "$expected_type"; then
            record_test "查询处理: $query" "PASS" "类型:$actual_type, 耗时:${processing_time}ms, 置信度:$confidence"
        else
            record_test "查询处理: $query" "FAIL" "期望类型:$expected_type, 实际类型:$actual_type"
        fi
    else
        error_msg=$(echo "$query_response" | jq -r '.message // "未知错误"')
        record_test "查询处理: $query" "FAIL" "$error_msg"
    fi
    
    sleep 1  # 避免请求过于频繁
done

# 4. 查询历史测试
echo -e "${YELLOW}📊 4. 查询历史测试${NC}"

history_response=$(make_request "GET" "$BASE_URL/api/queries/history" "" "Authorization: Bearer $AUTH_TOKEN")
history_success=$(echo "$history_response" | jq -r '.success // false')

if [ "$history_success" = "true" ]; then
    history_count=$(echo "$history_response" | jq -r '.data | length')
    record_test "查询历史获取" "PASS" "历史记录数: $history_count"
else
    record_test "查询历史获取" "FAIL" "无法获取历史记录"
fi

# 5. 性能基准测试
echo -e "${YELLOW}⚡ 5. 性能基准测试${NC}"

# 并发查询测试
echo "执行并发查询测试..."
start_time=$(date +%s)
for i in {1..5}; do
    make_request "POST" "$BASE_URL/api/queries" '{"naturalQuery":"测试查询'$i'","database":"default"}' &
done
wait

end_time=$(date +%s)
total_time=$((end_time - start_time))

if [ $total_time -le 10 ]; then
    record_test "并发查询性能" "PASS" "5个查询耗时: ${total_time}秒"
else
    record_test "并发查询性能" "FAIL" "5个查询耗时过长: ${total_time}秒"
fi

# 6. API文档验证
echo -e "${YELLOW}📚 6. API文档验证${NC}"

docs_response=$(curl -s "$BASE_URL/api/docs")
docs_title=$(echo "$docs_response" | jq -r '.title // "error"')

if echo "$docs_title" | grep -q "AI-Agile-DAP"; then
    record_test "API文档访问" "PASS" "文档可用"
else
    record_test "API文档访问" "FAIL" "文档不可用"
fi

# 7. 错误处理测试
echo -e "${YELLOW}🚨 7. 错误处理测试${NC}"

# 测试无效查询
invalid_response=$(make_request "POST" "$BASE_URL/api/queries" '{"naturalQuery":"","database":"default"}')
invalid_success=$(echo "$invalid_response" | jq -r '.success // true')

if [ "$invalid_success" = "false" ]; then
    record_test "空查询错误处理" "PASS" "正确拒绝空查询"
else
    record_test "空查询错误处理" "FAIL" "未正确处理空查询"
fi

# 测试无效认证
unauth_response=$(make_request "GET" "$BASE_URL/api/queries/history" "" "Authorization: Bearer invalid_token")
unauth_success=$(echo "$unauth_response" | jq -r '.success // true')

if [ "$unauth_success" = "false" ]; then
    record_test "无效Token处理" "PASS" "正确拒绝无效Token"
else
    record_test "无效Token处理" "FAIL" "未正确处理无效Token"
fi

# 测试结果汇总
echo ""
echo "=================================================="
echo -e "${BLUE}📊 测试结果汇总${NC}"
echo "=================================================="
echo -e "总测试数: ${BLUE}$TEST_COUNT${NC}"
echo -e "通过: ${GREEN}$PASS_COUNT${NC}"
echo -e "失败: ${RED}$FAIL_COUNT${NC}"
echo -e "通过率: ${YELLOW}$(( PASS_COUNT * 100 / TEST_COUNT ))%${NC}"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！系统运行正常${NC}"
    exit 0
else
    echo -e "${RED}⚠️  有 $FAIL_COUNT 个测试失败，请检查系统状态${NC}"
    exit 1
fi