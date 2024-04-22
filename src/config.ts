import type { MergeableRecord } from './util/objects'

export interface FlowrConfigOptions extends MergeableRecord {
	/**
	 * Whether source calls should be ignored, causing {@link processSourceCall}'s behavior to be skipped
	 */
	ignoreSourceCalls: boolean
	/**
	 * The path to the R executable to use. If this is undefined, {@link DEFAULT_R_PATH} will be used.
	 */
	rPath:             string | undefined
}

export const defaultConfigOptions: FlowrConfigOptions = {
	ignoreSourceCalls: false,
	rPath:             undefined
}

let currentConfig: FlowrConfigOptions | undefined

export function setConfig(config: FlowrConfigOptions) {
	currentConfig = config
}

export function getConfig(): FlowrConfigOptions {
	return currentConfig ?? defaultConfigOptions
}
