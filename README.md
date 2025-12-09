## Automated publish via GitHub Actions

- Workflow: `.github/workflows/publish.yaml`
- Trigger: `push` to `main`, pushing a tag matching `v*`, or manual `workflow_dispatch`
- Result: builds the Docker image and pushes it to `ghcr.io/citcomai-hub/ta-dashboard-backend` with tags generated from the branch (e.g., `main`), git tag (e.g., `v1.2.0`), `latest` (only for `main`) and the commit SHA. No manual credentials are required because the workflow uses `GITHUB_TOKEN` with `packages: write`.

## Runtime configuration

Set the following environment variables (the service refuses to start if any required entry is missing):

| Variable | Required | Description |
| --- | --- | --- |
| `JWT_SECRET` | ✅ | Secret used to sign/verify JWT tokens. Keep it in a secret store (Kubernetes Secret, GitHub Actions secret, etc.). |
| `AUTH_USER` | ✅ | Username for the single admin account. |
| `AUTH_PASS_HASH` | ✅ | Bcrypt hash of the admin password (generate via `npx bcrypt-cli 'my-pass'`). Supplying `AUTH_PASS` is still accepted, but the server will hash it at startup and emit a warning—prefer storing only the hash. |
| `TIR_BASE_URL` | ✅ | Base URL of the Trusted Issuer Registry service (e.g., `http://trusted-issuer-list:8080`). |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated list of origins allowed to call this API via browsers (e.g., `https://auth.example.com,https://app.example.com`). |
| `FETCH_TIMEOUT_MS` | optional (default `5000`) | Timeout applied to proxied requests heading to `TIR_BASE_URL`. |
| `JSON_BODY_LIMIT` | optional (default `1mb`) | Maximum accepted JSON payload size. |
| `RATE_LIMIT_WINDOW_MS` | optional (default `900000`) | Rate-limit window in milliseconds. |
| `RATE_LIMIT_MAX` | optional (default `200`) | Max requests per IP per window. |

### Kubernetes secrets
Generate hashed password: run `npx bcrypt-cli 'your-new-password'` (or any bcrypt tool) and copy the hash. Keep plaintext somewhere safe only until you update secrets. The deployment expects a secret named `auth-backend-secret` containing the sensitive values:

```bash
kubectl create secret generic auth-backend-secret \
  --from-literal=AUTH_USER=admin \
  --from-literal=AUTH_PASS_HASH='<bcrypt-hash>' \
  --from-literal=JWT_SECRET='<strong-random-secret>'
```

Mounting the secret keeps credentials out of `k8s-auth-backend.yaml`. Update the literal values above (and never commit real secrets to git).

### Versioned releases

1. Update the code you want to release and merge to `main`.
2. Create and push a tag following `v<major>.<minor>.<patch>` (example `git tag v1.2.0 && git push origin v1.2.0`).
3. The GitHub Actions workflow will publish an image tagged `v1.2.0` alongside the usual `latest`/SHA tags.