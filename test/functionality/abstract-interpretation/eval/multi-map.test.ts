import { assert, describe, test } from 'vitest';
import { MultiMap } from '../../../../src/abstract-interpretation/eval/multi-map';

describe("dbe: MultiMap", () => {
  test("insert-has", () => {
    const m = new MultiMap()
    m.insert("foo", "bar")
    assert(m.has("foo", "bar"))
    assert(!m.has("foo", "test"))
  })

  test("get", () => {
    const m = new MultiMap()
    m.insert("foo", "bar")
    const values = m.get("foo")
    assert(values.size === 1)
    assert(values.has("bar"))
  })

  test("insert multiple same values", () => {
    const m = new MultiMap()
    m.insert("foo", "bar")
    m.insert("foo", "bar")
    const values = m.get("foo")
    assert(values.size === 1)
    assert(values.has("bar"))
  })

  test("remove", () => {
    const m = new MultiMap()

    m.insert("foo", "bar")
    assert(m.get("foo").size === 1)
    m.remove("foo", "bar")
    assert(m.get("foo").size === 0)

    m.insert("foo", "bar")
    m.insert("foo", "test")
    assert(m.get("foo").size === 2)
    m.remove("foo")
    assert(m.get("foo").size === 0)
  })
})
