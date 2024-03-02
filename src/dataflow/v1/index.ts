import { log } from '../../util/log'

export const dataflowLogger = log.getSubLogger({ name: 'dataflow' })

export * from '../common/graph'
export * from './extractor'
export * from '../common/environments/environment'
export * from '../../util/mermaid/dfg'
export { diffIdentifierReferences } from '../common/environments'
export { diffEnvironments } from '../common/environments'
export { diffEnvironment } from '../common/environments'
export { cloneEnvironments } from '../common/environments'

