# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2025-12-31

### Added
- **Version Display**: Tyler now displays its version number at the start of every command execution (`[Tyler] vX.Y.Z`).
- **Interactive PR Workflow**: Added checks for existing Pull Requests before prompting to create a new one, and improved the interactive prompt for filling in PR details.
- **Env Command**: Added a new `env` command.

### Fixed
- **Entrypoint Path**: The `entrypoint` field in the generated `typst.toml` is now correctly calculated relative to the source directory. Previously, it would incorrectly retain the `src/` prefix (e.g., `src/lib.typ`) even when the file was moved to the root of the distribution folder.

### Changed
- Refactored codebase formatting and updated dependencies.

## [0.5.1] - 2024-11-21

### Added
- **Git Robustness**:
    - Added a pre-check to ensure `git` is installed.
    - Improved handling of the `packages` repository, including safe removal of invalid directories.
    - Fixed issues with branch creation and cleaning.
- **Visual Feedback**: Added a file tree visualization after copying files to the preview package directory.

### Documentation
- Added LICENSE text to README.
- Added more TODOs and trivia sections.

## [0.5.0] - 2024-11-20

### Changed
- **Refactoring**: Extracted git repository cloning and cleaning logic into reusable modules.
- **Documentation**: Adjust feature ordering and fixed typos in README.

## [0.4.0] - 2024-11-20

### Added
- **Validation**:
    - `check` command is now run by default before building.
    - Validates license strings using `spdx-expression-validate`.
    - validates template structure.
- **Formatting**: `typst.toml` is now automatically formatted before being written.
- **Type Definitions**: Added TypeScript types for package metadata.
- **Prebuild Hook**: Added a prebuild hook to run checks.

### Fixed
- **Path Resolution**: Fixed path resolution logic for source-based directory structures.

## [0.3.4] - 2024-11-20

### Added
- **Basic Checking**: Introduced the initial `check` command.
- **CLI Improvements**: Added descriptions to command help and renamed internal test scripts.

## [0.3.3] - 2024-11-20

### Added
- **PR Drafting**: Added support for creating draft Pull Requests.
- **Instructions**: Improved detailed instructions for users.

## [0.3.2] - 2024-11-19

### Fixed
- **Thumbnails**: Fixed an issue where template thumbnails were not being copied to the distribution.

## [0.3.1] - 2024-11-19

### Changed
- **Logging**: Unified logging style to use `console.info`.
- **Instructions**: Simplified instructions by removing the need to manually delete files for performance.

### Fixed
- **Templates**: Fixed template path resolving.

## [0.3.0] - 2024-11-19

### Added
- **GitHub Integration**: Added `gh repo set-default` command to streamline CLI workflow.
- **Linting**: Fixed lint errors.

## [0.2.1] - 2024-11-19

### Added
- **Publishing**: Added basic publishing capabilities and a comprehensive publishing guide.
- **Git Optimization**: Used a shared git repository to save disk space.
- **Realtime Output**: Added realtime display of git command output.
- **Usage Video**: Added a usage video to documentation.

### Fixed
- **Versioning**: Fixed an issue where the modified version was not being bumped correctly.

## [0.2.0] - 2024-11-19

### Fixed
- **Version Handling**: Fixed `undefined` version issues.
- **Documentation**: Updated features list.

## [0.1.2] - 2024-11-18

### Added
- **Local Installation**: Added support for installing packages to the local Typst package directory.
- **CLI Arguments**: Removed `-i` from being an alias for `ignore` to avoid confusion with `install`.
- **Publishing Guide**: Added documentation on how to publish packages.

### Fixed
- **Build Parameters**: Fixed parsing of build parameters.

## [0.1.1] - 2024-11-18

### Changed
- **Performance**: Refactored to use standard `fs` API instead of Bun-specific APIs where appropriate.
- **Robustness**: Improved file existence checks, fixing deprecation warnings.

## [0.1.0] - 2024-11-18

### Added
- **Bumpp Integration**: Added `bumpp` for version management and tagging.

## Initial Release - 2024-11-18

### Added
- Initial commit with basic package structure.
- Installation guides and README.
- Basic CLI commands and aliases.
- `lefthook` for linting.
