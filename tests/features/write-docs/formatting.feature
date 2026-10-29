@write_docs
Feature: Readable Markdown without loss of content
  The agent formats documentation for source readability while preserving its meaning.

  Background:
    Given an isolated workspace using the repository agent setup

  Scenario: Wrap prose without shortening it or changing list structure
    Given a Markdown document containing this paragraph on one source line:
      """
      The worker retries failed requests up to 3 times, but only when the request includes an idempotency key; requests without that key fail immediately and must be reviewed by the operator.
      """
    And the document has a nested list with a prose item longer than 100 characters
    When the user asks the agent to format the document for source readability
    Then every ordinary prose source line is at most 100 characters
    And paragraph and list text is unchanged after normalizing wrapping whitespace
    And the list item order and nesting are unchanged

  Scenario: Preserve constructs that wrapping would break
    Given a Markdown document with these constructs exceeding 100 characters per line:
      | construct     | reason wrapping would break it                 |
      | table row     | a newline splits a cell into another row       |
      | ASCII diagram | horizontal alignment encodes connections       |
      | code block    | a literal string contains significant spaces   |
      | URL           | a newline splits the destination               |
    And the document contains an ordinary prose paragraph longer than 100 characters
    When the user asks the agent to format the document for source readability
    Then the table, diagram, code block, and URL are unchanged
    And every ordinary prose source line is at most 100 characters

  Scenario: Remove filler while preserving technical facts and caveats
    Given a Markdown document containing:
      """
      It is important to note that the incredibly powerful CacheBox cache has a TTL of 60 seconds. It should be noted that expired entries are removed on the next read, not by a background timer.
      """
    When the user asks the agent to make the prose concise
    Then the document still names CacheBox and its TTL of 60 seconds
    And it still states that expiration is handled on the next read
    And it still states that no background timer removes expired entries
    And it omits "incredibly powerful", "It is important to note", and "It should be noted"
    And every ordinary prose source line is at most 100 characters
