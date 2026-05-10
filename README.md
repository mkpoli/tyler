# Tyler

[![npm version](https://img.shields.io/npm/v/@mkpoli/tyler.svg?logo=npm&label=%40mkpoli%2Ftyler)](https://www.npmjs.com/package/@mkpoli/tyler)

Tyler is a Typst package compiler for the ease of packaging and publishing Typst libraries and templates.

https://github.com/user-attachments/assets/49bd7e94-8fd3-4ead-bede-2e58471d1a85

## Features

- 📥 Install package locally to be able to use with `@local/somepkg:0.1.0`
- 📄 Compile relative entrypoint import (e.g. `../lib.typ`) to preview import (e.g. `@preview/somepkg:0.1.0`)
- 🔄 Bump the version of the package interactively or with specified semver as CLI argument
- 🔍 Check if the package manifest (`typst.toml`) is valid before publishing
- 🧙 Initialize Typst library, template, or WebAssembly plugin starter projects
- 📦 Package the library or package into `typst/packages` ready for publishing
- 🚀 Semi-automatic publishing that creates a PR to the Typst preview package repository
- 📝 Prompt for PR fulfillment
- ℹ️ Display local environment information (Typst executable and package directory)
- (TODO) Automatic publishing
- (TODO) Task runner
- (TODO) Thumbnail compressing
- (TODO) Thumbnail generating
- (TODO) Linting / Type Checking

## Installation

```
npm install -g @mkpoli/tyler
```

or

```
bun i -g @mkpoli/tyler
```

## Usage

It is recommended to put all your source files in a `src` directory and run Tyler from the root of your project, or you can specify a custom source directory (even the project root) with `--srcdir`. When `srcdir` is the project root, Tyler automatically skips obvious dev cruft (`.git`, `node_modules`, `.DS_Store`, `.vscode`, `.idea`, the output directory) so you don't have to enumerate them. Anything project-specific you want left out of the distributed package should go in `package.exclude` (the official Typst manifest field) or `tool.tyler.ignore` — both are honored and combined at build time.

### Basics

Run the following command in your typst package will check the package and build it, then install the built package to Typst local package group (`-i`) as well as prepare the package for publish and display instructions to create a PR (`-p`):

```bash
tyler build -i -p
```

### Examples

#### Check

Check if the package manifest (`typst.toml`) is valid and required properties / files exist:

```
tyler check
```

#### Init / Create

Initialize a package in the current directory:

```
tyler init
```

Create a package in a new folder with recommended defaults and no prompts:

```
tyler create my-package --default
```

Create a template starter or WebAssembly plugin scaffold:

```
tyler create my-template --type template
tyler create my-plugin --plugin
```

#### Build

Build the package in current directory and output to `dist` directory:

```
tyler build
```

Build the package then install it to Typst local package group:

```
tyler build -i
```

Build the package in `/home/user/typst/some-package` and output to `/home/user/typst/packages/packages/preview/some-package/0.1.0`:

```
tyler build /home/user/typst/some-package --outdir=/home/user/typst/packages/packages/preview/some-package/0.1.0
```

#### Publish

You need to have `git` and it is recommended to have `gh` (GitHub CLI) installed to publish the package.

```
tyler build -p
```

If you are experiencing the following error, you can try to downgrade HTTP/2 to HTTP/1.1 by `git config --global http.version HTTP/1.1` (to reverse it, do `git config --global http.version --unset`):

```
error: RPC failed; curl 92 HTTP/2 stream 0 was not closed cleanly: CANCEL (err 8)
error: 1143 bytes of body are still expected
fetch-pack: unexpected disconnect while reading sideband packet
fatal: early EOF
fatal: fetch-pack: invalid index-pack output
```

#### Environment

Display the local package directory and the Typst executable path:

```
tyler env
```

### Configuration

You can pass options to `tyler` commands directly or via `[tool.tyler]` section in your `typst.toml` file. The CLI options will override the config options, and the config options are limited to the following (with the default value noted):

```
[tool.tyler]
srcdir = "src"
outdir = "dist"
ignore = []
```

CLI options can be checked with `tyler --help` and `tyler <command> --help` command.

#### Excluding files from the published package

Tyler builds an effective skip list at build time from three sources, in this order:

1. `tool.tyler.ignore` (or `--ignore` on the CLI) — Tyler-specific patterns.
2. `package.exclude` — the official Typst manifest field for files that must not be part of the released package.
3. Built-in defaults — `.git`, `node_modules`, `.DS_Store`, `.vscode`, `.idea`, and the configured `outdir` when it sits inside `srcdir`.

Patterns are gitignore-flavoured globs (powered by `minimatch`, with `dot: true`). A literal directory name like `node_modules` matches both the directory entry itself and everything under it.

#### Flat layout (library at the project root)

If your library lives at the project root rather than under `src/` — a common shape for small libraries and for projects that you don't want to restructure — set `srcdir = "."` and let `package.exclude` carry your project-specific dev paths. Built-in defaults take care of `.git`, `node_modules`, the `outdir`, and friends, so you typically only need to list things like `examples/`, `scripts/`, or test fixtures.

```
my-lib/
├── lib.typ
├── lib/
│   └── helpers.typ
├── examples/        ← dev-only
├── README.md
├── LICENSE
└── typst.toml
```

```toml
[package]
name = "my-lib"
version = "0.1.0"
entrypoint = "lib.typ"
authors = ["Your Name"]
license = "MIT"
description = "..."
exclude = ["examples/**"]

[tool.tyler]
srcdir = "."
```

For a template package with the same flat shape, keep the canonical `template/` directory next to `lib.typ` and point `template.path` at it:

```toml
[template]
path = "template"
entrypoint = "main.typ"
thumbnail = "thumbnail.png"
```

Tyler will copy everything under the project root into `dist/`, rewrite `#import "../lib.typ"` in template files to `#import "@preview/<name>:<version>"`, and skip both the built-in defaults and the patterns you listed in `package.exclude`.

## Development

```
bun install
```

### Emulating

```
bun tyler <command> [options]
```

### Releasing

Tyler is published to npm by GitHub Actions ([`.github/workflows/publish.yml`](./.github/workflows/publish.yml)) — any `v*` tag pushed to the repository triggers a build and `npm publish --provenance`. The local release flow is:

```
bun run bump          # bumpp updates package.json, commits, and tags vX.Y.Z
git push --follow-tags
```

That's it — do **not** run `bun publish` / `npm publish` from a workstation. The tag-driven CI is the only sanctioned publish path so we get reproducible builds and provenance attestations on the package. If you need to ship a fix without going through `bumpp`, you can manually `git tag vX.Y.Z && git push --tags` after editing `package.json` and `CHANGELOG.md`. `workflow_dispatch` is also enabled on the publish workflow as a manual safety valve.

## Trivia

Tyler is named after something like **Ty**pst + Compi**ler** or **Ty**pst + But**ler**.

## License

[MIT License](./LICENSE) © 2024 [mkpoli](https://mkpo.li/)
