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
function checkDocumentation(userdocs: string[], changes: string[]): string {
  let output = ''

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

    const docfileHasChanges = changesBasenames.includes(path.basename(docfile))
    const unknownTags: string[] = []
    // append the content of all directories to the tags
    for (const tag of [...directoryTags]) {
      // If the path in the tag doesn't exist, it's an error
      if (findFileByName('.', tag) === null) {
        unknownTags.push(tag)
      } else {
        fileTags = fileTags.concat(fs.readdirSync(tag))
      }
    }

    for (const tag of [...fileTags]) {
      // If the path in the tag doesn't exist, it's an error
      if (findFileByName('.', tag) === null) {
        unknownTags.push(tag)
      }
      // If any tag appears in the changes, the doc file also has to be in the changes
      if (!docfileHasChanges && changesBasenames.includes(tag)) {
        output += `${tag} has been changed, but ${docfile} is unchanged. Check that the documentation is still up to date!\n`
      }
    }

    // If any unknownTags were found (unknownTags not empty)
    if (unknownTags.length !== 0) {
      output += `In ${docfile}, the following tags do not exist:\n${unknownTags}\n`
    }
  }

  return output
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
    const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/')
    const pull_number = parseInt(
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
      owner,
      repo,
      pull_number
    })
    // Extract file names from the response
    const changedFiles = response.data.map(file => file.filename)
    core.info(`changed files: ${changedFiles}`)

    const errMsgs = checkDocumentation(docFiles, changedFiles)

    // Set outputs for other workflow steps to use
    if (errMsgs.length === 0) {
      core.setOutput('warnings', 'NO WARNINGS')
    } else {
      core.setOutput('warnings', 'DOC MIGHT NEED UPDATE OR TAGS ARE INVALID')
      // add a comment with the warnings to the PR
      await octokit.rest.issues.createComment({
        owner: owner,
        repo: repo,
        issue_number: pull_number,
        body: errMsgs
      })
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}
