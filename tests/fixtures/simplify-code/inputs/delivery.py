def process(items, send, audit):
    results = []
    for item in items:
        if item is not None:
            if item["enabled"]:
                audit("sending", item)
                result = send(item)
                audit("sent", item)
                results.append(result)
            else:
                audit("skipped", item)
        else:
            audit("missing", item)
    return results
