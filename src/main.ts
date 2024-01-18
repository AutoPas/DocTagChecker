import * as core from '@actions/core'
// import * as exec from '@actions/exec'
import * as github from '@actions/github'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  core.info(`START`)
  try {
    // Input parsing
    // Get directories as arrays. Split at any amount of white space characters.
    const dirs: string[] = core.getInput('userDocsDirs').split(/\s+/)
    core.info(`User doc directories: ${dirs}`)
    const baseBranch: string = core.getInput('baseBranch')
    core.info(`Base branch: ${baseBranch}`)
    // const ghToken: string = core.getInput('githubToken')
    core.info('--------------------------------')
    core.info(`${process.env}`)
    core.info('--------------------------------')

    const ghToken = process.env.GITHUB_TOKEN
    const owner = (process.env.GITHUB_REPOSITORY ?? '').split('/')[0]
    const repo = (process.env.GITHUB_REPOSITORY ?? '').split('/')[1]
    core.info(`process.env.GITHUB_REPOSITORY: ${process.env.GITHUB_REPOSITORY}`)
    const pull_number = parseInt(
      process.env.GITHUB_PULL_REQUEST_NUMBER ?? '-1',
      10
    )
    core.info(
      `process.env.GITHUB_PULL_REQUEST_NUMBER: ${process.env.GITHUB_PULL_REQUEST_NUMBER}`
    )
    core.info(`process.env: ${process.env}`)
    console.log(process.env)
    if (ghToken === undefined) {
      core.info(`ghToken === undefined. Aborting`)
      return
    }
    const octokit = github.getOctokit(ghToken)
    core.info(`FOOO 11`)
    // Get the list of changed files in the pull request
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number
    })
    // Extract file names from the response
    const changedFiles = response.data.map(file => file.filename)
    core.info(`changed files: ${changedFiles}`)

    // Set outputs for other workflow steps to use
    core.setOutput('warnings', 'NO WARNINGS')
  } catch (error) {
    core.info(`CATCH 1`)
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
  core.info(`DONE`)
}
