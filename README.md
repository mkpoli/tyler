# Tyler

Tyler is a Typst package compiler for the ease of packaging and publishing Typst libraries and templates.

https://github.com/user-attachments/assets/49bd7e94-8fd3-4ead-bede-2e58471d1a85

## Features

- 📥 Install package locally to be able to use with `@local/somepkg:0.1.0`
- 📄 Compile relative entrypoint import (e.g. `../lib.typ`) to preview import (e.g. `@preview/somepkg:0.1.0`)
- 🔄 Bump the version of the package interactively or with specified semver as CLI argument
- 🔍 Check if the package manifest (`typst.toml`) is valid before publishing
- 📦 Package the library or package into `typst/packages` ready for publishing
- 🚀 Semi-automatic publishing that creates a PR to the Typst preview package repository
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

It is recommended to put all your source files in a `src` directory and run Tyler from the root of your project, or you can specify custom source directory (even root directory) with `--srcdir` option, however, in that case, you need to add files to `--ignore` option manually (e.g. `--ignore="CONTRIBUTING.md,hello.world,neko/*"`) to remove them from the distributed package.

### Basics

Run the following command in your typst package will check the package and build it, then install the built package to Typst local package group (`-i`) as well as prepare the package for publish and display instructions to create a PR (`-p`):

```bash
tyler build -i -p
```

### Examples

#### Check

Check if the package manifest (`typst.toml`) is valid and required properties / files e   :

```
tyler check
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

## Development

```
bun install
```

### Emulating

```
bun tyler <command> [options]
```

### Publishing

```
bun run bump && bun publish
```

## Trivia

Tyler is named after something like **Ty**pst + Compi**ler** or **Ty**pst + But**ler**.

## License

[MIT License](./LICENSE) © 2024 [mkpoli](https://mkpo.li/)
