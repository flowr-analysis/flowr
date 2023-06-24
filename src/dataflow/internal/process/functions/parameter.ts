import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { define, IdentifierDefinition } from '../../../environments'
import { LocalScope } from '../../../graph'
import { ParentInformation, RParameter } from '../../../../r-bridge'
import { setDefinitionOfNode } from '../../linker'
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
  for(const writtenNode of writtenNodes) {
    log.trace(`argument ${writtenNode.name} (${writtenNode.nodeId}) is defined at id ${writtenNode.definedAt} with ${defaultValue === undefined ? 'no default value' : ' no default value'}`)
    setDefinitionOfNode(graph, writtenNode)
    define(writtenNode, LocalScope, data.environments)
  }

  // TODO: defined-by for default values

  return {
    activeNodes:  [],
    in:           defaultValue === undefined ? [] : [...defaultValue.in, ...defaultValue.activeNodes, ...name.in],
    out:          [...(defaultValue?.out ?? []), ...name.out, ...name.activeNodes],
    graph:        graph,
    environments: name.environments, // TODO: merge with arguments
    ast:          data.completeAst,
    scope:        data.activeScope
  }
}
