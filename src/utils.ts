import * as fs from 'fs'
import * as path from 'path'

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
