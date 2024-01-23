/**
 * Unit tests for src/utils.ts
 */

import { findFileByName, assertValue } from '../src/utils'
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

  // Tests for assertValue()
  it('assertValue(): Good values', async () => {
    {
      const source: string | undefined = 'abc'
      const target: string = assertValue(source)
      expect(target).toBe(source as string)
    }
    {
      const source: number | undefined = 42
      const target: number = assertValue(source)
      expect(target).toBe(source as number)
    }
    {
      const source: boolean | null = true
      const target: boolean = assertValue(source)
      expect(target).toBe(source as boolean)
    }
  })
  it('assertValue(): Bad values', async () => {
    {
      const source: string | undefined = undefined
      expect(() => assertValue(source)).toThrow()
    }
    {
      const source: number | null = null
      expect(() => assertValue(source)).toThrow()
    }
  })
})
