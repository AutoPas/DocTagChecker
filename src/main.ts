import * as core from '@actions/core'
import * as github from '@actions/github'
import * as fs from 'fs'
import * as path from 'path'
import { findFileByName } from './utils'

/**
 * Checks that if any tagged source file was changed, its corresponding doc file was changed too.
 * @param userdocs - An array of paths to documentation files.
 * @param changes - An array of paths to files that have been changed.
 * @returns An exit code: 0 if no errors were found, 1 if errors were found.
 */
function checkDocumentation(
  userdocs: string[],
  changes: string[]
): { unchangedDoc: Map<string, string[]>; unknownTags: Map<string, string[]> } {
  let unchangedDoc = new Map<string, string[]>()
  let unknownTags = new Map<string, string[]>()

  const changesBasenames = changes.map(f => path.basename(f))

  for (const docfile of userdocs) {
    // Get list of file tags. (All words that end with .txt, .h, or .cpp without full paths)
    const fileContent = fs.readFileSync(docfile, 'utf-8')
    let fileTags = Array.from(
      fileContent.match(/[^/\s]+\.(h|cpp|txt)\b/g) || []
    )
    // Get list of directory tags (All strings that end on '/' after "Related ...Folders"; this split is case-insensitive:w
    const directoryTags: string[] = Array.from(
      fileContent
        .split(/Related Files and Folders/i)[1]
        .match(/[\S]+\/(?!\S)/g) || []
    )
    core.debug(
      `Found tags in ${docfile}: | File Tags: ${fileTags} | Directory Tags: ${directoryTags} |`
    )

    const docfileHasChanges = changesBasenames.includes(path.basename(docfile))
    const unknownTagsLocal: string[] = []
    const unchangedDocLocal: string[] = []
    // append the content of all directories to the tags
    for (const tag of [...directoryTags]) {
      if (findFileByName('.', tag) === null) {
        // if the dir can not be found it's an unknown tag
        unknownTagsLocal.push(tag)
      } else {
        // if it can be found, all files in it are file tags
        fileTags = fileTags.concat(fs.readdirSync(tag))
      }
    }

    for (const tag of [...fileTags]) {
      // If the path in the tag doesn't exist, it's an error
      if (findFileByName('.', tag) === null) {
        unknownTagsLocal.push(tag)
      }
      // If any tag appears in the changes, the doc file also has to be in the changes
      if (!docfileHasChanges && changesBasenames.includes(tag)) {
        unchangedDocLocal.push(tag)
      }
    }

    // If any unknownTags were found store it to the return map
    if (unknownTagsLocal.length !== 0) {
      core.debug(
        `In ${docfile}, the following tags do not exist:\n${unknownTagsLocal}`
      )
      unknownTags.set(`${docfile}`, unknownTagsLocal)
    }
    // If any changes in related files were found store it to the return map
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
    issue_number: github.context.payload.pull_request!.number
  })

  // Find the last comment added by the action based on a specific marker or signature
  const lastCommentId = (() => {
    const expectedUser = 'github-actions[bot]'
    for (let i = commentsResponse.data.length - 1; i >= 0; --i) {
      if (
        commentsResponse.data[i].user!.login === expectedUser &&
        commentsResponse.data[i].body!.includes(header)
      ) {
        return commentsResponse.data[i].id
      }
    }
    return -1
  })()

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

  // Message starts with the header
  let message = header

  // Add content for unknown tags
  if (unknownTags.size !== 0) {
    message += `## Unknown Tags
The following tags could not be found in the latest revision:
| DocFile | Unknown Tags |
|:-------:|:------------:|\n`

    unknownTags.forEach((tags, docfile) => {
      message += `| ${path.basename(docfile)} | ${tags} |\n`
    })
    message += '\n'
  }

  // Add content for unchanged documentation
  if (unchangedDoc.size !== 0) {
    message += `## Unchanged Documentation
The following doc files are unchanged, but some related sources were changed. Make sure the documentation is up to date!\n\n`
    unchangedDoc.forEach((tags, docfile) => {
      message += `- [ ] ${path.basename(docfile)} (changed: ${tags})\n`
    })
  }

  return message
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
    const ghToken = core.getInput('githubToken')
    const prNumber = parseInt(
      (process.env.GITHUB_REF_NAME ?? '').split('/')[0],
      10
    )
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
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: prNumber
    })

    // TODO: TEST THIS
    // Filter out files with only whitespace changes
    // const filesWithoutWhitespaceChanges = response.data.filter((file: any) => {
    //   return file.status !== 'modified' && file.status !== 'added';
    // });

    // Extract file names from the response
    const changedFiles = response.data.map(file => file.filename)
    core.info(`changed files: ${changedFiles}`)

    const { unchangedDoc, unknownTags } = checkDocumentation(
      docFiles,
      changedFiles
    )

    // Set outputs for other workflow steps to use
    if (unchangedDoc.size === 0 && unknownTags.size === 0) {
      core.setOutput('warnings', 'NO WARNINGS')
    } else {
      core.setOutput('warnings', 'DOC MIGHT NEED UPDATE OR TAGS ARE INVALID')
      const header = '# DocTagChecker\n\n'
      const message = buildMessage(unchangedDoc, unknownTags, header)
      await deleteLastComment(ghToken, header)

      // Add a new comment with the warnings to the PR
      await octokit.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: prNumber,
        body: message
      })
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}
