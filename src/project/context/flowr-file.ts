import type { PathLike } from 'fs';
import fs from 'fs';
import { guard } from '../../util/assert';

export type FilePath = string;

export interface FlowrFileProvider<Content = unknown> {
    role?: SpecialFileRole;
    path(): PathLike;
    content(): Content;
    assignRole(role: SpecialFileRole): void;
}

export abstract class FlowrFile<Content = unknown> implements FlowrFileProvider<Content> {
	private contentCache:  Content | undefined;
	protected filePath:    PathLike;
	public readonly role?: SpecialFileRole;

	public constructor(filePath: PathLike, role?: SpecialFileRole) {
		this.filePath = filePath;
		this.role     = role;
	}

	public path(): PathLike {
		return this.filePath;
	}

	public content(): Content {
		if(this.contentCache === undefined) {
			this.contentCache = this.loadContent(); // fs.readFileSync(this.filePath, 'utf8');
		}
		return this.contentCache;
	}

	protected abstract loadContent(): Content;

	public assignRole(role: SpecialFileRole): void {
		guard(this.role === undefined || this.role === role, `File ${this.filePath.toString()} already has a role assigned: ${this.role}`);
		(this as { role?: SpecialFileRole }).role = role;
	}
}

export class FlowrTextFile extends FlowrFile<string> {
	protected loadContent(): string {
		return fs.readFileSync(this.filePath, 'utf8');
	}
}

export enum SpecialFileRole {
    Description = 'description',
    Namespace   = 'namespace',
    Data        = 'data',
    Other       = 'other'
}
