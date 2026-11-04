Feature: Project documentation checks
  Scenario: Preserve the project start command
    Given a document with the start command
    When the document is copied to a scenario workspace
    Then the document contains "node server.mjs"

  Scenario: Preserve the local service address
    Given a document with the service address
    When the document is copied to a scenario workspace
    Then the document contains "http://localhost:4100"
