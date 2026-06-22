# Runs the taint-analysis evaluation (src/taint-analysis/eval/eval.ts) over a dataset directory.
# The inferred taints are written as JSON lines to stdout (one line per analyzed script).
# All progress is logged to stderr.
#
# Build (current work-around):
#   podman build -f scripts/Dockerfile -t flowr:latest . && podman build -f src/taint-analysis/eval/Dockerfile -t taint-analysis-eval:latest .
#
# Run (mount the dataset read-only and capture the results from stdout):
#   podman run --rm -m 4g -v /path/to/r-files:/data:ro flowr-taint-eval > inferred_taints.json
#
# Test run:
#    podman run --rm \
#      -v $(pwd)/test/testfiles/taint.R:/data/taint.R:ro \
#      localhost/taint-analysis-eval | jless

FROM localhost/flowr:latest
ENTRYPOINT ["node", "/app/src/taint-analysis/eval/eval.js"]
CMD ["/data"]