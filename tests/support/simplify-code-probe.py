"""Independent runtime contracts and a bounded nesting check for the tiny fixtures."""
import ast
import importlib.util
from pathlib import Path
import sys

mode, filename = sys.argv[1:]
source = Path(filename).read_text()
tree = ast.parse(source)

if mode == "structure":
    def depth(node, level=0):
        level += isinstance(node, (ast.If, ast.For, ast.While, ast.Try, ast.With, ast.IfExp))
        return max([level] + [depth(child, level) for child in ast.iter_child_nodes(node)])

    print(max(depth(node) for node in tree.body))
    sys.exit(0)

spec = importlib.util.spec_from_file_location("workflow", filename)
module = importlib.util.module_from_spec(spec)
sys.dont_write_bytecode = True
spec.loader.exec_module(module)
process = module.process

if mode == "pricing":
    for amount, member, expected in [
        (0, False, 0), (0, True, 0), (99, False, 99), (99, True, 99),
        (100, False, 90), (100, True, 80), (101, False, 91), (101, True, 81),
        (100.5, True, 80.5),
    ]:
        assert process(amount=amount, member=member) == expected, (amount, member, expected)
    assert process(100) == 90, "default member contract"
    for member in (False, True):
        try:
            process(-1, member)
        except ValueError as error:
            assert str(error) == "amount must be non-negative", "error message"
        else:
            raise AssertionError("negative amount accepted")
elif mode == "delivery":
    first = {"enabled": True}
    skipped = {"enabled": False}
    last = {"enabled": True}
    token = object()
    events = []

    def audit(event, item):
        events.append((event, item))

    def send(item):
        events.append(("send", item))
        return token

    result = process(iter([None, first, skipped, last]), send=send, audit=audit)
    expected = [("missing", None), ("sending", first), ("send", first), ("sent", first),
                ("skipped", skipped), ("sending", last), ("send", last), ("sent", last)]
    assert len(events) == len(expected), "callback count"
    assert all(a == b and x is y for (a, x), (b, y) in zip(events, expected)), "callback order or identity"
    assert len(result) == 2 and all(item is token for item in result), "return identity"
    assert process([], send, audit) == [], "empty delivery"
    failure = RuntimeError("offline")

    def fail(item):
        events.append(("send", item))
        raise failure

    events.clear()
    try:
        process([first, last], fail, audit)
    except RuntimeError as error:
        assert error is failure, "exception identity"
    else:
        raise AssertionError("send error swallowed")
    assert events == [("sending", first), ("send", first)], "effects after send error"
    events.clear()

    def audit_failure(event, item):
        raise failure

    try:
        process([first], send, audit_failure)
    except RuntimeError as error:
        assert error is failure, "audit exception identity"
    else:
        raise AssertionError("audit error swallowed")
    assert events == [], "send after audit failure"
else:
    raise AssertionError(f"Unknown contract: {mode}")
print("contract passed")
