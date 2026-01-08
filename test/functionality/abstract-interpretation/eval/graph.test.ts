import { assert, describe, test } from 'vitest';
import { ConstNode, Graph } from '../../../../src/abstract-interpretation/eval/graph';
import { ConstDomain } from '../../../../src/abstract-interpretation/eval/domains/constant';

describe("string-domain-graph", () => {
  test("node persistence", () => {
    const g = new Graph()
    assert(!g.hasNode(0))
    const node: ConstNode = {
      type: "const",
      value: "test",
    }
    const nid = g.insertNode(0, node)
    assert(g.hasNode(nid))
    assert(g.nodes().get(nid) === node)
  })

  test("node removal", () => {
    const g = new Graph()
    const nid = g.insertNode(0, {
      type: "const",
      value: "test",
    })
    assert(g.hasNode(nid))
    g.removeNode(nid)
    assert(!g.hasNode(nid))
  })

  test("node dependencies", () => {
    const g = new Graph()
    const konst = (value: string): ConstNode => ({ type: "const", value })

    const n0 = g.insertNode(0, konst("foo"))
    const n1 = g.insertNode(1, konst("bar"))
    const n2 = g.insertNode(2, { type: "alias", to: n1 })
    const n3 = g.insertNode(3, { type: "concat", params: [n0, n1], separator: n2 })

    assert(g.depsOf(n0).size === 0)
    assert(g.depsOf(n1).size === 0)
    assert(g.depsOf(n2).size === 1 && g.depsOf(n2).isSubsetOf(new Set([n1])))
    assert(g.depsOf(n3).size === 3 && g.depsOf(n3).isSubsetOf(new Set([n0, n1, n2])))
  })

  test("node reverse dependencies", () => {
    const g = new Graph()
    const konst = (value: string): ConstNode => ({ type: "const", value })

    const n0 = g.insertNode(0, konst("foo"))
    const n1 = g.insertNode(1, konst("bar"))
    const n2 = g.insertNode(2, { type: "alias", to: n1 })
    const n3 = g.insertNode(3, { type: "concat", params: [n0, n1], separator: n2 })

    assert(g.havingDep(n0).size === 1 && g.havingDep(n0).isSubsetOf(new Set([n3])))
    assert(g.havingDep(n1).size === 2 && g.havingDep(n1).isSubsetOf(new Set([n2, n3])))
    assert(g.havingDep(n2).size === 1 && g.havingDep(n2).isSubsetOf(new Set([n3])))
    assert(g.havingDep(n3).size === 0)
  })

  test("inference (const)", () => {
    const g = new Graph()
    const nid = g.insertNode(0, {
      type: "const",
      value: "test",
    })
    const values = g.inferValues(ConstDomain)
    const value = values.get(nid)
    assert(value !== undefined)
    assert(value.kind === "const")
    assert(value.value === "test")
  })

  test("inference (concat)", () => {
    const g = new Graph()

    const n1 = g.insertNode(0, {
      type: "const",
      value: "foo",
    })
    const n2 = g.insertNode(1, {
      type: "const",
      value: "bar",
    })
    const n3 = g.insertNode(2, {
      type: "concat",
      params: [n1, n2],
      separator: g.insertNode(3, { type: "const", value: "," })
    })

    const values = g.inferValues(ConstDomain)
    const value = values.get(n3)
    assert(value !== undefined)
    assert(value.kind === "const")
    assert(value.value === "foo,bar")
  })

  test("inference (recursive)", () => {
    const g = new Graph()

    const n = g.insertNode(0, {
      type: "concat",
      params: [g.insertNode(1, { type: "const", value: "foo" }), 0],
      separator: g.insertNode(2, { type: "const", value: "" }),
    })

    const values = g.inferValues(ConstDomain)
    const value = values.get(n)
    assert(value !== undefined)
    assert(value.kind === "top")
  })
})

