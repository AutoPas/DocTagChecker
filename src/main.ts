import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Get directories as arrays. Split at any amount of white space characters.
    const dirs: string[] = core.getInput('userDocsDirs').split(/\s+/)
    core.info(`User doc directories: ${dirs}`)

    const baseBranch: string = core.getInput('baseBranch')
    core.info(`Base branch: ${baseBranch}`)

    // Set outputs for other workflow steps to use
    core.setOutput('warnings', "NO WARNINGS")

  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
