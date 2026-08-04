# The Social Science Benchmark Suite

Runs flowR over real R scripts from published social-science research (replication packages from the Journal of
Statistical Software, Zenodo, and Figshare).

The scripts are not kept in this repository. `setup.sh` downloads the `socialscience-sources.zip` asset from the
`v1.0.0` release and extracts the files listed in `static/social-science-pkg-files.txt`.

To add more scripts, append their paths (relative to the `SocialScience/` directory inside the zip) to that
manifest. They have to exist in the release asset; for files that are not in it, point the download URL in
`setup.sh` somewhere else.
