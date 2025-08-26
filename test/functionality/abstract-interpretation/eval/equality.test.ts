import { describe, test } from 'vitest';
import { sdEqual } from '../../../../src/abstract-interpretation/eval/equality';
import { assert } from 'ts-essentials/dist/functions/assert';
import { Bottom, SDValue, Top } from '../../../../src/abstract-interpretation/eval/domain';

describe('String Domain Equality', () => {
  const values: (SDValue | undefined)[] = [
    undefined,
    Top,
    Bottom,
    { kind: "const", value: "foobar" },
    { kind: "const", value: "barfoo" },
    { kind: "const-set", value: ["foo"] },
    { kind: "const-set", value: ["foo", "bar"] },
  ];

  const allPossibleCombinations = values.flatMap(l =>
    values.map((r): [SDValue | undefined, SDValue | undefined] => [l, r])
  )

  test.each(allPossibleCombinations)("symmetry %j + %j", (l, r) => {
    // a => b <=> !a || b
    assert(!sdEqual(l, r) || sdEqual(r, l))
  })

  test.each(values)("identity %j", (value) => {
    assert(sdEqual(value, value))
  })

  test("undefined", () => {
    assert(!sdEqual(undefined, Top))
    assert(!sdEqual(undefined, { kind: "const", value: "foobar" }))
  })

  test("top", () => {
    assert(!sdEqual(Top, { kind: "const", value: "foobar" }))
    assert(!sdEqual(Top, Bottom))
  })

  test("bottom", () => {
    assert(!sdEqual(Bottom, { kind: "const", value: "foobar" }))
  })

  test("const", () => {
    assert(!sdEqual({kind: "const", value: "foo"}, { kind: "const", value: "bar" }))
    assert(!sdEqual({kind: "const", value: "foo"}, { kind: "const-set", value: ["foo"] }))
  })

  test("const-set", () => {
    assert(sdEqual({kind: "const-set", value: ["foo", "bar"]}, { kind: "const-set", value: ["bar", "foo"] }))
    assert(!sdEqual({kind: "const-set", value: ["foo"]}, { kind: "const-set", value: ["bar"] }))
  })
})
