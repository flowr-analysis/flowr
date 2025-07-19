import type { FlowrAnalyzerPlugin } from './flowr-analyzer-plugin';
import { Range , SemVer } from 'semver';
import type { FlowrAnalyzer } from '../flowr-analyzer';
import type { FlowrConfigOptions } from '../../config';
import type { PathLike } from 'fs';
import fs from 'fs';
import readline from 'readline';
import { findFileFromRoot } from './flowr-analyzer-plugin-util';

export interface FlowrAnalyzerLibraryVersionsPlugin extends FlowrAnalyzerPlugin {
    type:      'library-versions';
    libraries: Library[];
}

interface Library {
    name:          string;
    version?:      Range;
    dependencies?: Library[];
    type:          'package' | 'system' | 'r';
    addInfo(name?: string, versionConstraint?: Range, type?: 'package' | 'system' | 'r', dependency?: []):     void;
    getInfo():     Library;
}

function defaultLibraryAddInfo(this: Library, name?: string, versionConstraint?: Range, type?: 'package' | 'system' | 'r', dependency?: []): void {
	if(name){
		this.name = name;
	}
	if(versionConstraint){
		this.version = versionConstraint;
	}
	if(type){
		this.type = type;
	}
	if(dependency){
		if(!this.dependencies){
			this.dependencies = dependency;
		} else {
			if(Array.isArray(dependency)){
				this.dependencies.push(...dependency);
			} else {
				this.dependencies.push(dependency);
			}
		}
	}
}

function defaultLibraryGetInfo(this: Library): Library {
	return this;
}

function parseVersionRange(constraint?: string, version?: string): Range | undefined {
	if(constraint && version) {
		return new Range(constraint + version);
	}
	if(version) {
		return new Range(version);
	}
	return undefined;
}

export async function findFilesForPlugin(files: PathLike | PathLike[] | undefined, findFilesMethod: (rootPath: PathLike) => Promise<PathLike | PathLike[] | undefined>, rootPath: PathLike) : Promise<PathLike | PathLike[] | undefined> {
	if(files === undefined){
		const foundFiles: PathLike | PathLike[] | undefined = await findFilesMethod(rootPath);
		if(foundFiles === undefined) {
			console.log('Could not locate DESCRIPTION file!');
			return undefined;
		}
		return foundFiles;
	}
	return files;
}

export const libraryVersionsDescriptionFilePlugin: FlowrAnalyzerLibraryVersionsPlugin & {
    descriptionFile:     PathLike | undefined;
    rootPath:            PathLike | undefined;
    findDescriptionFile: (rootPath: PathLike) => Promise<PathLike | undefined>;
    setDescriptionFile:  (descriptionFile: PathLike) => void;
    setRootPath:         (rootpath: PathLike) => void;
} = {
	name:            'library-versions-description-file',
	description:     'This plugin does...',
	version:         new SemVer('0.1.0'),
	type:            'library-versions',
	libraries:       [],
	descriptionFile: undefined,
	rootPath:        undefined,
	setRootPath(rootPath: PathLike): void {
		this.rootPath = rootPath;
	},
	async findDescriptionFile(rootPath: PathLike): Promise<PathLike | undefined>{
		return findFileFromRoot(rootPath, 'DESCRIPTION');
	},
	setDescriptionFile(descriptionFile: PathLike){
		this.descriptionFile = descriptionFile;
	},
	async processor(analyzer: FlowrAnalyzer, pluginConfig: FlowrConfigOptions): Promise<void> {
		console.log('Running Description-file Library Versions Plugin...');
		console.log(analyzer);
		console.log(pluginConfig);

		this.descriptionFile = await findFilesForPlugin(this.descriptionFile, this.findDescriptionFile, this.rootPath ? this.rootPath : '') as PathLike | undefined;

		if(this.descriptionFile === undefined){
			return;
		}

		try {
			const readStream = fs.createReadStream(this.descriptionFile, { encoding: 'utf8' });
			const rl = readline.createInterface({
				input:     readStream,
				crlfDelay: Infinity
			});
			console.log('Reading DESCRIPTION file...');

			let inImports: boolean = false;
			const importsRegex = new RegExp('^Imports:\\s*$');
			const versionRegex = new RegExp('^\\s*([a-zA-Z0-9._-]+)\\s*(\\((>=|<=|>|<|=)\\s*([0-9A-Za-z\\-+.*]+)\\))?,?\\s*$');
			const indentRegex = new RegExp('^\\s+');

			for await (const line of rl) {
				if(importsRegex.test(line)){
					inImports = true;
					continue;
				}
				if(inImports){
					if(!indentRegex.test(line)){
						inImports = false;
					} else {
						const match = (line).match(versionRegex);
						if(match) {
							this.libraries.push({
								name:         match[1],
								version:      parseVersionRange(match[3],match[4]),
								type:         'package',
								dependencies: [],
								getInfo:      defaultLibraryGetInfo,
								addInfo:      defaultLibraryAddInfo
							});
						}
					}
				}
			}
			console.log('Finished reading the DESCRIPTION-file.');
		} catch(error) {
			if(error instanceof Error) {
				console.error(`Error reading file: ${error.message}`);
			} else {
				console.error('Unknown error while reading file.');
			}
		}
	}
};