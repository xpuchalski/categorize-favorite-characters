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

## Notes

- Editing and saving characters.txt from the deployed site is read-only and returns a clear message.
- To update data, edit characters.txt in Git and redeploy.
- SPA routing fallback is handled by public/_redirects.

## Local development

- Frontend + local Node API: npm run dev
- Frontend only build check: npm run build
