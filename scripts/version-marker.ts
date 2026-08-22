/**
 * What the version link of a generated page says: the release it was built from, and whether anything came
 * after it. The landing page, the signature browser and the playground all show the same marker.
 */
import { execFileSync } from 'child_process';
import { flowrVersion } from '../src/util/version';

const Repository = 'https://github.com/flowr-analysis/flowr';

/**
 * What a generated page is built from. Everything else a commit may touch is regenerated from these, so a
 * commit that only updates the generated documentation must not turn a release build into a development one.
 */
const BuildInputs = ['src', 'scripts', 'package.json', 'package-lock.json'];

/** What the version link of a page says. */
export interface VersionMarker {
	/** the text of the link, a `*` marking a build that is ahead of its release */
	readonly label:   string;
	/** where the link goes: the release notes, or the commit the build is from */
	readonly href:    string;
	/** what a hover says, which names the commit for a build that is ahead of its release */
	readonly title:   string;
	/** the tag of the release the build is based on, which a page may look up whatever kind of build it is */
	readonly release: string;
}

/**
 * The output of a git command, or `undefined` where the question cannot be answered: there is no repository
 * (a published tarball, say), or the clone has no tags to compare against.
 */
function git(...args: readonly string[]): string | undefined {
	try {
		return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch{
		return undefined;
	}
}

/**
 * Whether this build is the release it claims to be. Anything committed after the tag that touches what the
 * pages are built from, or left uncommitted, makes it a development build, marked with a `*`.
 */
export function versionMarker(): VersionMarker {
	const version = `v${flowrVersion().format()}`;
	const release = {
		label:   version,
		href:    `${Repository}/releases/tag/${version}`,
		title:   `the release notes of flowR ${version}`,
		release: version
	};
	const commit = git('rev-parse', 'HEAD');

	if(commit === undefined) {
		return release;
	}
	/* what the build is made of, not how many commits happened: a doc-only commit leaves this empty */
	const changed = git('diff', '--name-only', version, 'HEAD', '--', ...BuildInputs);
	const dirty = git('status', '--porcelain', '--', ...BuildInputs) !== '';

	/* a clone without tags cannot compare against the release, and claiming to be one would be worse */
	if(changed === '' && !dirty) {
		return release;
	}
	const commits = changed === undefined ? undefined : Number(git('rev-list', '--count', `${version}..HEAD`, '--', ...BuildInputs) ?? '0');
	const uncommitted = dirty ? ' with uncommitted changes' : '';
	const since = commits === undefined ? `built after ${version}`
		: commits === 0 ? `${version}${uncommitted || ' rebuilt'}`
			: `${commits === 1 ? '1 commit' : `${commits} commits`} after ${version}${uncommitted && `,${uncommitted}`}`;

	return {
		label:   `${version}*`,
		href:    `${Repository}/commit/${commit}`,
		title:   `a development build of flowR, ${since} (${commit.slice(0, 7)})`,
		release: version
	};
}

/**
 * The name and date of a release only live on GitHub, so a page fetches them when someone hovers the link. One
 * request, never on load; a development build keeps what it already says and has the release added to it.
 */
const VersionScript = `<script>
	(function() {
		const tag = document.getElementById('version');
		if(!tag || !tag.dataset.release) { return; }
		const said = tag.title;
		const ahead = tag.textContent.trim().endsWith('*');
		let asked = false;
		const name = () => {
			if(asked) { return; }
			asked = true;
			fetch('${Repository.replace('github.com', 'api.github.com/repos')}/releases/tags/' + tag.dataset.release)
				.then(r => r.ok ? r.json() : Promise.reject(r.status))
				.then(release => {
					if(release.name) {
						const when = release.published_at
							? new Date(release.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
							: '';
						const also = when ? release.name + ', released ' + when : release.name;
						tag.title = ahead ? said + ' \u00b7 ' + also : also;
					}
				})
				.catch(() => { /* the title it already carries says enough */ });
		};
		tag.addEventListener('pointerenter', name);
		tag.addEventListener('focus', name);
	})();
</script>`;

/** Fills the version placeholders of a page template with the given marker. */
export function fillVersion(page: string, marker: VersionMarker): string {
	return page
		.replaceAll('<!--VERSION-HREF-->', marker.href)
		.replaceAll('<!--VERSION-TITLE-->', marker.title)
		.replaceAll('<!--VERSION-RELEASE-->', marker.release)
		.replaceAll('<!--VERSION-LABEL-->', marker.label)
		.replaceAll('<!--VERSION-SCRIPT-->', VersionScript);
}
