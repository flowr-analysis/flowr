import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'
import { overwriteEnvironments, popLocalEnvironment } from '../../../environments'
import { linkInputs } from '../../linker'
import { dataflowLogger } from '../../../index'
import { ParentInformation, RFunctionDefinition } from '../../../../r-bridge'

export function processFunctionDefinition<OtherInfo>(functionDefinition: RFunctionDefinition<OtherInfo & ParentInformation>, args: DataflowInformation<OtherInfo>[], body: DataflowInformation<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  dataflowLogger.trace(`Processing function definition with id ${functionDefinition.info.id}`)
  // as we know, that parameters can not duplicate, we overwrite their environments (which is the correct behavior, if someone uses non-`=` arguments in functions)
  const argsEnvironment = args.map(a => a.environments).reduce((a, b) => overwriteEnvironments(a, b), down.environments)
  const bodyEnvironment = body.environments

  // TODO: count parameter a=b as assignment!
  const readInArguments = args.flatMap(a => [...a.in, ...a.activeNodes])
  const readInBody = [...body.in, ...body.activeNodes]
  // there is no uncertainty regarding the arguments, as if a function header is executed, so is its body
  const remainingRead = linkInputs(readInBody, down.activeScope, argsEnvironment, readInArguments.slice(), body.graph, true /* functions do not have to be called */)

  dataflowLogger.trace(`Function definition with id ${functionDefinition.info.id} has ${remainingRead.length} remaining reads (of ids [${remainingRead.map(r => r.nodeId).join(', ')}])`)

  const outEnvironment = overwriteEnvironments(argsEnvironment, bodyEnvironment)
  const outGraph = body.graph.mergeWith(...args.map(a => a.graph))
  // all nodes in the function graph are maybe as functions do not have to be executed
  for(const [_, node] of outGraph.entries()) {
    node.when = 'maybe'
  }
  // TODO: deal with function info
  // TODO: rest
  return {
    activeNodes:  [],
    in:           remainingRead,
    out:          [] /* nothing escapes a function definition */,
    graph:        outGraph,
    environments: popLocalEnvironment(outEnvironment),
    ast:          down.ast,
    scope:        down.activeScope
  }
}
