import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { SemVer } from 'semver';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FileRole } from '../../context/flowr-file';
import { log } from '../../../util/log';

export const sessionInfoLog = log.getSubLogger({ name: 'flowr-analyzer-package-versions-session-info-plugin' });

/** matches the `R version 4.3.1 (2023-06-16)` line of `sessionInfo()`/`sessionInfo` output */
const rVersionRe = /\bR version\s+(\d+\.\d+\.\d+)/;
/** the section headers `sessionInfo()` prints right before a `[n] pkg_version ...` package listing */
const packageHeaderRe = /\b(?:other attached packages|loaded via a namespace \(and not attached\))\s*:/;
/** an `[n] ...` listing line as printed by R for a vector of packages (the `[n]` may itself be commented out) */
const packageListingLineRe = /\[\d+\]\s*(.+)$/gm;
/** a single `name_version` token within a listing line, e.g. `dplyr_1.1.2` or `data.table_1.14.8` */
const packageTokenRe = /([A-Za-z][A-Za-z0-9.]*)_(\d+(?:[.-]\d+)+)/g;

function pin(ctx: FlowrAnalyzerContext, name: string, version: string): void {
	const range = Package.parsePkgVersionRange(undefined, version);
	ctx.deps.addDeclaredDependency(new Package({ name, versionConstraints: range ? [range] : undefined }));
}

/**
 * Reads package (and R) versions from a pasted `sessionInfo()` output block within a source file (typically inside
 * a comment). This is how R users record a reproducible environment, so when present it pins exact versions, just
 * like a lockfile. Detection is conservative: we only act once we see the `R version` line and/or one of
 * `sessionInfo()`'s package-listing headers, and additionally require at least one `pkg_version` token so unrelated
 * text is not misread.
 */
export class FlowrAnalyzerPackageVersionsSessionInfoPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name        = 'flowr-analyzer-package-versions-session-info-plugin';
	public readonly description = 'Extracts package and R versions from a pasted sessionInfo() output block.';
	public readonly version     = new SemVer('0.1.0');

	public process(ctx: FlowrAnalyzerContext): void {
		for(const file of ctx.files.getFilesByRole(FileRole.Source)) {
			this.processContent(ctx, file.content().toString());
		}
	}

	private processContent(ctx: FlowrAnalyzerContext, content: string): void {
		const rVersionMatch = rVersionRe.exec(content);
		if(!rVersionMatch && !packageHeaderRe.test(content)) {
			return;
		}

		const packages = new Map<string, string>();
		for(const line of content.matchAll(packageListingLineRe)) {
			for(const token of line[1].matchAll(packageTokenRe)) {
				packages.set(token[1], token[2]);
			}
		}

		if(packages.size === 0) {
			sessionInfoLog.debug('Found sessionInfo() markers but no package version tokens, skipping.');
			return;
		}

		if(rVersionMatch) {
			pin(ctx, 'R', rVersionMatch[1]);
		}
		for(const [name, version] of packages) {
			pin(ctx, name, version);
		}
	}
}
