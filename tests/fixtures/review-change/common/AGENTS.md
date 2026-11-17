# Project standards

Application events must use the injected logger's `info` method with an object.
Do not use console logging: it bypasses the service's structured event collector.
