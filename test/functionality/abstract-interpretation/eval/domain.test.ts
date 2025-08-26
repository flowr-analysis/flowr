import { describe, test } from 'vitest';
import { Bottom, isBottom, isTop, SDValue, Top } from '../../../../src/abstract-interpretation/eval/domain';
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
})
