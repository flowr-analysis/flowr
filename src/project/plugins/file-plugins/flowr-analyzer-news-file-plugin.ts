import { FlowrAnalyzerPatternFilePlugin } from './flowr-analyzer-file-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { type FlowrFileProvider, FileRole } from '../../context/flowr-file';
import { FlowrNewsFile } from './files/flowr-news-file';

const NewsFilePattern = /^NEWS(\.(rd|md))?$/i;

/**
 * This plugin provides support for R `NEWS` files.
 * @see https://rdrr.io/r/utils/news.html
 */
export class FlowrAnalyzerNewsFilePlugin extends FlowrAnalyzerPatternFilePlugin {
	public readonly name = 'flowr-analyzer-news-file-plugin';
	public readonly description = 'Reads NEWS files into version chunks.';
	public readonly version = new SemVer('0.1.0');

	/**
	 * Creates a new instance of the NEWS file plugin.
	 * @param filePattern - The pattern to identify NEWS files, see {@link NewsFilePattern} for the default pattern.
	 */
	constructor(filePattern: RegExp = NewsFilePattern) {
		super(filePattern);
	}

	public process(_ctx: FlowrAnalyzerContext, file: FlowrFileProvider): FlowrNewsFile {
		return FlowrNewsFile.from(file, FileRole.News);
	}
}
