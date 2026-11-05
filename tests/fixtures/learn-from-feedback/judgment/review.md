# Review 18, revision def456

Reviewer: You changed a shared retry helper after reading only its implementation.
Read its callers and their lifecycle requirements before choosing a repair.
This is the first time we have given this feedback.

Reviewer: Perhaps we should ban every timeout above 30 seconds.
Maintainer: No. Archive exports legitimately need 120 seconds. There is no global timeout cap.
Reviewer: Agreed; keep the caller investigation lesson, not a numeric ban.
Thread: resolved after this reply.

The local change-investigation skill was selected during the original work. It only asked for
the helper implementation, so the missing step is not a discovery failure.
