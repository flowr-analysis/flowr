export class InvalidPipelineError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'InvalidPipelineError'
	}
}
