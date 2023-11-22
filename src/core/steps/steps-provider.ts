/**
 * Defines a factor interface which allows to retrieve steps based on a configuration.
 * It extends on the single steps provided by flowr, with the hopes of keeping the interface the same.
 *
 * @module
 */
import { MergeableRecord } from '../../util/objects'
import { IStep } from './step'


export interface StepsConfiguration extends MergeableRecord {
	readonly name: string
}

