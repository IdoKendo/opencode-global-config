# ASD-STE100 Simplified Technical English

Use STE for English documentation prose. This guide summarizes selected rules from Issue 9,
dated 2025-01-15. It does not replace the full writing rules or dictionary.

## Sources

- [Official standard overview](https://www.asd-ste100.org/about_STE.html)
- [Official Issue 9 record and PDF](https://doi.org/10.5281/zenodo.23666006)
- [Standard access and usage rights](https://www.asd-ste100.org/STE_downloads.html)

The standard has 53 writing rules and a controlled dictionary. Check uncertain words in Part 2.
Use the approved meaning, part of speech, and word form.
A familiar word is not necessarily approved.

## Vocabulary

- Use approved dictionary words and permitted technical names or technical verbs (rules 1.1–1.13).
- Use each approved word only with its approved meaning and part of speech (rules 1.2–1.4).
- Keep one technical name for each item. Use names accepted in the project or subject field.
  Do not change names only to add variety. Do not use a technical noun as a verb (rules 1.7–1.11).
- For example, use **start** instead of **commence**, and **use** instead of **utilize**.
  These alternatives come from the corresponding entries in the Issue 9 dictionary.
- Preserve code, paths, option names, API identifiers, and literal UI labels. For example, write
  “Select the `Commence` button” if `Commence` is the actual label. Do not rename the button.

## Sentences and procedures

- Use active voice. In descriptive text, use passive voice only when the actor is unknown
  (rule 3.6).
- Use direct verbs for actions instead of noun phrases (rule 3.7).
- In procedures, use at most 20 words per sentence (rule 5.1).
- Give one instruction per sentence unless the actions occur at the same time (rule 5.2).
- Use the imperative for instructions: “Start the worker” (rule 5.3).
- Put a prerequisite condition before its instruction, separated by a comma (rule 5.4).
- Use notes for information, not instructions (rule 5.5).
- In descriptions and informational notes, use at most 25 words per sentence (rule 6.3).
- Give each paragraph one topic (rule 6.5).

Use the word-count rules in Part 1, Section 8. Technical names, quoted text, numbers, and units
have special counting rules. A whitespace count is only a preliminary check.
Sentence limits and the 100-character Markdown source-line limit are separate checks.
Wrapping a long sentence onto two lines does not make the sentence shorter.

## Review

1. Check general vocabulary against the dictionary. Check technical names against the project.
2. Check voice, sentence length, instruction order, and paragraph topics.
3. Preserve facts, conditions, warnings, numbers, and units when you divide sentences.
4. Check that code, identifiers, labels, and quoted output remain correct.

Do not claim full STE compliance from a few automated checks or an AI review.
If you cannot check a word or rule, report that specific gap.
