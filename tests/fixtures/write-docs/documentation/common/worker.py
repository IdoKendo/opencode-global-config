"""A small worker CLI used by the documentation scenarios."""

import argparse
import json
import os
import sys


def positive_integer(value):
    try:
        attempts = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("attempts must be an integer") from error
    if attempts <= 0:
        raise argparse.ArgumentTypeError("attempts must be positive")
    return attempts


def main():
    parser = argparse.ArgumentParser(description="Configure worker retry attempts.")
    parser.add_argument("--attempts", type=positive_integer, default=5)
    args = parser.parse_args()
    print(f"Retry attempts: {args.attempts}")


if __name__ == "__main__":
    exit_code = 0
    try:
        main()
    except SystemExit as error:
        exit_code = error.code
        raise
    except BaseException:
        exit_code = 1
        raise
    finally:
        # Fixture-only execution evidence, enabled only during the agent's run.
        receipt = os.environ.get("AGENT_TEST_RECEIPTS")
        if receipt:
            with open(receipt, "a", encoding="utf-8") as stream:
                stream.write(json.dumps({"args": sys.argv[1:], "code": exit_code}) + "\n")
