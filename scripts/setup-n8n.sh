#!/bin/bash
set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Project paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.local"

# Print helper
print_msg() {
  local type=$1
  local msg=$2
  case $type in
    success) echo -e "${GREEN}✓${NC} $msg" ;;
    error) echo -e "${RED}❌${NC} $msg" ;;
    info) echo -e "${BLUE}ℹ${NC} $msg" ;;
  esac
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Validate password requirements
validate_password() {
  local pwd=$1
  [[ ${#pwd} -ge 8 ]] && [[ $pwd =~ [A-Z] ]] && [[ $pwd =~ [0-9] ]]
}

echo -e "${BLUE}ℹ${NC} Setting up n8n for your project..."
echo ""

# Step 1: Check prerequisites
print_msg info "Checking prerequisites..."
MISSING=0

for cmd in docker openssl jq; do
  if command_exists $cmd; then
    print_msg success "$cmd is installed"
  else
    print_msg error "$cmd is not installed"
    MISSING=1
  fi
done

if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
  print_msg success "Docker Compose is installed"
  DOCKER_COMPOSE_CMD=$(command_exists docker-compose && echo "docker-compose" || echo "docker compose")
else
  print_msg error "Docker Compose is not installed"
  MISSING=1
fi

[[ $MISSING -eq 1 ]] && { print_msg error "Please install missing tools and try again."; exit 1; }
echo ""

# Step 2: Handle existing configuration
if [ -f "$ENV_FILE" ] && grep -q "N8N_ENCRYPTION_KEY" "$ENV_FILE" 2>/dev/null; then
  print_msg info "Existing n8n configuration found"
  read -p "Overwrite existing configuration? (y/N): " -r
  echo ""

  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_msg info "Keeping existing configuration. Exiting..."
    exit 0
  fi

  # Stop and remove n8n container and volumes to prevent encryption key mismatch
  print_msg info "Stopping n8n and removing old data..."
  cd "$PROJECT_ROOT"
  if [ -f "docker-compose.yml" ]; then
    $DOCKER_COMPOSE_CMD down -v 2>/dev/null || true
  fi

  # Remove n8n data directory to start fresh
  rm -rf ~/.n8n 2>/dev/null || true
  print_msg success "Removed old n8n data"

  # Backup and clean env file
  cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
  sed -i.tmp '/^# n8n Configuration$/,/^$/d' "$ENV_FILE"
  rm -f "$ENV_FILE.tmp"
  print_msg success "Backed up existing configuration"
elif [ ! -f "$ENV_FILE" ]; then
  touch "$ENV_FILE"
fi

echo ""

# Step 3: Generate encryption key
print_msg info "Generating encryption key..."
N8N_ENCRYPTION_KEY=$(openssl rand -base64 32)
print_msg success "Encryption key generated"
echo ""

# Step 4: Collect credentials
echo "Enter n8n owner credentials (press Enter for defaults):"
echo ""

read -p "Email (default: admin@example.com): " N8N_OWNER_EMAIL
N8N_OWNER_EMAIL=${N8N_OWNER_EMAIL:-admin@example.com}

read -p "First Name (default: Admin): " N8N_OWNER_FIRST_NAME
N8N_OWNER_FIRST_NAME=${N8N_OWNER_FIRST_NAME:-Admin}

read -p "Last Name (default: User): " N8N_OWNER_LAST_NAME
N8N_OWNER_LAST_NAME=${N8N_OWNER_LAST_NAME:-User}

read -s -p "Password (default: Admin123): " N8N_OWNER_PASSWORD
echo ""

# Use default password if empty
if [[ -z "$N8N_OWNER_PASSWORD" ]]; then
  N8N_OWNER_PASSWORD="Admin123"
  print_msg info "Using default password: Admin123"
else
  # Only validate and confirm if user provided a custom password
  if ! validate_password "$N8N_OWNER_PASSWORD"; then
    print_msg error "Password must be 8+ chars with 1 uppercase and 1 number"
    exit 1
  fi

  read -s -p "Confirm password: " N8N_OWNER_PASSWORD_CONFIRM
  echo ""

  if [[ "$N8N_OWNER_PASSWORD" != "$N8N_OWNER_PASSWORD_CONFIRM" ]]; then
    print_msg error "Passwords do not match"
    exit 1
  fi
fi

echo ""

# Step 5: Write configuration
print_msg info "Writing configuration..."

cat >> "$ENV_FILE" << EOF

# n8n Configuration
N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION_KEY
GENERIC_TIMEZONE=America/New_York
N8N_HOST=localhost
N8N_PORT=5678
N8N_PROTOCOL=http

# Skip welcome modal and onboarding
N8N_PERSONALIZATION_ENABLED=false
N8N_DIAGNOSTICS_ENABLED=false

# Owner Account (for initial setup)
N8N_OWNER_EMAIL=$N8N_OWNER_EMAIL
N8N_OWNER_FIRST_NAME=$N8N_OWNER_FIRST_NAME
N8N_OWNER_LAST_NAME=$N8N_OWNER_LAST_NAME
N8N_OWNER_PASSWORD=$N8N_OWNER_PASSWORD

EOF

print_msg success "Configuration saved"
echo ""

# Step 6: Start Docker
print_msg info "Starting n8n with Docker Compose..."

cd "$PROJECT_ROOT"

if [ ! -f "docker-compose.yml" ]; then
  print_msg error "docker-compose.yml not found"
  exit 1
fi

$DOCKER_COMPOSE_CMD up -d || { print_msg error "Failed to start Docker Compose"; exit 1; }
print_msg success "Docker Compose started"
echo ""

# Step 7: Wait for n8n using Docker healthcheck
print_msg info "Waiting for n8n to be ready..."

for i in {1..30}; do
  if docker inspect -f '{{.State.Health.Status}}' n8n 2>/dev/null | grep -q "healthy"; then
    print_msg success "n8n is ready!"
    break
  fi

  if [ $i -eq 30 ]; then
    print_msg error "n8n health check timeout"
    print_msg info "Check logs: $DOCKER_COMPOSE_CMD logs n8n"
    exit 1
  fi

  sleep 2
done

echo ""

# Step 8: Create owner account
print_msg info "Creating owner account..."

# Save response to temp file to avoid head/tail issues
TEMP_RESPONSE=$(mktemp)
curl -s -w "\n%{http_code}" -X POST "http://localhost:5678/rest/owner/setup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$N8N_OWNER_EMAIL\",
    \"firstName\": \"$N8N_OWNER_FIRST_NAME\",
    \"lastName\": \"$N8N_OWNER_LAST_NAME\",
    \"password\": \"$N8N_OWNER_PASSWORD\"
  }" > "$TEMP_RESPONSE"

HTTP_CODE=$(tail -n1 "$TEMP_RESPONSE")
RESPONSE_BODY=$(sed '$d' "$TEMP_RESPONSE")

rm -f "$TEMP_RESPONSE"

if [[ "$HTTP_CODE" == "200" ]]; then
  print_msg success "Owner account created!"
elif echo "$RESPONSE_BODY" | grep -q "owner already exists\|Instance owner already setup"; then
  print_msg info "Owner account already exists"
else
  print_msg error "Failed to create owner account (HTTP $HTTP_CODE)"
  print_msg error "Response: $RESPONSE_BODY"
  print_msg info "You can set up manually at http://localhost:5678"
fi

echo ""

# Step 9: Log in to get authentication cookie
print_msg info "Authenticating with n8n..."

TEMP_LOGIN=$(mktemp)
TEMP_COOKIE=$(mktemp)

curl -s -w "\n%{http_code}" -c "$TEMP_COOKIE" -X POST "http://localhost:5678/rest/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"emailOrLdapLoginId\": \"$N8N_OWNER_EMAIL\",
    \"password\": \"$N8N_OWNER_PASSWORD\"
  }" > "$TEMP_LOGIN"

LOGIN_HTTP_CODE=$(tail -n1 "$TEMP_LOGIN")
LOGIN_RESPONSE=$(sed '$d' "$TEMP_LOGIN")

rm -f "$TEMP_LOGIN"

if [[ "$LOGIN_HTTP_CODE" == "200" ]]; then
  print_msg success "Authentication successful!"
else
  print_msg error "Failed to authenticate (HTTP $LOGIN_HTTP_CODE)"
  print_msg error "Response: $LOGIN_RESPONSE"
  rm -f "$TEMP_COOKIE"
  print_msg info "You can create an API key manually at http://localhost:5678"
  exit 1
fi

echo ""

# Step 10: Create API key
print_msg info "Creating API key..."

# Check if API key already exists in .env.local
if grep -q "^N8N_API_KEY=" "$ENV_FILE" 2>/dev/null; then
  EXISTING_KEY=$(grep "^N8N_API_KEY=" "$ENV_FILE" | cut -d'=' -f2)
  if [[ -n "$EXISTING_KEY" ]]; then
    print_msg info "API key already exists in .env.local, skipping creation"
    rm -f "$TEMP_COOKIE"
  else
    # Empty key, remove it and create new one
    sed -i.tmp '/^N8N_API_KEY=/d' "$ENV_FILE"
    rm -f "$ENV_FILE.tmp"
  fi
fi

# Only create API key if not already set
if ! grep -q "^N8N_API_KEY=.\\+" "$ENV_FILE" 2>/dev/null; then
  TEMP_API_KEY=$(mktemp)

  curl -s -w "\n%{http_code}" -b "$TEMP_COOKIE" -X POST "http://localhost:5678/rest/api-keys" \
    -H "Content-Type: application/json" \
    -d "{
      \"label\": \"Next8n Starter API Key\",
      \"expiresAt\": null,
      \"scopes\": [
        \"workflow:read\",
        \"workflow:create\",
        \"workflow:update\",
        \"workflow:delete\",
        \"workflow:activate\"
      ]
    }" > "$TEMP_API_KEY"

  API_KEY_HTTP_CODE=$(tail -n1 "$TEMP_API_KEY")
  API_KEY_RESPONSE=$(sed '$d' "$TEMP_API_KEY")

  rm -f "$TEMP_COOKIE"

  if [[ "$API_KEY_HTTP_CODE" == "200" ]] || [[ "$API_KEY_HTTP_CODE" == "201" ]]; then
    # Extract API key from JSON response using jq
    # n8n returns the actual key in data.rawApiKey (data.apiKey is masked)
    N8N_API_KEY=$(echo "$API_KEY_RESPONSE" | jq -r '.data.rawApiKey // .rawApiKey // .apiKey // .data.apiKey // empty')

    if [[ -n "$N8N_API_KEY" ]] && [[ "$N8N_API_KEY" != "null" ]]; then
      print_msg success "API key created!"

      # Add API key to .env.local
      echo "N8N_API_KEY=$N8N_API_KEY" >> "$ENV_FILE"

      # Add feature flags
      echo "NEXT_PUBLIC_N8N_STATUS_BADGE_ENABLED=true" >> "$ENV_FILE"
      echo "N8N_API_TIMEOUT=10000" >> "$ENV_FILE"
      echo "" >> "$ENV_FILE"

      print_msg success "API key added to .env.local"
    else
      print_msg error "Failed to extract API key from response"
      print_msg info "Response: $API_KEY_RESPONSE"
      print_msg info "You can create an API key manually at http://localhost:5678"
      exit 1
    fi
  else
    print_msg error "Failed to create API key (HTTP $API_KEY_HTTP_CODE)"
    print_msg info "Response: $API_KEY_RESPONSE"
    print_msg info "You can create an API key manually at http://localhost:5678"
    exit 1
  fi

  rm -f "$TEMP_API_KEY"
fi

echo ""

# Step 11: Validate API key was written
print_msg info "Validating configuration..."

if grep -q "^N8N_API_KEY=.\\+" "$ENV_FILE" 2>/dev/null; then
  print_msg success "API key successfully configured"
else
  print_msg error "API key not found in .env.local"
  print_msg info "You can create an API key manually at http://localhost:5678"
  exit 1
fi

echo ""

# Step 12: Success
echo "=========================================="
echo -e "${GREEN}✓ n8n Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Access: http://localhost:5678"
echo "Email: $N8N_OWNER_EMAIL"
echo ""
print_msg info "Your n8n instance is running!"
print_msg info "API key has been configured in .env.local"
echo ""
echo "Commands:"
echo "  • Logs:    $DOCKER_COMPOSE_CMD logs -f n8n"
echo "  • Stop:    $DOCKER_COMPOSE_CMD stop"
echo "  • Start:   $DOCKER_COMPOSE_CMD start"
echo "  • Restart: $DOCKER_COMPOSE_CMD restart"
echo "  • Remove:  $DOCKER_COMPOSE_CMD down"
echo ""
