# GitHub Pages deployment

The application is a dependency-free static site. All published files are in `dist/`. Its relative asset and module URLs support a GitHub Pages repository subpath without changes. There is no server, database, ChatGPT login, or Sites runtime dependency.

## Setup

1. Create the project repository in the intended GitHub account.
2. Upload the source and tests, including `.github/workflows/pages.yml`, `dist/`, and this guide. Do not upload user layout exports, browser data, credentials, or the existing internal `.openai` hosting identity.
3. In repository Settings → Pages, choose GitHub Actions as the build source.
4. Push to `main` or manually run **Test and publish Hart Fitness Center** under Actions.
5. Verify the deployment finishes successfully, then use the URL returned by GitHub Pages.

The workflow runs the application's geometry, compatibility, storage, and persistence tests before publishing the `dist/` artifact. It grants Pages deployment permission only to the deployment job.

Repository privacy depends on the account's GitHub plan. GitHub Pages is generally public even when its source repository is private. Do not change source visibility without the owner's choice.

## Transfer saved layouts

A change in website origin creates a separate browser storage area. Saved layouts and Equipment Library templates cannot automatically cross between origins.

1. Open the old planner: https://gym-layout-studio-jackson.froggreen981.chatgpt.site/
2. Choose **Export JSON** and retain that file as a backup.
3. Open the new GitHub Pages planner in the browser you intend to use.
4. Choose **Import** and select the exported JSON file.
5. Check the active arrangement, all other arrangements, equipment count, saved Equipment Library templates, and storage inventory.
6. Refresh the new page and confirm the imported project remains present.

The import contains the complete project and replaces the new site's sample project. Undo can restore the prior workspace during the session. Keep the old site available until the transfer is verified. Do not commit the exported JSON to GitHub.

## Local use

```sh
python -m http.server 8000 --directory dist
```

Open `http://localhost:8000/`. The same export/import process works for moving between devices or browser profiles.
