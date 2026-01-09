import { Domain, Lift, Top, Value } from '../../../../../src/abstract-interpretation/eval/domain';
import { CasingNode, NodeId } from '../../../../../src/abstract-interpretation/eval/graph';

export class NodeEvaluator<T extends Value> {
  private domain: Domain<T>
  
  constructor(domain: Domain<T>) {
    this.domain = domain
  }

  const(value: string) {
    return this.domain.infer({ type: "const", value }, new Map())
  }

  alias(value: Lift<T>) {
    return this.domain.infer({ type: "alias", to: 0 }, new Map([[0, value]]))
  }

  concat(sep: Lift<T>, ...values: Lift<T>[]) {
    return this.domain.infer(
      { type: "concat", params: values.map((_, i) => i), separator: values.length },
      new Map([...values.map((it, i) => [i, it] as [NodeId, Lift<T>]), [values.length, sep]])
    )
  }

  join(...values: Lift<T>[]) {
    return this.domain.infer(
      { type: "join", params: values.map((_, i) => i) },
      new Map(values.map((it, i) => [i, it] as [NodeId, Lift<T>]))
    )
  }

  function(name: string, positional: Lift<T>[], named: [string, Lift<T>][]) {
    return this.domain.infer(
      { type: "function", name, positional: positional.map((_, i) => `p${i}`), named: named.map((it, i) => [it[0], `n${i}`]) },
      new Map([
        ...positional.map((it, i) => [`p${i}`, it] as [string, Lift<T>]),
        ...named.map((it, i) => [`n${i}`, it[1]] as [string, Lift<T>])
      ]),
    )
  }

  casing(to: CasingNode["to"], value: Lift<T>) {
    return this.domain.infer({ type: "casing", to, value: 0 }, new Map([[0, value]]))
  }

  implicit(...reprs: string[]) {
    return this.domain.infer({ type: "implicit-conversion", of: 0, value: reprs }, new Map([[0, Top]]))
  }

  unknown() {
    return this.domain.infer({ type: "unknown" }, new Map())
  }
}
