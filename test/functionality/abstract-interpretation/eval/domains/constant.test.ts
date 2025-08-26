import { describe, test } from 'vitest';
import { Bottom, SDValue, Top } from '../../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';
import { ConstStringDomain, isConst } from '../../../../../src/abstract-interpretation/eval/domains/constant';

function konst(value: string): SDValue {
  return {
    kind: "const",
    value,
  }
}

describe('Constant String Domain', () => {
  const domain = new ConstStringDomain();
  const foo = konst("foo")
  const bar = konst("bar")
  const foobar = konst("foobar")
  const sep = konst("sep")
  
  test("isConst", () => {
    const constValue: SDValue = {
      kind: "const",
      value: "foobar",
    };
    
    const constSetValue: SDValue = {
      kind: "const-set",
      value: ["foobar"],
    };

    assert(isConst(constValue));
    assert(!isConst(constSetValue));
    assert(!isConst(Top));
    assert(!isConst(Bottom));
  })

  test("operation: const", () => {
    const value = domain.const("foobar");

    assert(value.kind === "const");
    assert(value.value === "foobar");
  })

  test("operation: concat (single value)", () => {
    let value = domain.concat(sep, foobar);
    assert(value.kind === "const");
    assert(value.value === "foobar");

    value = domain.concat(Top, foobar);
    assert(value.kind === "const");
    assert(value.value === "foobar");

    assert(domain.concat(sep, Top).kind === "top");
  })

  test("operation: concat (multiple values)", () => {
    const value = domain.concat(sep, foo, bar);
    assert(value.kind === "const");
    assert(value.value === "foosepbar");

    assert(domain.concat(Top, foo, bar).kind === "top")
    assert(domain.concat(sep, Top, bar).kind === "top")
    assert(domain.concat(sep, foo, Top).kind === "top")
  })

  test("operation: join (single value)", () => {
    const value = domain.join(foobar);
    assert(value.kind === "const");
    assert(value.value === "foobar");

    assert(domain.join(Top).kind === "top");
  })

  test("operation: join (multiple values)", () => {
    const value = domain.join(foo, foo);
    assert(value.kind === "const");
    assert(value.value === "foo");

    assert(domain.join(foo, bar).kind === "top");
    assert(domain.join(foo, Top).kind === "top");
    assert(domain.join(Top, foo).kind === "top");
    assert(domain.join(Top, Top).kind === "top");
  })
})
