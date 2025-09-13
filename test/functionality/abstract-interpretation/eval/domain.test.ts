import { describe, test } from 'vitest';
import { Bottom, isBottom, isElement, isTop, SDValue, Top } from '../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';

describe("String Domain", () => {
  test("isTop", () => {
    const topValue = Top;
    const constValue: SDValue = {
      kind: "const",
      value: "foobar",
    };
    
    assert(isTop(topValue));
    assert(!isTop(constValue));
  })

  test("isBottom", () => {
    const bottomValue = Bottom;
    const constValue: SDValue = {
      kind: "const",
      value: "foobar",
    };
    
    assert(isBottom(bottomValue));
    assert(!isBottom(constValue));
  })


  const isElementCases: [string, SDValue, boolean][] = [
    ["foo", Top, true],
    ["foo", Bottom, false],
    ["foo", { kind: 'const', value: 'foo' }, true],
    ["foo", { kind: 'const', value: 'bar' }, false],
    ["foo", { kind: 'const-set', value: ['foo'] }, true],
    ["foo", { kind: 'const-set', value: ['foo', 'bar'] }, true],
    ["foo", { kind: 'const-set', value: ['bar'] }, false],
  ];

  test.each(isElementCases)('isElement(%s, %o) == %d', (value, domainValue, expected) => {
    assert(isElement(value, domainValue) === expected);
  })
})
