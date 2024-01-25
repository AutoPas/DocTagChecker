/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import * as main from '../src/main'
import * as path from 'path'
import * as fs from 'fs'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock the GitHub Actions core library
let debugMock: jest.SpyInstance
let infoMock: jest.SpyInstance
let getInputMock: jest.SpyInstance
let setFailedMock: jest.SpyInstance

// Mock values
const userDocDir = '__tests__/testData/recursionStart/'
const docfiles = fs
  .readdirSync(userDocDir, {
    withFileTypes: true,
    recursive: true
  })
  .filter(f => f.isFile())
  .map(f => path.join(f.path, f.name))
const docfile = docfiles.find(s => s.includes('dummyDoc.md'))
const changedFile = 'src/utils.ts'

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
              data: [{ filename: changedFile }]
            }
          })
        },
        issues: {
          listComments: jest.fn().mockImplementation(() => {
            return {
              data: [
                {
                  user: {
                    login: 'user1'
                  },
                  body: 'body1',
                  id: 0
                },
                {
                  user: {
                    login: 'github-actions[bot]'
                  },
                  body: '# DocTagChecker\n\nLoremIpsum',
                  id: 1
                },
                { user: 'user2', body: 'body2', id: 2 }
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

    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    infoMock = jest.spyOn(core, 'info').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
  })

  it('run(): Valid input and full workflow', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'userDocsDirs':
          return userDocDir
        case 'githubToken':
          return 'leToken'
        case 'recurseUserDocDirs':
          return 'true'
        case 'srcFileExtensions':
          return 'ts,cpp  xyz'
        default:
          return ''
      }
    })

    await main.run()
    // Expect that the action has terminated gracefully.
    expect(runMock).toHaveReturned()
    // expect(setFailedMock).not.toHaveBeenCalled()
    // Expect input to be used.
    expect(getInputMock).toHaveBeenCalledWith('userDocsDirs')
    expect(getInputMock).toHaveBeenCalledWith('githubToken')
    expect(getInputMock).toHaveBeenCalledWith('recurseUserDocDirs')
    expect(getInputMock).toHaveBeenCalledWith('docFileExtensions')
    expect(getInputMock).toHaveBeenCalledWith('srcFileExtensions')
    expect(getInputMock).toHaveBeenCalledTimes(5)

    // Logs from run()
    expect(infoMock).toHaveBeenCalledWith(`User doc directories: ${userDocDir}`)
    expect(infoMock).toHaveBeenCalledWith(
      `Parse user doc directories recursively: true`
    )
    expect(infoMock).toHaveBeenCalledWith(`Doc file extensions: .md`)
    expect(infoMock).toHaveBeenCalledWith(
      `Source file extensions: .ts,.cpp,.xyz`
    )
    expect(infoMock).toHaveBeenCalledWith(`User doc files: ${docfiles}`)
    expect(infoMock).toHaveBeenCalledWith(`Changed files: ${changedFile}`)

    // Logs from checkDocumentation()
    const dummyDocFileTags = [
      'fakeName.cpp',
      'main.test.ts',
      'main.ts',
      'utils.ts'
    ]
    const dummyDocDirTags = [
      'fake/path/',
      'script/',
      '__tests__/testData/taggedFolder/'
    ]
    // 'dummyDoc.md' should not be in file tags because it has the wrong extension.
    // '__test__/' should not be in dir tags because it appears before 'Related files and folders'.
    expect(debugMock).toHaveBeenCalledWith(
      `Found tags in ${docfile}: | File Tags: ${dummyDocFileTags} | Directory Tags: ${dummyDocDirTags} |`
    )
    expect(debugMock).toHaveBeenCalledWith(
      `In ${docfile}, the following tags do not exist:\n${[
        // All tags containing 'fake' do not exist.
        dummyDocFileTags,
        dummyDocDirTags
      ].flatMap(tags => tags.filter(s => s.includes('fake')))}`
    )
    expect(debugMock).toHaveBeenCalledWith(
      `${docfile} is unchanged, but the following related files have changed. Check that the documentation is still up to date!\n${path.basename(
        changedFile
      )}`
    )
    expect(debugMock).toHaveBeenCalledWith(
      `Comment to delete: ${
        (await github.getOctokit('leToken').rest.issues.listComments()).data[1]
      }`
    )
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
