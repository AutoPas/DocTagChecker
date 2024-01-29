import * as core from '@actions/core'
import * as github from '@actions/github'
import * as fs from 'fs'
import * as path from 'path'
import {
  assertNonNull,
  findFileByName,
  getUrlToChanges,
  getUrlToFile,
  uniqueFilter
} from './utils'

/**
 * Checks if file extensions start with a '.' and then only consist of letters and numbers.
 * @param extension The extensions to check.
 * @return True if extension matches the sane pattern.
 */
function extensionsIsSane(extension: string): boolean {
  // The regex checks if e starts with '.' and only has letters or numbers afterwards until the end.
  return /^\.[a-zA-Z0-9]+$/.test(extension)
}

/**
 * Get the list of file tags anywhere in the given file.
 * A file tag is defined as a continuous word without `/` or white spaces and terminated by a file ending.
 * @param fileContent Content of a file given as string.
 * @param srcFileExtensions List of file extensions that are considered.
 * @return String[] of tags.
 */
function extractFileTags(
  fileContent: string,
  srcFileExtensions: string[]
): string[] {
  // Drop the leading '.' and combine everything with '|' as separator
  const extensionsCombined = srcFileExtensions
    .map(f => f.substring(1, f.length))
    .join('|')
  const srcFileRegex = new RegExp(`[^/\\s]+\\.(${extensionsCombined})\\b`, 'g')
  return Array.from(fileContent.match(srcFileRegex)?.filter(uniqueFilter) || [])
}

/**
 * Get the list of directory tags in the given file.
 * Directory tags are only considered after the string "Related Files and Folders".
 * A directory tag is defined as a string of non white space characters that ends on '/'.
 * @param fileContent Content of a file given as string.
 * @return String[] of tags.
 */
function extractDirectoryTags(fileContent: string): string[] {
  return Array.from(
    fileContent
      // Case insensitive match. Take everything behind the tag
      .split(/Related Files and Folders/i)[1]
      // If there is nothing after the tag default to undefined and thus to []
      // Else match anything that ends on a '/'
      // \S = anything but whitespace
      ?.match(/[\S]+\/(?!\S)/g)
      ?.filter(uniqueFilter) || []
  )
}

/**
 * Checks that if any tagged source file was changed, its corresponding doc file was changed too.
 * @param userdocs - An array of paths to documentation files.
 * @param changes - An array of paths to files that have been changed.
 * @returns An exit code: 0 if no errors were found, 1 if errors were found.
 */
function checkDocumentation(
  userdocs: string[],
  changes: string[],
  docFileExtensions: string[],
  srcFileExtensions: string[]
): { unchangedDoc: Map<string, string[]>; unknownTags: Map<string, string[]> } {
  const unchangedDoc = new Map<string, string[]>()
  const unknownTags = new Map<string, string[]>()

  const changesBasenames = changes.map(f => path.basename(f))

  for (const docfile of userdocs) {
    const fileContent = fs.readFileSync(docfile, 'utf-8')
    let fileTags = extractFileTags(fileContent, srcFileExtensions)
    const directoryTags: string[] = extractDirectoryTags(fileContent)
    core.debug(
      `Found tags in ${docfile}: | File Tags: ${fileTags} | Directory Tags: ${directoryTags} |`
    )

    const docfileHasChanges = changesBasenames.includes(path.basename(docfile))
    const unknownTagsLocal: string[] = []
    const unchangedDocLocal: string[] = []
    // Validate all given file tags.
    for (const tag of fileTags) {
      if (findFileByName('.', tag) === null) {
        unknownTagsLocal.push(tag)
      }
    }
    // Append the content of all directories to the tags.
    for (const tag of directoryTags) {
      if (!fs.existsSync(tag)) {
        // If the dir can not be found it's an unknown tag. Duplicates here are intentional.
        unknownTagsLocal.push(tag)
      } else {
        // Read the content of the directory and split it in files and dirs.
        const dirContent = fs.readdirSync(tag, { withFileTypes: true })
        // Only consider files with any doc ending.
        const files = dirContent
          .filter(
            d => d.isFile() && docFileExtensions.includes(path.extname(d.name))
          )
          .map(d => d.name)
        const dirs = dirContent.filter(d => d.isDirectory()).map(d => d.name)
        // Append files to file tags.
        fileTags = fileTags.concat(files)
        // Append dirs to dir tags. This extends the loop.
        directoryTags.concat(dirs)
      }
    }

    // Make sure all tags are only listed once
    fileTags = fileTags.filter(uniqueFilter)

    // Analyze all file tags for doc changes.
    for (const tag of fileTags) {
      // If any tag appears in the changes, the doc file also has to be in the changes.
      if (!docfileHasChanges && changesBasenames.includes(tag)) {
        unchangedDocLocal.push(tag)
      }
    }

    // If any unknown tags were found store it to the return map.
    if (unknownTagsLocal.length !== 0) {
      core.debug(
        `In ${docfile}, the following tags do not exist:\n${unknownTagsLocal}`
      )
      unknownTags.set(`${docfile}`, unknownTagsLocal)
    }
    // If any changes in related files were found store it to the return map.
    if (unchangedDocLocal.length !== 0) {
      core.debug(
        `${docfile} is unchanged, but the following related files have changed. Check that the documentation is still up to date!\n${unchangedDocLocal}`
      )
      unchangedDoc.set(`${docfile}`, unchangedDocLocal)
    }
  }

  return { unchangedDoc, unknownTags }
}

/**
 * Remove last comment made by this action to avoid spam.
 * If no previous comment can be found do nothing.
 * @param ghToken GitHub Token
 * @param header Header to identify the last bot message.
 * @returns {Promise<void>} Resolves when the function is complete.
 */
async function deleteLastComment(
  ghToken: string,
  header: string
): Promise<void> {
  const octokit = github.getOctokit(ghToken)
  // Retrieve the comments made by the action using the GitHub API
  const commentsResponse = await octokit.rest.issues.listComments({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: assertNonNull(github.context.payload.pull_request).number
  })

  // Find the last comment added by the action based on a specific marker or signature
  const lastCommentId = (() => {
    const expectedUser = 'github-actions[bot]'
    for (let i = commentsResponse.data.length - 1; i >= 0; --i) {
      if (
        assertNonNull(commentsResponse.data[i].user).login === expectedUser &&
        assertNonNull(commentsResponse.data[i].body).includes(header)
      ) {
        return commentsResponse.data[i].id
      }
    }
    return -1
  })()

  core.debug(`Comment to delete: ${commentsResponse.data[lastCommentId]}`)

  // If we found a previous comment by the bot delete it
  if (lastCommentId !== -1) {
    await octokit.rest.issues.deleteComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      comment_id: lastCommentId
    })
  }
}

/**
 * Constructs the comment message from the given analysis results.
 * @param unchangedDoc Map<docfile, tags>.
 * @param unknownTags Map<docfile, tags>.
 * @param header Header for the message.
 * @return Message as string.
 */
function buildMessage(
  unchangedDoc: Map<string, string[]>,
  unknownTags: Map<string, string[]>,
  header: string
): string {
  // If there is nothing to report on, the message stays empty
  if (unchangedDoc.size === 0 && unknownTags.size === 0) {
    return ''
  }

  // Message starts with the header.
  let message = header

  // Local helper function turning a list of tags into named urls to changes.
  const tagsToUrls = (tagList: string[]): string[] => {
    return tagList.map((tag: string): string => {
      const filePath: string = assertNonNull(findFileByName('.', tag))
      return `[${tag}](${getUrlToChanges(filePath)})`
    })
  }

  // Add content for unknown tags.
  if (unknownTags.size !== 0) {
    message += `## Unknown Tags
The following tags could not be found in the latest revision:
| DocFile | Unknown Tags |
|:--------|:------------:|\n`

    // Create one table row for each doc file.
    for (const [docfile, tags] of unknownTags) {
      // Turn filenames to links.
      const docfileLink = `[${path.basename(docfile)}](${getUrlToFile(
        docfile
      )})`
      // Wrap tags in '`' and add space for readability.
      const tagsDecorated = tags.map(tag => {
        return ` \`${tag}\``
      })
      // These tags are unknown so don't try to create links for them.
      message += `| ${docfileLink} | ${tagsDecorated} |\n`
    }
    message += '\n'
  }

  // Add content for unchanged documentation.
  if (unchangedDoc.size !== 0) {
    message += `## Unchanged Documentation
The following doc files are unchanged, but some related sources were changed. Make sure the documentation is up to date!\n\n`
    // Create one task for each doc file.
    for (const [docfile, tags] of unchangedDoc) {
      // Add links to all filenames.
      message += `- [ ] [${path.basename(docfile)}](${getUrlToFile(
        docfile
      )}) (changed: ${tagsToUrls(tags)})\n`
    }
  }

  return message
}

/**
 * Post the given message as a comment to the current PR.
 * @param ghToken GitHub Token.
 * @param message The body of the new comment.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function postMessage(ghToken: string, message: string): Promise<void> {
  const octokit = github.getOctokit(ghToken)
  await octokit.rest.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: assertNonNull(github.context.payload.pull_request).number,
    body: message
  })
}

/**
 * Fetch the list of files that have changes in this PR from GitHub.
 * @param ghToken GitHub Token.
 * @return Promise with the array of filenames.
 */
async function getChangedFiles(ghToken: string): Promise<string[]> {
  // GitHub interaction framework
  const octokit = github.getOctokit(ghToken)

  // Get the list of changed files in the pull request
  const response = await octokit.rest.pulls.listFiles({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: assertNonNull(github.context.payload.pull_request).number
  })

  // Extract file names from the response
  return response.data.map(file => file.filename)
}

// Get list of doc files in the immediate directory. No recursion!
/**
 * Get list of doc files in the immediate directory. No recursion!
 * @param directories Array of directory paths to search for documentation files.
 * @param recursive If true subdirectories are also searched.
 * @return Array of paths to directory files.
 */
function getDocFiles(
  directories: string[],
  docExtensions: string[],
  recursive: boolean
): string[] {
  // Create an array of doc files for every directory and combine them.
  return directories.flatMap(d => {
    // Make sure the directory paths actually exist and are directories.
    if (
      d === undefined ||
      d === null ||
      !fs.existsSync(d) ||
      !fs.statSync(d).isDirectory()
    ) {
      throw new Error(`The given user doc directory does not exist: ${d}`)
    }

    // Read all directories, find doc files, turn them to paths
    // and return them as string[].
    const dirItems = fs.readdirSync(d, {
      withFileTypes: true,
      recursive
    })
    // Find files with an doc extension and get their full path from the repo root.
    const docFiles = dirItems
      .filter(
        item => item.isFile() && docExtensions.includes(path.extname(item.name))
      )
      .map(item => path.join(item.path, item.name))
    return docFiles
  })
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // --------------------- Input parsing and validation ---------------------
    const ghToken = core.getInput('githubToken')
    // Sanity check
    if (ghToken === undefined) {
      throw new Error(`ghToken === undefined. Aborting`)
    }
    // Split on any whitespace, ',', ';', or combination
    const splitRegex = /[\s,;]+/
    // Get directories as arrays.
    const dirs = core.getInput('userDocsDirs').split(splitRegex)
    core.info(
      `User doc directories:${dirs.reduce((acc, a) => `${acc}\n  ${a}`, '')}`
    )
    const recurseUserDocDirs =
      core.getInput('recurseUserDocDirs').toLowerCase() === 'true'
    core.info(`Parse user doc directories recursively: ${recurseUserDocDirs}`)
    // Parse doc extensions, split, and make sure they start with '.'
    const docFileExtensions = (core.getInput('docFileExtensions') || 'md')
      .split(splitRegex)
      .map(s => (s.startsWith('.') ? s : `.${s}`))
    if (!docFileExtensions.every(e => extensionsIsSane(e))) {
      throw new Error(
        `At least one doc extension contains something other than numbers or letters.\ndocFileExtensions: ${docFileExtensions}`
      )
    }
    core.info(`Doc file extensions: ${docFileExtensions}`)
    // Parse source extensions, split, and make sure they start with '.'
    const srcFileExtensions = (
      core.getInput('srcFileExtensions') || 'cpp h txt'
    )
      .split(splitRegex)
      .map(s => (s.startsWith('.') ? s : `.${s}`))
    if (!srcFileExtensions.every(e => extensionsIsSane(e))) {
      throw new Error(
        `At least one src extension contains something other than numbers or letters.\nsrcFileExtensions: ${srcFileExtensions}`
      )
    }
    core.info(`Source file extensions: ${srcFileExtensions}`)
    const docFiles = getDocFiles(dirs, docFileExtensions, recurseUserDocDirs)
    core.info(
      `User doc files:${docFiles.reduce((acc, a) => `${acc}\n  ${a}`, '')}`
    )

    // Get changes from the PR
    const changedFiles = await getChangedFiles(ghToken)
    core.info(
      `Changed files:${changedFiles.reduce((acc, a) => `${acc}\n  ${a}`, '')}`
    )

    // ------------------------- Check docs and tags --------------------------
    const { unchangedDoc, unknownTags } = checkDocumentation(
      docFiles,
      changedFiles,
      docFileExtensions,
      srcFileExtensions
    )

    // ------------------------- Process the analysis -------------------------
    // Common header to identify this bot's messages.
    const header = '# DocTagChecker\n\n'
    // Remove the last comment to avoid spam.
    await deleteLastComment(ghToken, header)
    // Set outputs for other workflow steps to use.
    if (unchangedDoc.size === 0 && unknownTags.size === 0) {
      core.setOutput('warnings', 'NO WARNINGS')
      // Message to signal that the checking actually happened.
      const message = `${header}Looks good to me! :shipit:`
      await postMessage(ghToken, message)
    } else {
      core.setOutput('warnings', 'DOC MIGHT NEED UPDATE OR TAGS ARE INVALID')
      // Add a new comment with the warnings to the PR.
      const message = buildMessage(unchangedDoc, unknownTags, header)
      await postMessage(ghToken, message)
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(`Action failed with error:\n${error}\n${error.stack}`)
    } else {
      core.setFailed(`Action failed with unknown type of error:\n${error}`)
    }
  }
}
