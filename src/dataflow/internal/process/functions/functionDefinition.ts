import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'
import { overwriteEnvironments, popLocalEnvironment } from '../../../environments'
import { linkInputs } from '../../linker'

export function processFunctionDefinition<OtherInfo>(functionCall: unknown, args: DataflowInformation<OtherInfo>[], body: DataflowInformation<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  // as we know, that parameters can not duplicate, we overwrite their environments (which is the correct behavior, if someone uses non-`=` arguments in functions)
  const argsEnvironment = args.map(a => a.environments).reduce((a, b) => overwriteEnvironments(a, b), down.environments)
  const bodyEnvironment = body.environments

  // TODO: count parameter a=b as assignment!
  const readInArguments = args.flatMap(a => [...a.in, ...a.activeNodes])
  const readInBody = [...body.in, ...body.activeNodes]
  // there is no uncertainty regarding the arguments, as if a function header is executed, so is its body
  linkInputs(readInBody, down.activeScope, argsEnvironment, readInArguments.slice(), body.graph, false)

  const outEnvironment = overwriteEnvironments(argsEnvironment, bodyEnvironment)
  const outGraph = body.graph.mergeWith(...args.map(a => a.graph))

  // TODO: deal with function info
  // TODO rest
  return {
    activeNodes:  [],
    in:           readInArguments,
    out:          args.flatMap(a => a.out),
    graph:        outGraph,
    environments: popLocalEnvironment(outEnvironment),
    ast:          down.ast,
    scope:        down.activeScope
  }
}
