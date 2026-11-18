@find_docs
Feature: Configure a pinned SDK from its release documentation

  Scenario: Enable disk spooling on ParcelQuill 2.4 without using the latest schema
    Given an offline ParcelQuill reference covering releases 2.4 and 3.0
    When the user asks the agent to configure disk spooling for 2.4
    Then the agent has retrieved the 2.4 reference page
    And the answer sets journal.medium to "volume" and journal.limitKiB to 512 for a 512 KiB spool
