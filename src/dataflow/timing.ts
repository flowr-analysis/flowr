export interface DataflowMainThreadTiming {
	/** Time spent serializing payloads in the main thread before dispatching worker tasks. */
	serializationMs:           number
	/** Time spent deserializing worker results in the main thread. */
	deserializationMs:         number
	/**
	 * Total analysis time on the main-thread perspective.
	 * - Parallel mode: submission + worker execution roundtrip for all files.
	 * - Sequential mode: full sequential analysis including merge/source processing.
	 */
	analysisMs:                number
	/** Aggregated time spent merging file-level dataflow outputs. */
	mergeMs:                   number
	/** Aggregated time spent in linking passes. */
	linkingMs:                 number
	/** Aggregated time spent scanning and checking redefined built-ins. */
	redefinedBuiltInsSearchMs: number
}

export interface DataflowWorkerTiming {
	/** Time spent deserializing task input in the worker. */
	deserializationMs: number
	/** Time spent running the actual worker-side analysis. */
	analysisMs:        number
	/** Time spent serializing worker output payload. */
	serializationMs:   number
}

export interface DataflowTimingBreakdown {
	/** Main-thread timing buckets aggregated over one analysis run. */
	mainThread: DataflowMainThreadTiming
	/** Worker-side timing buckets aggregated over all worker tasks of one run. */
	worker:     DataflowWorkerTiming
}

/** Create an empty timing breakdown used as aggregator during extraction. */
export function makeEmptyDataflowTimingBreakdown(): DataflowTimingBreakdown {
	return {
		mainThread: {
			serializationMs:           0,
			deserializationMs:         0,
			analysisMs:                0,
			mergeMs:                   0,
			linkingMs:                 0,
			redefinedBuiltInsSearchMs: 0,
		},
		worker: {
			deserializationMs: 0,
			analysisMs:        0,
			serializationMs:   0,
		}
	};
}