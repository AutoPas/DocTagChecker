/**
 * Unit tests for src/utils.ts
 */

import {
  getUrlToFile,
  getUrlToChanges,
  findFileByName,
  assertNonNull
} from '../src/utils'
import * as github from '@actions/github'
import { expect } from '@jest/globals'

describe('utils.ts context independent', () => {
  // Tests for findFileByName()
  it('findFileByName(): Look for existing file', async () => {
    const haystack = '..'
    const needle = 'main.ts'
    const output = findFileByName(haystack, needle)

    expect(output).toBe('../DocTagChecker/src/main.ts')
  })

  it('findFileByName(): Look for non-existing file', async () => {
    const haystack = '.'
    const needle = 'foo.bar'
    const output = findFileByName(haystack, needle)

    expect(output).toBeNull()
  })

  it('findFileByName(): Start in non-existing dir', async () => {
    const haystack = 'foo/bar'
    const needle = 'foo.bar'
    // expect needs a function, not an function evocation
    expect(() => findFileByName(haystack, needle)).toThrow()
  })

  // Tests for assertNonNull()
  it('assertNonNull(): Good values', async () => {
    {
      const source: string | undefined = 'abc'
      const target: string = assertNonNull(source)
      expect(target).toBe(source)
    }
    {
      const source: number | undefined = 42
      const target: number = assertNonNull(source)
      expect(target).toBe(source)
    }
    {
      const source: boolean | null = true
      const target: boolean = assertNonNull(source)
      expect(target).toBe(source)
    }
  })
  it('assertNonNull(): Bad values', async () => {
    {
      const source: string | undefined = undefined
      expect(() => assertNonNull(source)).toThrow()
    }
    {
      const source: number | null = null
      expect(() => assertNonNull(source)).toThrow()
    }
  })
})

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
  getOctokit: jest.fn()
}))

describe('utils.ts context dependent', () => {
  beforeEach(async () => {
    // Clear all mock function calls and reset mock implementation
    jest.clearAllMocks()
  })

  // Tests for getUrlToFile()
  it('getUrlToFile(): Test URL builder', () => {
    // Test value
    const filePath = 'mock/path.lol'

    // Expected URL based on the mocked values
    const expectedUrl = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/blob/${github.context.sha}/${filePath}`

    // Calling the function and testing the result
    const result = getUrlToFile(filePath)
    expect(result).toBe(expectedUrl)
  })

  it('getUrlToChanges(): Test URL builder', () => {
    // Test value
    const filePath = 'mock/path.lol'
    // Computed in bash via
    // echo -n mock/path.lol | sha256sum
    const filePathHash =
      'ee6a878745ced544a2a8900685af1dbd9ddd5c775f980dd212bfd527ac6ab32b'

    const errorString = 'fail'
    const expectedUrl =
      `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/pull/${github.context.payload.pull_request?.number}/files#diff-${filePathHash}` ??
      errorString

    expect(expectedUrl).not.toBe(errorString)

    // Calling the function and testing the result
    const result = getUrlToChanges(filePath)
    expect(result).toBe(expectedUrl)
  })

  it('getUrlToChanges(): Test missing PR number', () => {
    // Test value
    const filePath = 'mock/path.lol'

    // Change the mock value, because according to the specification this state is possible.
    github.context.payload.pull_request = undefined

    // Calling the function with this context should throw an error.
    expect(() => getUrlToChanges(filePath)).toThrow()
  })
})
