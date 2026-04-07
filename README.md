# Character Categorization

This project is configured for Cloudflare Pages + Pages Functions.

## Deploy to Cloudflare Pages

1. Push this repository to GitHub.
2. In Cloudflare dashboard, go to Workers and Pages -> Create -> Pages -> Connect to Git.
3. Select this repository.
4. Build settings:
   - Build command: npm run build
   - Build output directory: build
5. Deploy.

Cloudflare will automatically use functions in functions/api for:
- /api/characters
- /api/image-search

## Enable live saving with Cloudflare KV

1. In Cloudflare dashboard, open your Pages project.
2. Go to Settings -> Functions -> KV namespace bindings.
3. Add binding:
   - Variable name: CHARACTERS_KV
   - KV namespace: create/select one namespace for this project
4. Redeploy the project.

After this, the Save button writes to KV via PUT /api/characters.

## Notes

- If KV is not configured, GET /api/characters falls back to public/characters.txt.
- After KV is configured, GET/PUT /api/characters use KV storage.
- SPA routing fallback is handled by public/_redirects.

## Local development

- Frontend + local Node API: npm run dev
- Frontend only build check: npm run build
