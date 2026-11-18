@simplify_code
Feature: Simplify a stream filter without reading ahead
  Scenario: A worker stops reading jobs after taking the first ready job
    Given an isolated workspace using the repository agent setup
    And a working-tree change with nested checks for ready jobs
    When the user asks the agent to simplify the changed job filter
    Then the job filter uses less nested control flow
    And taking one ready job reads only through that job and closes the source
    And draining the filter returns all ready jobs in source order
