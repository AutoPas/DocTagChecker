/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
// import * as github from '@actions/github'
import * as main from '../src/main'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock the GitHub Actions core library
// let debugMock: jest.SpyInstance
// let errorMock: jest.SpyInstance
let getInputMock: jest.SpyInstance
let setFailedMock: jest.SpyInstance
// let setOutputMock: jest.SpyInstance

// Mock the github context
jest.mock('@actions/github', () => ({
  context: {
    payload: {
      pull_request: {
        number: 123
      }
    },
    repo: {
      owner: 'mockOwner',
      repo: 'mockRepo'
    },
    sha: 'mockSha'
  },
  getOctokit: jest.fn().mockImplementation(() => {
    return {
      rest: {
        pulls: {
          // list of files that have changed
          listFiles: jest.fn().mockImplementation(() => {
            return {
              data: [{ filename: 'src/utils.ts' }]
            }
          })
        },
        issues: {
          listComments: jest.fn().mockImplementation(() => {
            return {
              data: [
                { user: 'user1', body: 'body1', id: 0 },
                { user: 'user2', body: 'body2', id: 1 }
              ]
            }
          }),
          deleteComment: jest.fn(),
          createComment: jest.fn()
        }
      }
    }
  })
}))

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // debugMock = jest.spyOn(core, 'debug').mockImplementation()
    // errorMock = jest.spyOn(core, 'error').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    // setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
  })

  it('run(): Valid input and full workflow', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'userDocsDirs':
          return '__tests__/'
        case 'githubToken':
          return 'leToken'
        default:
          return ''
      }
    })

    await main.run()
    // Expect that the action has terminated gracefully.
    expect(runMock).toHaveReturned()
    expect(setFailedMock).not.toHaveBeenCalled()
    // Expect input to be used.
    expect(getInputMock).toHaveBeenCalledWith('userDocsDirs')
    expect(getInputMock).toHaveBeenCalledWith('githubToken')
    expect(getInputMock).toHaveBeenCalledTimes(2)

    // TODO: lots of expectation

    // Verify that all of the core library functions were called correctly
    // expect(debugMock).toHaveBeenNthCalledWith(1, 'Waiting 500 milliseconds ...')
    // expect(debugMock).toHaveBeenNthCalledWith(
    //   2,
    //   expect.stringMatching(timeRegex)
    // )
    // expect(debugMock).toHaveBeenNthCalledWith(
    //   3,
    //   expect.stringMatching(timeRegex)
    // )
    // expect(setOutputMock).toHaveBeenNthCalledWith(
    //   1,
    //   'time',
    //   expect.stringMatching(timeRegex)
    // )
  })

  it('run(): Invalid action input', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'userDocsDirs':
          return 'this/is/fake/'
        case 'githubToken':
          return ''
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(setFailedMock).toHaveBeenCalled()
  })
})
