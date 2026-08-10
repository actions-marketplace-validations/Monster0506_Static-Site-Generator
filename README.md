# staticsitegenerator

This repository is a static blog generator that runs on Bun. It is a reusable GitHub Action.

The action reads a directory of markdown files. Each file can have a TOML frontmatter block. The action converts the files into a static site. It creates one HTML page for each post, plus an index page. The action then uploads the site as a GitHub Pages artifact.

Do not copy this repository as a template. Other repositories use it directly as an action.

## Use this action in another repository

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - id: pages
        uses: actions/configure-pages@v5

      - uses: Monster0506/staticsitegenerator@main
        with:
          base-path: ${{ steps.pages.outputs.base_path }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Your repository needs only a directory of `.md` post files. The default directory is `_pages/`.

In your repository, go to Settings, then Pages. Set GitHub Pages to deploy with GitHub Actions. If you do not set this, the `deploy-pages` step fails.

### Inputs

| Input | Default | Description |
|---|---|---|
| `pages-dir` | `_pages` | Directory in the caller repository with the markdown source files |
| `dist-dir` | `dist` | Directory in the caller repository for the built site |
| `base-path` | `''` | Path added before internal links, for example `/my-repo`. Leave this input empty for a user page, an organization page, or a custom domain. See the `base_path` output of `actions/configure-pages` above |

### Outputs

| Output | Description |
|---|---|
| `dist-path` | Path of the built site, relative to the root of the caller repository |

## Post format

Each post is a markdown file with an optional TOML frontmatter block:

```md
+++
title='DEMO'
date='2026-01-05'
+++

# This is some content

> It has content

1. And content
2. And content

- and content
- and more content
```

The action reads `title` and `date` from the frontmatter. The value of `date` must be a string, or a UNIX epoch time in seconds. TOML must be able to parse the value as a date, for example `'2026-01-05'`.

If a post has no `date` value, the action still builds the post. The post page does not show a published-date line.

The index page shows posts in order by `date`, from newest to oldest. A post with no `date` value sorts by the last-modified time of its source file instead.

The output file name is a hash of the source file name. It is not the same as the source file name.

## Local development

Build the site on your computer with this command:

```bash
bun install
bun run build
```

This command builds the files in `_pages/*.md` into the `dist/` directory.

You can set environment variables to change the source directory, the output directory, or the base path:

```bash
PAGES_DIR=./content DIST_DIR=./public BASE_PATH=/my-repo bun run build
```

## Slots

Add an optional `_site.config.tsx` file to the root of your repository (next to `_pages/`) to customize parts of the page shell. Export any of these named components:

| Slot | Renders | Default |
|---|---|---|
| `Header` | Inside the page `<header>` | A "Home" link |
| `Footer` | Inside a `<footer>` element after the page content | Nothing |
| `HeadExtra` | Extra tags inside `<head>`, after the built-in meta, font, and stylesheet tags | Nothing |

Each slot receives a `basePath` prop. This prop matches the `base-path` input of the action:

```tsx
export function Header({basePath}: {basePath: string}) {
    return <a href={`${basePath}/`}>My Blog</a>;
}

export function Footer({basePath}: {basePath: string}) {
    return <p>&copy; 2026 My Blog</p>;
}

export function HeadExtra() {
    return <link rel="icon" href="/favicon.ico" />;
}
```

Omit a slot to keep its default. You do not need `react` in your own `package.json`. The action resolves `react` from its own dependencies. If `_site.config.tsx` fails to import, or throws while it renders, the build fails.

## Layout

- `build.tsx`: the generator. It reads frontmatter, converts markdown to HTML, renders pages with React, and compiles `src/blog.css` with Tailwind.
- `src/lib/`: markdown parsing, frontmatter parsing, and file input/output.
- `src/blog.css`: the style sheet for the site (Tailwind v4 and the typography plugin).
- `action.yml`: the composite action definition that other repositories use.
- `_site.config.tsx` (optional, in the caller repository): layout slot overrides. See [Slots](#slots).
