#!/usr/bin/env bash

# ============================================================================
# JavaScript/TypeScript SDK Generator
# ============================================================================
# This script generates a TypeScript client from the OpenAPI spec using
# openapi-typescript-codegen (no Java required).
# It extracts the version from openapi.yaml and updates package.json,
# then generates the client code into the src/ directory.
# ============================================================================

set -euo pipefail

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OPENAPI_SPEC="${REPO_ROOT}/openapi.yaml"
CLIENT_DIR="${REPO_ROOT}/packages/shared/js-client"
PACKAGE_JSON="${CLIENT_DIR}/package.json"
SRC_DIR="${CLIENT_DIR}/src"

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
    
    if ! command -v npx &> /dev/null; then
        log_error "npx is not installed. Please install Node.js and npm."
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

# Update package.json version
update_package_version() {
    local version="$1"
    
    log_info "Updating package.json version to ${version}..."
    
    if [[ ! -f "${PACKAGE_JSON}" ]]; then
        log_error "package.json not found at ${PACKAGE_JSON}"
        exit 1
    fi
    
    # Use node to update the version (cross-platform)
    node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('${PACKAGE_JSON}', 'utf8')); pkg.version = '${version}'; fs.writeFileSync('${PACKAGE_JSON}', JSON.stringify(pkg, null, 2) + '\n');"
    
    log_info "Updated package.json version"
}

# Generate TypeScript client
generate_client() {
    log_info "Generating TypeScript client..."
    
    # Clean up previous generated files
    if [[ -d "${SRC_DIR}" ]]; then
        log_info "Cleaning up previous src files..."
        rm -rf "${SRC_DIR}"
    fi
    
    # Create src directory
    mkdir -p "${SRC_DIR}"
    
    # Generate using openapi-typescript-codegen
    log_info "Running openapi-typescript-codegen..."
    
    cd "${CLIENT_DIR}"
    npx openapi-typescript-codegen \
        --input "${OPENAPI_SPEC}" \
        --output "${SRC_DIR}" \
        --client axios \
        --name AsyncAgentClient \
        --useOptions \
        --useUnionTypes \
        --exportCore true \
        --exportServices true \
        --exportModels true \
        --exportSchemas false
    
    log_info "Client generation complete"
}

# Main execution
main() {
    log_info "Starting JavaScript/TypeScript SDK generation..."
    
    check_dependencies
    
    log_info "Extracting version from OpenAPI spec..."
    local VERSION=$(extract_version)
    log_info "Extracted version: ${VERSION}"
    
    update_package_version "${VERSION}"
    
    generate_client
    
    log_info "✅ JavaScript/TypeScript SDK generated successfully!"
    log_info "Location: ${SRC_DIR}"
}

# Run main function
main "$@"
