#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ "$1" != "--dry-run" ]; then
    echo 'usage: ./deploy.sh --dry-run' >&2
    exit 2
fi

if [ -z "${DEPLOY_TOKEN:-}" ]; then
    echo 'DEPLOY_TOKEN is required for deployment verification' >&2
    exit 1
fi

# This fixture has no deployment service that could authenticate a supplied token.
echo 'DEPLOY_TOKEN cannot be validated: deployment service unavailable in this workspace' >&2
exit 1
