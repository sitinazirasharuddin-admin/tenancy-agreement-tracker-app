# Access model

As requested on 6 November 2026, migration 0010 opens account registration without an invitation or admin approval. Email confirmation remains required. Confirmed users can create their own private workspace. Existing team records remain isolated by membership-based RLS; registration never adds strangers to Leasing Team.

An email-matched, unexpired team invitation allows a confirmed user to join that team directly as a member, without a separate approval. Previously pending applicants can sign in and accept a still-valid invitation; expired invitations must be replaced. Historical approval records are retained, and the review_registration endpoint is revoked.

Members can add and edit team business records. Admins manage membership and invitations and can delete business records. Anonymous business-table access remains revoked. Demo/mockup/preview routes remain closed. No production business records are migrated or exposed by reopening registration.

Tests cover public registration, private workspace creation, isolation before joining, wrong-email rejection, direct invited membership, retired approval endpoint and anonymous denial. Build and verify the UI before deployment. No claim is made that SMTP delivery, MFA or full disaster recovery has been verified by these tests.
