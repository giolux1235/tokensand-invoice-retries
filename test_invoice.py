"""Run the project's four Tokens& cases during standard unittest discovery."""
from vendor.tokensand_check import case_suite
from workflow import workflow


REQUIRED_CASES = {
    "duplicate-delivery",
    "changed-amount-on-retry",
    "same-event-id-two-tenants",
    "two-distinct-payments",
}


def load_tests(loader, tests, pattern):
    missing = REQUIRED_CASES - {case["id"] for case in workflow["cases"]}
    if missing:
        raise ValueError("Missing required invoice cases: " + ", ".join(sorted(missing)))
    return case_suite(workflow)
