# SDK Generation Guide

This repository uses `openapi.yaml` as the **single source of truth** for generating client SDKs.

## Overview

Two SDKs are automatically generated from the OpenAPI specification:

1. **JavaScript/TypeScript SDK** (`packages/shared/js-client`)
   - Uses `openapi-generator-cli` with TypeScript-Axios template
   - Compiles to CommonJS for Node.js compatibility

2. **Python SDK** (`packages/shared/python-client`)
   - Uses `openapi-python-client`
   - Supports Python 3.8+

Both SDKs are part of the pnpm workspace and their versions are automatically synchronized with `openapi.yaml`.

## Prerequisites

### For JavaScript/TypeScript SDK

- Node.js >= 18.0.0
- pnpm >= 8.0.0

**No Java required!** Uses `openapi-typescript-codegen` which is pure JavaScript/TypeScript.

### For Python SDK

- Python >= 3.8
- pip or pipx

**Install openapi-python-client:**
```bash
pip install openapi-python-client
# or
pipx install openapi-python-client
```

## Quick Start

### Generate All SDKs

```bash
# Generate both JavaScript and Python clients
pnpm generate
```

This single command:
1. Extracts the version from `openapi.yaml`
2. Updates version in `package.json` and `setup.py`
3. Generates TypeScript-Axios client into `packages/shared/js-client/src/`
4. Generates Python client into `packages/shared/python-client/async_agent_client/`

### Generate Individual SDKs

```bash
# JavaScript/TypeScript only
pnpm --filter @async-agent/api-js-client run generate

# Python only
pnpm --filter @async-agent/api-py-client run generate
```

### Build the SDKs

```bash
# Build JavaScript SDK
pnpm --filter @async-agent/api-js-client run build

# Build all packages
pnpm build
```

### Test Idempotency

To verify that generation is idempotent (running twice produces no changes):

```bash
pnpm test:check-generate
```

This will:
1. Generate both SDKs
2. Check if any files were modified using `git diff --exit-code`
3. Exit with code 0 if no changes, or non-zero if there are differences

## Project Structure

```
asyncAgent/
├── openapi.yaml                          # Single source of truth
├── scripts/
│   ├── generate-js-client.sh            # JavaScript SDK generator
│   └── generate-python-client.sh        # Python SDK generator
├── packages/
│   └── shared/
│       ├── js-client/
│       │   ├── src/                     # Generated TypeScript code
│       │   ├── dist/                    # Compiled JavaScript
│       │   ├── package.json
│       │   └── tsconfig.json
│       └── python-client/
│           ├── async_agent_client/      # Generated Python package
│           ├── setup.py
│           └── README.md
└── package.json                         # Root workspace config
```

## How It Works

### Version Synchronization

1. The generator scripts extract `info.version` from `openapi.yaml`
2. This version is written to:
   - `packages/shared/js-client/package.json`
   - `packages/shared/python-client/setup.py`

### JavaScript/TypeScript Generation

The script `scripts/generate-js-client.sh`:
1. Validates dependencies (Node.js, npm/npx)
2. Extracts version using Node.js YAML parser
3. Updates `package.json` version
4. Runs `openapi-typescript-codegen` to generate TypeScript client
5. Generates directly into `src/` directory

**Generator options:**
- Generator: `openapi-typescript-codegen`
- Client: `axios`
- Output: `packages/shared/js-client/src/`
- Client name: `AsyncAgentClient`
- Uses options pattern and union types
- Exports: core, services, models

### Python Generation

The script `scripts/generate-python-client.sh`:
1. Validates dependencies (Node.js, openapi-python-client)
2. Extracts version using Node.js YAML parser
3. Updates `setup.py` VERSION constant
4. Runs `openapi-python-client generate`
5. Generates into `async_agent_client/` directory

**Generator options:**
- Config: `.openapi-python-client.yaml`
- Package name: `async_agent_client`
- Meta: none (no extra files)

## Updating the API

1. **Edit `openapi.yaml`**
   - Update endpoints, schemas, or version
   - Validate the spec (optional but recommended)

2. **Regenerate SDKs**
   ```bash
   pnpm generate
   ```

3. **Rebuild**
   ```bash
   pnpm build
   ```

4. **Commit changes**
   ```bash
   git add openapi.yaml packages/shared/
   git commit -m "Update API spec and regenerate SDKs"
   ```

## CI/CD Integration

Add this to your CI pipeline to ensure SDKs are always up to date:

```yaml
# Example GitHub Actions
- name: Check SDK Generation
  run: pnpm test:check-generate
```

This will fail the build if:
- Someone updated `openapi.yaml` without regenerating SDKs
- Manual changes were made to generated code

## Customization

### JavaScript/TypeScript

Edit `scripts/generate-js-client.sh` to modify:
- Generator options (line with `npx openapi-typescript-codegen`)
- Client library (axios, fetch, xhr, node)
- Output directory structure
- Post-processing steps

### Python

Edit `scripts/generate-python-client.sh` or `.openapi-python-client.yaml` to modify:
- Package naming
- Generator behavior
- Post-processing

## Troubleshooting

### openapi-python-client not found (Python SDK)

```
ERROR: openapi-python-client is not installed
```

**Solution:**
```bash
pip install openapi-python-client
```

### Permission denied

```
Permission denied: ./scripts/generate-js-client.sh
```

**Solution:**
```bash
chmod +x scripts/*.sh
```

### Version extraction fails

If you see "Failed to extract version from OpenAPI spec":
- Ensure `openapi.yaml` has a valid `info.version` field
- Check that the YAML is properly formatted
- Verify Node.js and `yaml` package are installed

## Publishing SDKs

### JavaScript/TypeScript

```bash
cd packages/shared/js-client
pnpm build
npm publish
```

### Python

```bash
cd packages/shared/python-client
python setup.py sdist bdist_wheel
twine upload dist/*
```

## Development Workflow

1. **Make API changes** in `openapi.yaml`
2. **Increment version** in `openapi.yaml` (e.g., `0.1.0` → `0.2.0`)
3. **Generate SDKs**: `pnpm generate`
4. **Build**: `pnpm build`
5. **Test**: Write and run tests against the new SDK
6. **Commit**: Commit spec and generated code together
7. **Publish**: Publish SDKs to npm/PyPI

## Notes

- **Do not manually edit generated code** - changes will be lost on next generation
- **Commit generated code** - This makes it easy to review API changes in PRs
- **Version consistency** - SDK versions always match `openapi.yaml` version
- **Idempotency** - Running generation twice produces identical output
