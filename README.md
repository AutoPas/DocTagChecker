# DocTagChecker

[![GitHub Super-Linter](https://github.com/AutoPas/DocTagChecker/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/AutoPas/DocTagChecker/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/AutoPas/DocTagChecker/actions/workflows/check-dist.yml/badge.svg)](https://github.com/AutoPas/DocTagChecker/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/AutoPas/DocTagChecker/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/AutoPas/DocTagChecker/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub action to help you keep your user documentation up to date with your source code.

It works by looking for file or directory tags in your documentation and then checking if these documentation pages have changed and if the linked source code has been updated.
Since this is very prone to false positives, it never fails workflows but instead posts status comments to the corresponding pull request.

## Usage

To use DocTagChecker in your project, you must include it and adhere to its (very few) assumptions.

### Add DocTagChecker to your Workflows

To add this action to your CI copy and adapt the following into your `YAML` workflow file.

```yaml
name: DocTagChecker Workflow

on:
  pull_request  # This action is intended only for PRs

jobs:
  DocTagCheck:
    runs-on: ubuntu-latest  # this is tested but other runners might work too
    steps:
      - name: Checkout your code
        uses: your/way/to/checkout
      - name: Check for missing user doc updates
        uses: AutoPas/DocTagChecker@main  # substitute main for a release tag
        with: 
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          # multiple paths are separated by whitespace or ','
          userDocsDirs: paths/to/ your/doc/dir relative/to/repo/root
          # Optional inputs with defaults:
          dirTagSectionRegex: /Related Files and Folders/i
          # Check userDocsDirs recursively.
          recurseUserDocDirs: false
          # File extensions for files to be considered documentation.
          docFileExtensions: md
          # File extensions for files to be considered source code.
          srcFileExtensions: cpp h txt
```

### Tag your Documentation

DocTagChecker looks for two kinds of tags in all documentation files:

- **File Tags**: Any filename that occurs in the file. A filename is a string without white spaces that ends with a file ending. File tags do not include paths.
- **Directory Tags**: Any path that occurs after the string "Related Files and Folders", so it is advised to create such a section at the end of every documentation page. A path is a string without white spaces that ends with a `/`. It can be absolute or relative to the root of the repository. Everything in the tagged directory will be recursively added to the file tags.

## Build and Develop

This GitHub action was created from the [actions/typescript-action template](https://github.com/actions/typescript-action). Refer to this for general tips, techniques, and guidelines.

### Dependencies

- [Node.js](https://nodejs.org) Version >= 20

### Development Workflow

The general development workflow should look as follows:

1. Create a new branch for your update

    ```bash
    git checkout -b myAwsomeUpdate
    ```

1. Implement your update in [`src/`](src) in TypeScript.

    If you need new input values for the action, add them to [`action.yml`](action.yml)
1. Add tests to [`__tests__`](__tests__).
1. Format, build, and run the tests.

    ```bash
    npm run all
    ```

    This is critical. Without this step, the JavaScript code, which is what's actually run, is not built, and nothing changes!
1. Commit, push, review, and merge to main.
1. (If applicable) Create a new release using the [release script](script/release).

    ```bash
    script/release
    ```
