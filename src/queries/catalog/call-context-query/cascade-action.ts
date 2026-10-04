export enum CascadeAction {
	/** The action is to start the cascade */
	Stop = 'stop',
	/** The action is to continue the cascade */
	Continue = 'continue',
	/** The action is to skip the current node */
	Skip = 'skip',
	/** The action is to stop the search along this path without linking the current node */
	Block = 'block'
}
