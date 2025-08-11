import { DataflowGraphVertexFunctionCall } from "../../dataflow/graph/vertex"

export type Interval<K extends String> = {
  kind: K
}

export interface Top {
  kind: "top"
}
export const Top: Top = { kind: "top" }

export interface Bottom {
  kind: "bottom"
}
export const Bottom: Bottom = { kind: "bottom" }

export type Interval<I> = Top | Bottom | I


type FnCall = DataflowGraphVertexFunctionCall

interface StringDomain<Interval> {
  assignment: (call: FnCall) => Interval
  paste: (call: FnCall) => Interval
}



export interface ConstantIntervalValue {
  kind: "interval",
  value: string
}

export type ConstantInterval = Top | Bottom | ConstantIntervalValue

export class ConstantDomain implements Domain<ConstantInterval> {
  estimate(operation: Operation, args: ConstantInterval[]): ConstantInterval {
    switch (operation) {
      case "paste":
        return args.reduce((l, r) => {
          if (l.kind === "top" || r.kind === "top") return Top
          if (l.kind === "bottom" || r.kind === "bottom") return Bottom
          return {
            kind: "interval",
            value: l.value + " " + r.value // TODO: paste separator is also an arg, cannot just
                                           // pass domain. "Real" R arguments need to be passed,
                                           // then each function can be handled correctly.
          }
        })
      
      default:
        throw new Error("Unknown Operator")
    }
  }
}
