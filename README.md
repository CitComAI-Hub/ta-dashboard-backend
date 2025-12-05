## Automated publish via GitHub Actions

- Workflow: `.github/workflows/publish.yaml`
- Trigger: `push` to `main` or manual `workflow_dispatch`
- Result: builds the Docker image and pushes it to `ghcr.io/citcomai-hub/ta-dashboard-backend/auth-backend` (tags `latest` and the commit SHA). No manual credentials are required because the workflow uses `GITHUB_TOKEN` with `packages: write`.

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
	docker tag auth-backend:latest ghcr.io/citcomai-hub/ta-dashboard-backend/auth-backend:latest
	```
4. Push the image:
	```bash
	docker push ghcr.io/citcomai-hub/ta-dashboard-backend/auth-backend:latest
	```