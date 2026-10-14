import assert from 'node:assert/strict'
import test from 'node:test'
import { groupResponders } from '../demo/group-responders.ts'

const members = [{ id: 'a', name: 'Alice Chen' }, { id: 'b', name: 'Bob' }, { id: 'c', name: '尼采課' }]

test('demo fallback matches the host for main, owned and orphaned threads', () => {
  assert.deepEqual(groupResponders(members, 'continue'), ['a', 'b', 'c'])
  assert.deepEqual(groupResponders(members, 'continue', 'b'), ['b'])
  assert.deepEqual(groupResponders(members, 'continue', 'user'), ['a', 'b', 'c'])
  assert.deepEqual(groupResponders(members, 'continue', 'departed'), ['a', 'b', 'c'])
  assert.deepEqual(groupResponders([], 'continue', 'b'), [])
})

test('mentions override the thread owner with the same host handle boundaries', () => {
  for (const text of ['@Alice Chen', '@alicechen', '@ALICE']) {
    assert.deepEqual(groupResponders(members, text, 'b'), ['a'])
  }
  assert.deepEqual(groupResponders(members, '@尼采課幫我整理', 'b'), ['c'])
  assert.deepEqual(groupResponders(members, '@bobby @bob2 @bob_1', 'a'), ['a'])
  assert.deepEqual(groupResponders(members, '@bobby, then @bob!', 'a'), ['b'])
  assert.deepEqual(groupResponders(members, '@Alice @bob', 'c'), ['a', 'b'])
})

test('all and everyone override both explicit mentions and the thread owner', () => {
  for (const text of ['@ALL', '@everyone', '@bob and @all']) {
    assert.deepEqual(groupResponders(members, text, 'b'), ['a', 'b', 'c'])
  }
  assert.deepEqual(groupResponders(members, '@alligator @everyone_else', 'b'), ['b'])
})

test('names with regex punctuation are matched literally', () => {
  const roster = [{ id: 'a', name: 'A+B' }, { id: 'b', name: 'Other' }]
  assert.deepEqual(groupResponders(roster, '@A+B', 'b'), ['a'])
  assert.deepEqual(groupResponders(roster, '@AAAB', 'b'), ['b'])
})
