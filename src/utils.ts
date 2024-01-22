import * as fs from 'fs'
import * as path from 'path'
import * as github from '@actions/github'
import crypto from 'crypto'

/**
 * Recursively searches for a file with a specific name in a given directory.
 * @param directory The directory to start the search from.
 * @param fileName The name of the file to search for.
 * @returns The path of the found file or null if the file is not found.
 */
export function findFileByName(
  directory: string,
  fileName: string
): string | null {
  /**
   * Recursive helper function to search for the file.
   * @param currentDir The current directory to search.
   */
  function search(currentDir: string): string | null {
    const items = fs.readdirSync(currentDir)

    // Go over everything in the current directory
    for (const item of items) {
      const itemPath = path.join(currentDir, item)

      // Check if the current item (file or dir) is what we are looking for
      if (item === path.basename(fileName)) {
        // File found in the current directory
        return itemPath
      }

      // If the item is a directory descend into it
      const isDirectory = fs.statSync(itemPath).isDirectory()
      if (isDirectory) {
        // Recursive call for subdirectories
        const result = search(itemPath)
        if (result !== null) {
          // File found, propagate the result up
          return result
        }
      }
    }
    // File not found in this directory or its subdirectories
    return null
  }

  // Actual function body
  return search(directory)
}

/**
 * Constructs the URL to the given file in the repo at the state of the PR.
 * @param filePath Path from the root of the repository to the file.
 * @return URL as string.
 */
export function getUrlToFile(filePath: string): string {
  const owner = github.context.repo.owner
  const repo = github.context.repo.repo
  const commitHash = github.context.sha

  const url = `https://github.com/${owner}/${repo}/blob/${commitHash}/${filePath}`
  return url
}

/**
 * Utility function to get the sha256 hash value of some string.
 * @param input The string to hash.
 * @return sha256 hash of input.
 */
function calculateSHA256(input: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(input)
  return hash.digest('hex')
}

/**
 * Constructs the URL to the change view of a file in the PR.
 * @param filePath Path from the root of the repository to the file.
 * @return URL as string.
 */
export function getUrlToChanges(filePath: string): string {
  const owner = github.context.repo.owner
  const repo = github.context.repo.repo
  const commitHash = github.context.sha
  const prNumber = github.context.payload.pull_request!.number
  const filePathHash = calculateSHA256(filePath)

  const url = `https://github.com/${owner}/${repo}/pull/${prNumber}/files#diff-${filePathHash}`
  return url
}
