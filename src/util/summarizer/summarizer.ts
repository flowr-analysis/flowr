import { MergeableRecord } from '../objects'
import fs from 'fs'

/**
 * Represents what structure the input data has
 */
export const enum DataInputType {
	Benchmark,
	Summarizer,
	SummarizerCompressed
}


export interface FileRetriever {
	/**
   * Returns the content of the given file, may automatically deal with uncompressing the respective file.
   *
   * @param path - The path to retrieve the file from.
   */
	from(path: string): Promise<string>
}

export abstract class FileProvider {
	protected readonly retriever: FileRetriever
	constructor(retriever: FileRetriever) {
		this.retriever = retriever
	}

	protected abstract getFilePaths(): AsyncGenerator<fs.PathLike>

	public async *getFiles(): AsyncGenerator<string> {
		for await (const path of this.getFilePaths()) {
			yield await this.retriever.from(path.toString())
		}
	}
}

export abstract class Summarizer<Output extends MergeableRecord> {
	protected readonly files: FileProvider

	constructor(files: FileProvider) {
		this.files = files
	}

	public abstract summarize(): Promise<Output>
}
