import { describe, test } from 'vitest';
import { Bottom, SDValue, Top } from '../../../../../src/abstract-interpretation/eval/domain';
import { assert } from 'ts-essentials';
import { ConstSetStringDomain, isConstSet } from '../../../../../src/abstract-interpretation/eval/domains/constant-set';

function v(...value: string[]): SDValue {
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

describe('Constant Set String Domain', () => {
  const domain = new ConstSetStringDomain();
  
  test("isConstset", () => {
    const constSetValue: SDValue = {
      kind: "const-set",
      value: ["foobar"],
    };

    const constValue: SDValue = {
      kind: "const",
      value: "foobar",
    };
    
    assert(isConstSet(constSetValue));
    assert(!isConstSet(constValue));
    assert(!isConstSet(Top));
    assert(!isConstSet(Bottom));
  })

  test("operation: const", () => {
    const value = domain.const("foobar");

    assert(value.kind === "const-set");
    assert(value.value.length === 1);
    assert(value.value[0] === "foobar");
  })

  test("operation: concat (single value)", () => {
    let value = domain.concat(v("sep", ","), v("foo", "bar"));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo", "bar"]));

    value = domain.concat(Top, v("foo", "bar"));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo", "bar"]));

    assert(domain.concat(v("sep", ","), Top).kind === "top");
  })

  test("operation: concat (multiple values)", () => {
    const value = domain.concat(v("sep", ","), v("foo", "lux"), v("bar", "baz"));
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

    assert(domain.concat(Top, v("foo"), v("bar")).kind === "top")
    assert(domain.concat(v("sep"), Top, v("bar")).kind === "top")
    assert(domain.concat(v("sep"), v("foo"), Top).kind === "top")
  })

  test("operation: join (single value)", () => {
    const value = domain.join(v("foo", "bar"));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo", "bar"]));

    assert(domain.join(Top).kind === "top");
  })

  test("operation: join (multiple values)", () => {
    let value = domain.join(v("foo"), v("bar"));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo", "bar"]));

    value = domain.join(v("foo", "bar"), v("42", "64"));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo", "bar", "42", "64"]));

    assert(domain.join(v("foo"), Top).kind === "top");
    assert(domain.join(Top, v("foo")).kind === "top");
    assert(domain.join(Top, Top).kind === "top");
  })

  test("operation: join (duplicate values)", () => {
    let value = domain.join(v("foo"), v("foo"));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo"]));

    value = domain.join(v("foo", "bar"), v("foo"));
    assert(value.kind === "const-set");
    assert(arreq(value.value, ["foo", "bar"]));
  })

  test("operation: join (upper limit)", () => {
    let values: SDValue[] = [];
    for (let i = 0; i < domain.MAX_VARIANTS + 1; i++) {
      values.push(v(`${i}`))
    }

    assert(domain.join(...values).kind === "top");
  })
})

