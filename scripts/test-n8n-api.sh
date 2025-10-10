#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Project paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.local"
BASE_URL="http://localhost:3000"

# Print helper
print_msg() {
  local type=$1
  local msg=$2
  case $type in
    success) echo -e "${GREEN}✓${NC} $msg" ;;
    error) echo -e "${RED}❌${NC} $msg" ;;
    info) echo -e "${BLUE}ℹ${NC} $msg" ;;
    warning) echo -e "${YELLOW}⚠${NC} $msg" ;;
  esac
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

echo -e "${BLUE}🧪 Testing n8n API Integration${NC}"
echo ""

# Prerequisite checks
print_msg info "Checking prerequisites..."

# Check if required commands are installed
for cmd in curl jq; do
  if command_exists $cmd; then
    print_msg success "$cmd is installed"
  else
    print_msg error "$cmd is not installed"
    print_msg info "Please install $cmd and try again"
    exit 1
  fi
done

# Check if .env.local exists
if [ ! -f "$ENV_FILE" ]; then
  print_msg error ".env.local file not found"
  print_msg info "Run './scripts/setup-n8n.sh' first to set up n8n"
  exit 1
fi
print_msg success ".env.local file exists"

# Check if N8N_API_KEY is set
if ! grep -q "^N8N_API_KEY=.\\+" "$ENV_FILE" 2>/dev/null; then
  print_msg error "N8N_API_KEY not found in .env.local"
  print_msg info "Run './scripts/setup-n8n.sh' to generate an API key"
  exit 1
fi
print_msg success "N8N_API_KEY is configured"

# Check if Next.js dev server is running
if ! curl -s --max-time 2 "$BASE_URL" > /dev/null 2>&1; then
  print_msg error "Next.js dev server is not running on $BASE_URL"
  print_msg info "Start the server with 'bun dev' and try again"
  exit 1
fi
print_msg success "Next.js dev server is running"

echo ""
print_msg info "Running API tests..."
echo ""

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=8

# Helper function to run test
run_test() {
  local test_num=$1
  local test_name=$2
  local response=$3

  echo ""
  echo -e "${BLUE}[$test_num/$TOTAL_TESTS]${NC} $test_name"

  # Check if response is valid JSON and doesn't contain error
  if echo "$response" | jq -e . >/dev/null 2>&1; then
    if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
      print_msg error "Test failed - API returned error"
      echo "$response" | jq .
      TESTS_FAILED=$((TESTS_FAILED + 1))
    else
      print_msg success "Test passed"
      echo "$response" | jq .
      TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
  else
    print_msg error "Test failed - Invalid JSON response"
    echo "$response"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# 1. Health Check
RESPONSE=$(curl -s "$BASE_URL/api/n8n/health")
run_test 1 "Testing health endpoint" "$RESPONSE"

# 2. List Workflows
RESPONSE=$(curl -s "$BASE_URL/api/n8n/workflows")
run_test 2 "Testing list workflows" "$RESPONSE"

# 3. List Workflows with Limit
RESPONSE=$(curl -s "$BASE_URL/api/n8n/workflows?limit=5")
run_test 3 "Testing list workflows with limit" "$RESPONSE"

# 4. Create Workflow with Webhook Trigger
RESPONSE=$(curl -s -X POST "$BASE_URL/api/n8n/workflows" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow",
    "nodes": [
      {
        "parameters": {
          "path": "test-webhook",
          "httpMethod": "GET",
          "responseMode": "onReceived",
          "options": {}
        },
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 1,
        "position": [250, 300],
        "webhookId": "test-webhook-id"
      }
    ],
    "connections": {},
    "settings": {}
  }')
run_test 4 "Testing create workflow with webhook trigger" "$RESPONSE"

WORKFLOW_ID=$(echo "$RESPONSE" | jq -r '.id // empty')
if [[ -z "$WORKFLOW_ID" ]] || [[ "$WORKFLOW_ID" == "null" ]]; then
  print_msg warning "Could not extract workflow ID, skipping remaining tests"
  TESTS_FAILED=$((TESTS_FAILED + 4))
else
  # 5. Get Workflow by ID
  RESPONSE=$(curl -s "$BASE_URL/api/n8n/workflows/$WORKFLOW_ID")
  run_test 5 "Testing get workflow by ID" "$RESPONSE"

  # 6. Update Workflow
  RESPONSE=$(curl -s -X PUT "$BASE_URL/api/n8n/workflows/$WORKFLOW_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Updated Test Workflow",
      "nodes": [
        {
          "parameters": {
            "path": "updated-test-webhook",
            "httpMethod": "POST",
            "responseMode": "onReceived",
            "options": {}
          },
          "name": "Webhook",
          "type": "n8n-nodes-base.webhook",
          "typeVersion": 1,
          "position": [250, 300],
          "webhookId": "updated-webhook-id"
        }
      ],
      "connections": {},
      "settings": {}
    }')
  run_test 6 "Testing update workflow" "$RESPONSE"

  # 7. Activate/Deactivate Workflow
  echo ""
  echo -e "${BLUE}[7/8]${NC} Testing activate workflow"
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/n8n/workflows/$WORKFLOW_ID?action=activate")

  # Check if activation succeeded
  if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
    print_msg error "Test failed - API returned error"
    echo "$RESPONSE" | jq .
    TESTS_FAILED=$((TESTS_FAILED + 1))
  else
    # Check if workflow is now active
    if echo "$RESPONSE" | jq -e '.active == true' >/dev/null 2>&1; then
      print_msg success "Workflow activated successfully"
      echo "$RESPONSE" | jq .
      TESTS_PASSED=$((TESTS_PASSED + 1))

      # Now test deactivation
      echo ""
      echo -e "${BLUE}Testing deactivate workflow${NC}"
      DEACTIVATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/n8n/workflows/$WORKFLOW_ID?action=deactivate")

      if echo "$DEACTIVATE_RESPONSE" | jq -e '.active == false' >/dev/null 2>&1; then
        print_msg success "Workflow deactivated successfully"
        echo "$DEACTIVATE_RESPONSE" | jq .
      else
        print_msg error "Deactivation failed"
        echo "$DEACTIVATE_RESPONSE" | jq .
      fi
    else
      print_msg error "Workflow not activated"
      echo "$RESPONSE" | jq .
      TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
  fi

  # 8. Delete Workflow
  RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/n8n/workflows/$WORKFLOW_ID")
  run_test 8 "Testing delete workflow" "$RESPONSE"
fi

# Final Summary
echo ""
echo "=========================================="
if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All Tests Passed!${NC}"
else
  echo -e "${RED}❌ Some Tests Failed${NC}"
fi
echo "=========================================="
echo -e "Total: $TOTAL_TESTS | ${GREEN}Passed: $TESTS_PASSED${NC} | ${RED}Failed: $TESTS_FAILED${NC}"
echo ""

# Exit with appropriate code
if [ $TESTS_FAILED -gt 0 ]; then
  exit 1
fi
