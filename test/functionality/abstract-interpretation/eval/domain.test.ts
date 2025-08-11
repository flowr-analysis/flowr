import { assert, describe, test } from "vitest";
import { type ConstantInterval, ConstantDomain, ConstantIntervalValue, Domain } from "../../../../src/abstract-interpretation/eval/domain"
import { assertSliced, withShell } from "../../_helper/shell";
import { label } from "../../_helper/label";

describe("Domain", withShell((shell) => {
  test("Constant Domain", () => {
    const domain: Domain<ConstantInterval> = new ConstantDomain()
    const result = domain.estimate(
      "paste",
      [
        { kind: "interval", value: "foo" },
        { kind: "interval", value: "bar" },
      ]
    )
    assert.equal(result.kind, "interval")
    assert.equal((result as ConstantIntervalValue).value, "foo bar")
  })

  assertSliced(
    label("paste in eval"),
    shell,
    `eval(parse(paste("x <- ", "5",sep="")));\n42`,
    ["2@42"],
    "42",
  )
}))
