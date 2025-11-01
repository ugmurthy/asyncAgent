#!/usr/bin/env bash

# ============================================================================
# Python SDK Generator
# ============================================================================
# This script generates a Python client from the OpenAPI spec.
# It extracts the version from openapi.yaml and updates setup.py,
# then generates the client code using openapi-python-client.
# ============================================================================

set -euo pipefail

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OPENAPI_SPEC="${REPO_ROOT}/openapi.yaml"
CLIENT_DIR="${REPO_ROOT}/packages/shared/python-client"
SETUP_PY="${CLIENT_DIR}/setup.py"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js."
        exit 1
    fi
    
    if ! command -v openapi-python-client &> /dev/null; then
        log_error "openapi-python-client is not installed. Install it with: pip install openapi-python-client"
        exit 1
    fi
}

# Extract version from OpenAPI spec using Node.js
extract_version() {
    if [[ ! -f "${OPENAPI_SPEC}" ]]; then
        log_error "OpenAPI spec not found at ${OPENAPI_SPEC}"
        exit 1
    fi
    
    local version=$(node -e "const fs = require('fs'); const yaml = require('yaml'); const content = fs.readFileSync('${OPENAPI_SPEC}', 'utf8'); const spec = yaml.parse(content); console.log(spec.info.version);")
    
    if [[ -z "${version}" || "${version}" == "null" || "${version}" == "undefined" ]]; then
        log_error "Failed to extract version from OpenAPI spec"
        exit 1
    fi
    
    echo "${version}"
}

# Update setup.py version
update_setup_version() {
    local version=$1
    
    log_info "Updating setup.py version to ${version}..."
    
    if [[ ! -f "${SETUP_PY}" ]]; then
        log_error "setup.py not found at ${SETUP_PY}"
        exit 1
    fi
    
    # Update VERSION in setup.py
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/VERSION = \".*\"/VERSION = \"${version}\"/" "${SETUP_PY}"
    else
        # Linux
        sed -i "s/VERSION = \".*\"/VERSION = \"${version}\"/" "${SETUP_PY}"
    fi
    
    log_info "Updated setup.py version"
}

# Generate Python client
generate_client() {
    log_info "Generating Python client..."
    
    # Clean up previous generated files
    if [[ -d "${CLIENT_DIR}/async_agent_client" ]]; then
        log_info "Cleaning up previous generated files..."
        rm -rf "${CLIENT_DIR}/async_agent_client"
    fi
    
    # Generate using openapi-python-client
    log_info "Running openapi-python-client..."
    
    cd "${CLIENT_DIR}"
    openapi-python-client generate \
        --path "${OPENAPI_SPEC}" \
        --config .openapi-python-client.yaml \
        --meta none
    
    log_info "Client generation complete"
}

# Main execution
main() {
    log_info "Starting Python SDK generation..."
    
    check_dependencies
    
    log_info "Extracting version from OpenAPI spec..."
    local VERSION=$(extract_version)
    log_info "Extracted version: ${VERSION}"
    
    update_setup_version "${VERSION}"
    
    generate_client
    
    log_info "✅ Python SDK generated successfully!"
    log_info "Location: ${CLIENT_DIR}/async_agent_client"
}

# Run main function
main "$@"
