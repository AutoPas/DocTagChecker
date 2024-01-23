/**
 * Unit tests for src/utils.ts
 */

import { findFileByName, assertNonNull } from '../src/utils'
import { expect } from '@jest/globals'

describe('utils.ts', () => {
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
