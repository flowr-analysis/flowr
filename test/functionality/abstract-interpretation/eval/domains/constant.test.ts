import { describe, test } from 'vitest';
import { Lift, Top, Value } from '../../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';
import { Const, ConstDomain } from '../../../../../src/abstract-interpretation/eval/domains/constant';
import { ConcatNode, JoinNode, NodeId } from '../../../../../src/abstract-interpretation/eval/graph';

function konst(value: string): Lift<Const> {
  return {
    kind: "const",
    value,
  }
}

const makeDeps = (...values: Lift<Value>[]): Map<NodeId, any> => {
  return new Map(values.map((it, i) => [i, it]))
}

describe('Constant String Domain', () => {
  const domain = ConstDomain
  const foo = konst("foo")
  const bar = konst("bar")
  const foobar = konst("foobar")
  const sep = konst("sep")

  test("operation: const", () => {
    const value = domain.infer({ type: "const", value: "foobar" }, makeDeps())

    assert(value.kind === "const");
    assert(value.value === "foobar");
  })

  test("operation: concat (single value)", () => {
    let value = domain.infer({ type: "concat", params: [0], separator: 1 }, makeDeps(foo, sep))
    assert(value.kind === "const");
    assert(value.value === "foo");

    value = domain.infer({ type: "concat", params: [0], separator: 1 }, makeDeps(foo, Top))
    assert(value.kind === "const");
    assert(value.value === "foo");

    assert(domain.infer({ type: "concat", params: [0], separator: 1 }, makeDeps(Top, sep)).kind === "top")
  })

  test("operation: concat (multiple values)", () => {
    const concatNode: ConcatNode = { type: "concat", params: [0, 1], separator: 2 }

    const value = domain.infer(concatNode, makeDeps(foo, bar, sep))
    assert(value.kind === "const");
    assert(value.value === "foosepbar");

    assert(domain.infer(concatNode, makeDeps(Top, foo, bar)).kind === "top")
    assert(domain.infer(concatNode, makeDeps(foo, Top, bar)).kind === "top")
    assert(domain.infer(concatNode, makeDeps(foo, bar, Top)).kind === "top")
  })

  test("operation: join (single value)", () => {
    const value = domain.infer({ type: "join", params: [0] }, makeDeps(foobar))
    assert(value.kind === "const");
    assert(value.value === "foobar");

    assert(domain.infer({ type: "join", params: [0] }, makeDeps(Top)).kind === "top")
  })

  test("operation: join (multiple values)", () => {
    const joinNode: JoinNode = { type: "join", params: [0, 1]  }
    const value = domain.infer(joinNode, makeDeps(foo, foo))
    assert(value.kind === "const");
    assert(value.value === "foo");

    assert(domain.infer(joinNode, makeDeps(foo, bar)).kind === "top");
    assert(domain.infer(joinNode, makeDeps(foo, Top)).kind === "top");
    assert(domain.infer(joinNode, makeDeps(Top, foo)).kind === "top");
    assert(domain.infer(joinNode, makeDeps(Top, Top)).kind === "top");
  })
})
