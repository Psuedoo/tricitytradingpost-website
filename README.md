# Tri-City Trading Post Website

[![Live Site](https://img.shields.io/badge/live%20site-GitHub%20Pages-2ea44f)](https://psuedoo.github.io/tricitytradingpost-website/)

Static website for Tri-City Trading Post, published with GitHub Pages.

## Deployment

- `main` is the source of truth.
- `.github/workflows/gh-pages.yml` publishes the production site to `gh-pages`.
- Pull requests also publish preview pages under `pr-preview/`.

## Verify Production

To verify that production deployed the expected build:

1. Confirm the latest commit on `gh-pages` says `Deploy site from main`.
2. Open the live site and inspect page source for:

```html
<meta name="site-version" content="...">
```

On production deploys, that value is stamped from the deployed commit SHA during the GitHub Actions build.
