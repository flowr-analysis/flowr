/** a command (or several lines of code) with the output a notebook or transcript recorded for it */
export interface RecordedRun {
	/** 1-based line the code starts at in the file, if the format has lines */
	readonly line?:  number
	readonly code:   string
	readonly output: string
	/** how many plots the run drew, if the format records images */
	readonly plots?: number
}

/** a file that keeps the output of the code it holds, like an R console transcript or a Jupyter notebook */
export interface RecordsRuns {
	/** the runs in the order of the file, empty if the file records none (or cannot be read) */
	recorded(): readonly RecordedRun[]
}

/** whether a file records the output of its code, whichever format it is */
export function recordsRuns<F extends object>(file: F | undefined): file is F & RecordsRuns {
	return file !== undefined && typeof (file as Partial<RecordsRuns>).recorded === 'function';
}
