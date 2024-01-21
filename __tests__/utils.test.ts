/**
 * Unit tests for src/utils.ts
 */

import { findFileByName } from '../src/utils'
import { expect } from '@jest/globals'

describe('utils.ts', () => {
  it('Look for existing file', async () => {
    const haystack = '..'
    const needle = 'main.ts'
    const output = findFileByName(haystack, needle)

    expect(output).toBe('../DocTagChecker/src/main.ts')
  })

  it('Look for non-existing file', async () => {
    const haystack = '.'
    const needle = 'foo.bar'
    const output = findFileByName(haystack, needle)

    expect(output).toBeNull()
  })

  it('Start in non-existing dir', async () => {
    const haystack = 'foo/bar'
    const needle = 'foo.bar'
    // expect needs a function, not an function evocation
    expect(() => findFileByName(haystack, needle)).toThrow()
  })
})
