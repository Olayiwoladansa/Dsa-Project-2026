
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

## Build 4

### Prompt 1: Build 4 REST API implementation
- **What I asked:** Help me implement the in-memory REST API for event creation, ticket tiers, publishing, event search, bookings, mock payments, and cancellation, following the project architecture and acceptance criteria.
- **What came back:** An asynchronous memory repository, event and booking services, mock payment gateway, API routes, HTTP error handling, API documentation, and automated API tests.
- **What was wrong (or "nothing"):** The first API test run exposed a dependency-injection issue: `createAppServer` did not pass the supplied repository and payment gateway into the API router. This was corrected, and the API tests passed.

### Prompt 2: Build 4 API verification and error handling
- **What I asked:** Help me test the REST API end to end, including successful payment, duplicate payment prevention, declined payment, payment retry, and cancellation.
- **What came back:** Step-by-step PowerShell API tests and verification of the expected booking status changes and HTTP responses.
- **What was wrong (or "nothing"):** An old server process was still running after the code changes, so the server had to be restarted. The API then worked correctly. Duplicate payment and declined payment returned HTTP 409 as expected.

### Prompt 3: Build 4 unpublish route and regression testing
- **What I asked:** Add and verify the API endpoint for unpublishing events, and ensure unpublished events disappear from public event searches.
- **What came back:** The unpublish route was added to the API router and HTTP application route allow-list. An API regression test was added to verify that an event returns to draft status and disappears from public search.
- **What was wrong (or "nothing"):** The first unpublish API request returned 404 because the route was missing from the HTTP application's allow-list. This was corrected, and all 8 REST API tests passed.

### Prompt 4: Build 4 final regression, demo, and benchmark verification
- **What I asked:** Run the complete project tests, original demo, and lookup benchmark to check that Build 4 changes did not break earlier functionality.
- **What came back:** The complete test suite passed 62 tests with zero failures. The original demo passed, confirming booking capacity, cancellation, reference lookup, and FIFO waitlist behaviour.
- **What was wrong (or "nothing"):** The benchmark was run with 100,000 and then 200,000 bookings. `Array.find()` took longer as the dataset doubled, while `Map.get()` remained very fast. The benchmark was restored to its original 100,000-booking setting.
