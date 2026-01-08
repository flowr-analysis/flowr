import { describe, test } from 'vitest';
import { Bottom, Lift, Top, Value } from '../../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';
import { ConstSet, ConstSetDomain, MAX_VARIANTS } from '../../../../../src/abstract-interpretation/eval/domains/constant-set';
import { ConcatNode, JoinNode, NodeId } from '../../../../../src/abstract-interpretation/eval/graph';

function v(...value: string[]): Lift<ConstSet> {
  return {
    kind: "const-set",
    value,
  }
}

function arreq<T>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) return false;

  while (left.length > 0) {
    const value = left.pop()!;
    const index = right.findIndex(it => it === value);
    if (index === -1) return false;
    else right.splice(index, 1)
  }

  return true;
}

const makeDeps = (...values: Lift<Value>[]): Map<NodeId, any> => {
  return new Map(values.map((it, i) => [i, it]))
}

describe('Constant Set String Domain', () => {
  const domain = ConstSetDomain;

  test("operation: const", () => {
    const value = domain.infer({ type: "const", value: "foobar" }, makeDeps());

    assert(value.kind === "const-set");
    assert(value.value.length === 1);
    assert(value.value[0] === "foobar");
  })

  test("operation: concat (single value)", () => {
    let value = domain.infer({ type: "concat", params: [0], separator: 1 }, makeDeps(v("foo", "bar"), v("sep", ",")));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo", "bar"]));

    value = domain.infer({ type: "concat", params: [0], separator: 1 }, makeDeps(v("foo", "bar"), Top));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo", "bar"]));

    assert(domain.infer({ type: "concat", params: [0], separator: 1 }, makeDeps(Top, v("sep", ","))).kind === "top");
  })

  test("operation: concat (multiple values)", () => {
    const concatNode: ConcatNode = { type: "concat", params: [1, 2], separator: 0 }

    const value = domain.infer(concatNode, makeDeps(v("sep", ","), v("foo", "lux"), v("bar", "baz")));
    assert(value.kind === "const-set");
    assert(arreq(value.value, [
      "foosepbar",
      "luxsepbar",
      "foo,bar",
      "lux,bar",
      "foosepbaz",
      "luxsepbaz",
      "foo,baz",
      "lux,baz",
    ]));

    assert(domain.infer(concatNode, makeDeps(Top, v("foo"), v("bar"))).kind === "top")
    assert(domain.infer(concatNode, makeDeps(v("sep"), Top, v("bar"))).kind === "top")
    assert(domain.infer(concatNode, makeDeps(v("sep"), v("foo"), Top)).kind === "top")
  })

  test("operation: join (single value)", () => {
    const value = domain.infer({ type: "join", params: [0] }, makeDeps(v("foo", "bar")));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo", "bar"]));

    assert(domain.infer({ type: "join", params: [0] }, makeDeps(Top)).kind === "top");
  })

  test("operation: join (multiple values)", () => {
    const joinNode: JoinNode = {
      type: "join",
      params: [0, 1]
    }

    let value = domain.infer(joinNode, makeDeps(v("foo"), v("bar")));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo", "bar"]));

    value = domain.infer(joinNode, makeDeps(v("foo", "bar"), v("42", "64")));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo", "bar", "42", "64"]));

    assert(domain.infer(joinNode, makeDeps(v("foo"), Top)).kind === "top");
    assert(domain.infer(joinNode, makeDeps(Top, v("foo"))).kind === "top");
    assert(domain.infer(joinNode, makeDeps(Top, Top)).kind === "top");
  })

  test("operation: join (duplicate values)", () => {
    const joinNode: JoinNode = {
      type: "join",
      params: [0, 1]
    }

    let value = domain.infer(joinNode, makeDeps(v("foo"), v("foo")));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo"]));

    value = domain.infer(joinNode, makeDeps(v("foo", "bar"), v("foo")));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo", "bar"]));
  })

  test("operation: join (upper limit)", () => {
    let values: Value[] = [];
    for (let i = 0; i < MAX_VARIANTS + 1; i++) {
      values.push(v(`${i}`))
    }

    assert(domain.infer({ type: "join", params: values.map((_, i) => i) }, makeDeps(...values)).kind === "top");
  })
})

