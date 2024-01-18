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
    const dirs = core.getInput('userDocsDirs').split(/\s+/)
    core.info(`User doc directories: ${dirs}`)
    const baseBranch = process.env.GITHUB_BASE_REF
    core.info(`Base branch: ${baseBranch}`)
    const ghToken = core.getInput('githubToken')

    const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/')
    const pull_number = parseInt(
      (process.env.GITHUB_REF_NAME ?? '').split('/')[0],
      10
    )
    core.info(`pull_number: ${pull_number}`)
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
    console.log('------------------------')
    console.log(response)
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
