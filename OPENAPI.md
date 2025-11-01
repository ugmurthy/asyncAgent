> **Goal:**  
> Treat `openapi.yaml` at the root of the repository as _the single source of truth_ for the API.  
> Using that file, generate:
>
> 1. A JavaScript/TypeScript SDK in `packages/shared/js-client`.
> 2. A Python SDK in `packages/shared/python-client`.  
>    Both SDKs must live under the `packages/shared` folder so they are part of the pnpm workspace.

**What you need to do:**

1. **Create a reusable generator script**

   - File: `scripts/generate.sh`
   - Bash script that:
     - Reads `openapi.yaml` at the repo root.
     - Extracts `info.version` from the spec (you can use `yq`).
     - Updates the version in `packages/shared/js-client/package.json` and in `packages/shared/python-client/setup.py`.
     - Calls `openapi-generator-cli` to produce a **TypeScript‑Axios** client into `packages/shared/js-client/generated`, then moves the generated files into `packages/shared/js-client/src`.
     - Calls `openapi-python-client` to generate the Python client into `packages/shared/python-client/src`.
     - Ensures the script exits with `0` if everything succeeded, otherwise with a non‑zero status.

2. **Add npm scripts to the workspace**

   - Root `package.json`
     ```json
     "scripts": {
       "generate": "pnpm --filter @async-agent/api-js-client run generate && pnpm --filter @async-agent/api-py-client run generate",
       "test:check-generate": "pnpm generate && pnpm --filter @async-agent/api-js-client run test:check-generate && pnpm --filter @async-agent/api-py-client run test:check-generate"
     }
     ```
   - `packages/shared/js-client/package.json`
     ```json
     "scripts": {
       "generate": "bash ../../../scripts/generate.sh",
       "test:check-generate": "npm run generate && git diff --exit-code"
     }
     ```
   - `packages/shared/python-client/package.json` (or `package.json` wrapper)
     ```json
     "scripts": {
       "generate": "openapi-python-client generate --path ../../../../openapi.yaml --output src",
       "test:check-generate": "npm run generate && git diff --exit-code"
     }
     ```

3. **Make the generator idempotent** – running it twice without a spec change should produce _no_ differences in the generated folders.

**Deliverables**

- `scripts/generate.sh` (fully commented).
- Updated `package.json` files for the root and both SDK packages.

**Constraints**

- Do **not** use Speccy or Spectral.
- Use `openapi-generator-cli` for JS/TS and `openapi-python-client` for Python.
- The generated SDKs must stay under `packages/shared/*`.
- Ensure the SDKs are ready to build (e.g., `tsc` compiles the JS/TS SDK, `pytest` can run the Python tests).

> **When you’re done, the repo should support a single command (`pnpm generate`) that pulls the latest spec, bumps the SDK versions, and writes the updated SDK code into the correct workspace folders.**
