import * as core from '@actions/core'
import * as github from '@actions/github'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Recursively searches for a file with a specific name in a given directory.
 * @param directory The directory to start the search from.
 * @param fileName The name of the file to search for.
 * @returns The path of the found file or null if the file is not found.
 */
function findFileByName(directory: string, fileName: string): string | null {
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
      if (item=== path.basename(fileName)) {
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
  try {
    return search(directory)
  } catch (error) {
    if (error instanceof Error)
      console.error(`Error while searching for a file: ${error.message}`)
    return null
  }
}

function checkDocumentation(
  baseBranch: string,
  userdocs: string[],
  changes: string[]
): number {
  // Flag for if any errors are found
  let exitCode = 0

  const changesBasenames = changes.map(f => path.basename(f))

  for (const docfile of userdocs) {
    // Get list of file tags. (All words that end with .txt, .h, or .cpp without full paths)
    const fileContent = fs.readFileSync(docfile, 'utf-8')
    let fileTags = Array.from(
      fileContent.match(/[^\/\s]+\.(h|cpp|txt)\b/g) || []
    )
    // Get list of directory tags (All strings that end on '/' after "Related ...Folders"; this split is case-insensitive:w
    const directoryTags: string[] = Array.from(
      fileContent
        .split(/Related Files and Folders/i)[1]
        .match(/[\S]+\/(?!\S)/g) || []
    )

    const docfileHasChanges = changes.includes(path.basename(docfile))
    let unknownTags: string[] = []
    // append the content of all directories to the tags
    for (const tag of [...directoryTags]) {
      // If the path in the tag doesn't exist, it's an error
      if (findFileByName('.', tag) === null) {
        unknownTags.push(tag)
        exitCode = 1
      } else {
        fileTags = fileTags.concat(fs.readdirSync(tag))
      }
    }

    for (const tag of [...fileTags]) {
      // If the path in the tag doesn't exist, it's an error
      if (findFileByName('.', tag) === null) {
        unknownTags.push(tag)
        exitCode = 1
      }
      // If any tag appears in the changes, the doc file also has to be in the changes
      if (!docfileHasChanges && changesBasenames.includes(tag)) {
        console.log(
          `${tag} has been changed, but ${docfile} is unchanged. Check that the documentation is still up to date!`
        )
        exitCode = 1
      }
    }

    // If any unknownTags were found (unknownTags not empty)
    if (unknownTags.length !== 0) {
      console.log(
        `In ${docfile}, the following tags do not exist:\n${unknownTags}`
      )
    }
  }

  return exitCode
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Input parsing
    // Get directories as arrays. Split at any amount of white space characters.
    const dirs = core.getInput('userDocsDirs').split(/\s+/)
    const baseBranch = process.env.GITHUB_BASE_REF!
    const ghToken = core.getInput('githubToken')
    const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/')
    const pull_number = parseInt(
      (process.env.GITHUB_REF_NAME ?? '').split('/')[0],
      10
    )
    core.info(`Base branch: ${baseBranch}`)
    core.info(`User doc directories: ${dirs}`)
    // Get list of doc files
    const docFiles = dirs.flatMap(d =>
      fs.readdirSync(d).map(f => path.join(d, f))
    )
    core.info(`User doc files: ${docFiles}`)
    if (ghToken === undefined) {
      core.warning(`ghToken === undefined. Aborting`)
      return
    }
    // GitHub interaction framework
    const octokit = github.getOctokit(ghToken)

    // Get the list of changed files in the pull request
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number
    })
    // Extract file names from the response
    const changedFiles = response.data.map(file => file.filename)
    core.info(`changed files: ${changedFiles}`)

    const exitCode = checkDocumentation(baseBranch, docFiles, changedFiles)

    // Set outputs for other workflow steps to use
    // TODO: use exitCode
    core.setOutput('warnings', 'NO WARNINGS')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
