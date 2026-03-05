I'm implementing a feature for Blurt, a macOS Electron dictation app
(TypeScript + Electron + whisper.cpp + llama.cpp).

Feature: [ID] — [NAME]

Steps:

1. Read docs/architecture.md FIRST — this has the canonical shared interfaces.
   Do not deviate from the Mode/Settings types defined there.
2. Read docs/feature-backlog.md and find the entry for [ID]. It lists the full
   spec, relevant doc references, and which files to change.
3. Follow the referenced doc sections in docs/superwhisper_reverse_engineered/
   for implementation details.
4. Read the source files listed in the backlog entry.
5. Use superpowers:writing-plans to plan the implementation.
6. After planning, append any non-obvious decisions to docs/architecture.md
   under the "Decisions" section so other sessions know about them.
