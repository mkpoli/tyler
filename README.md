# Tyler

Tyler is a Typst package compiler for the ease of packaging and publishing Typst libraries and templates.

## Functions

- Compile relative entrypoint import (e.g. `../lib.typst`) to preview import (e.g. `@preview/somepkgs:0.1.0`)
- Bump the version of the package interactively or with specified semver as CLI argument
- (TODO) Publish the package to the Typst preview package index
- (TODO) Install package locally
- (TODO) Auto publishing

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

### Examples

#### Build

Build the package in current directory and output to `dist` directory:

```
tyler build
```

Build the package in `/home/user/typst/some-package` and output to `/home/user/typst/packages/packages/preview/some-package/0.1.0`:

```
tyler build /home/user/typst/some-package --outdir=/home/user/typst/packages/packages/preview/some-package/0.1.0
```

### Configuration

You can pass options to `tyler` commands directly or via `[tool.tyler]` section in your `typetst.toml` file. The CLI options will override the config options, and the config options are limited to the following (with the default value noted):

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
bun run start -- <command> [options]
```

### Publishing

```
bun run bump && bun publish
```
