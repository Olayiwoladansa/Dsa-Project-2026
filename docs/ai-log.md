# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.  
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

## Build 1

### Prompt 1: Build 1 domain core and guided implementation
- **What I asked:** Help me implement and understand the ticketing platform's domain core, including events, ticket inventory, bookings, cancellation, booking references, and a FIFO waitlist.
- **What came back:** Step-by-step guidance, explanations, code reviews, and help testing the booking and waitlist behaviour.
- **What was wrong (or "nothing"):** The implementation was tested through the project test suite, demo, and benchmark. I needed additional guidance understanding FIFO and the Git workflow.

## Build 2

### Prompt 1: Build 2 domain features and implementation
- **What I asked:** Help me complete Build 2, including event creation, ticket tiers, publishing and unpublishing events, event searching, filtering, sorting with merge sort, and automated tests.
- **What came back:** Guidance on the domain functions, acceptance criteria, merge sort, event searching, validation, and test coverage.
- **What was wrong (or "nothing"):** The first unpublishing test failed because the `unpublishEvent` function had not been correctly added and exported. This was corrected, and the tests passed.

### Prompt 2: Improve Build 2 acceptance test coverage
- **What I asked:** Review and correct the complete test files so that the Build 2 acceptance criteria and important edge cases are covered without wasting time making scattered code changes.
- **What came back:** Complete revised versions of `test/inventory.test.js` and `test/eventSearch.test.js`, with additional validation, filtering, sorting, and ticket-tier tests.
- **What was wrong (or "nothing"):** The original tests did not cover all required cases. Additional tests were added, and the final test run passed all 54 tests with zero failures.

## Build 3

### Prompt 1: Build 3 prompt (docs/build-3.md)
- **What I asked:** Add the architecture diagrams, booking state machine, Node HTTP router/server, configuration, startup script, and tests.
- **What came back:** A layered architecture document, explicit booking transitions, static-file HTTP server, `/health` route, startup configuration, and `node:test` coverage.
- **What was wrong (or "nothing"):** The first server draft relied on an implicit response/request property for HEAD handling and had redundant error-status logic; both were simplified. Added a regression test proving static requests cannot escape `public/`.