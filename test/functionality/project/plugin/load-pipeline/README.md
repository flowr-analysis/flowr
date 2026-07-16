# The RDA Benchmark Suite

Runs flowR's RDA parser over real `.rda` and `.rdata` files from published research on Zenodo.

The files are not kept in this repository. `setup.sh` downloads them on demand from Zenodo record URLs listed in `zenodo/zenodo_files.csv`.
As of now, the csv file is not publicly available.

## Setup

Provide a `zenodo/zenodo_files.csv` file containing Zenodo record URLs. The script extracts all `.rda`/`.rdata` URLs from it automatically.

Then run:

```bash
./setup.sh
```

Files are saved to `zenodo/files/` as `{record_id}_{filename}`.

## Adding more files

Append additional Zenodo record CSV exports to `zenodo/zenodo_files.csv`. Any URL matching `https://zenodo.org/record/{id}/files/*.rda` or `*.rdata` will be picked up automatically on the next run of `setup.sh`.