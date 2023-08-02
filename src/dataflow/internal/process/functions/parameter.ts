import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { define, IdentifierDefinition } from '../../../environments'
import { LocalScope } from '../../../graph'
import { ParentInformation, RParameter, Type } from '../../../../r-bridge'
import { log } from '../../../../util/log'

export function processFunctionParameter<OtherInfo>(parameter: RParameter<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const name = processDataflowFor(parameter.name, data)
  const defaultValue = parameter.defaultValue === undefined ? undefined : processDataflowFor(parameter.defaultValue, data)
  const graph = defaultValue !== undefined ? name.graph.mergeWith(defaultValue.graph) : name.graph

  const writtenNodes: IdentifierDefinition[] = name.activeNodes.map(n => ({
    ...n,
    kind:      'parameter',
    used:      'always',
    definedAt: parameter.info.id,
    scope:     LocalScope
  }))

  let environments = name.environments
  for(const writtenNode of writtenNodes) {
    log.trace(`parameter ${writtenNode.name} (${writtenNode.nodeId}) is defined at id ${writtenNode.definedAt} with ${defaultValue === undefined ? 'no default value' : ' no default value'}`)
    graph.setDefinitionOfNode(writtenNode)
    environments = define(writtenNode, LocalScope, environments)

    if(defaultValue !== undefined) {
      if(parameter.defaultValue?.type === Type.FunctionDefinition) {
        graph.addEdge(writtenNode, parameter.defaultValue.info.id, 'defined-by', 'maybe' /* default arguments can be overridden! */)
      } else {
        const definedBy = [...defaultValue.in, ...defaultValue.activeNodes]
        for (const node of definedBy) {
          graph.addEdge(writtenNode, node, 'defined-by', 'maybe' /* default arguments can be overridden! */)
        }
      }
    }
  }

  return {
    activeNodes:  [],
    in:           defaultValue === undefined ? [] : [...defaultValue.in, ...defaultValue.activeNodes, ...name.in],
    out:          [...(defaultValue?.out ?? []), ...name.out, ...name.activeNodes],
    graph:        graph,
    environments: environments, // TODO: merge with arguments
    ast:          data.completeAst,
    scope:        data.activeScope
  }
}
