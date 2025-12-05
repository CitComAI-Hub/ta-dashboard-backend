## Automated publish via GitHub Actions

- Workflow: `.github/workflows/publish.yaml`
- Trigger: `push` to `main`, pushing a tag matching `v*`, or manual `workflow_dispatch`
- Result: builds the Docker image and pushes it to `ghcr.io/citcomai-hub/ta-dashboard-backend` with tags generated from the branch (e.g., `main`), git tag (e.g., `v1.2.0`), `latest` (only for `main`) and the commit SHA. No manual credentials are required because the workflow uses `GITHUB_TOKEN` with `packages: write`.

### Versioned releases

1. Update the code you want to release and merge to `main`.
2. Create and push a tag following `v<major>.<minor>.<patch>` (example `git tag v1.2.0 && git push origin v1.2.0`).
3. The GitHub Actions workflow will publish an image tagged `v1.2.0` alongside the usual `latest`/SHA tags.

## Manual build/push (fallback)

1. Authenticate once (needs a PAT with `write:packages` scope):
	```bash
	echo $GITHUB_TOKEN | docker login ghcr.io -u CitComAI-Hub --password-stdin
	```
2. Build locally:
	```bash
	docker build -t auth-backend:latest .
	```
3. Tag for GitHub Packages (repo `CitComAI-Hub/ta-dashboard-backend`):
	```bash
	docker tag auth-backend:latest ghcr.io/citcomai-hub/ta-dashboard-backend:latest
	```
4. Push the image:
	```bash
	docker push ghcr.io/citcomai-hub/ta-dashboard-backend:latest
	```