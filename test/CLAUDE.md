# test/ — Testing Conventions

## Test runner

Vitest.

## Structure

Test files live in `test/` mirroring the `src/` structure.

## Fixtures

- Fixture sessions in `test/fixtures/sample-sessions/` are real Claude Code logs with sensitive content stripped
- Fixture files are named `<scenario>-<claude-code-version>-sanitised.jsonl`
- Only files ending in `-sanitised.jsonl` are tracked by git (see `.gitignore`)

## Parser tests must cover

- Normal turn (user/assistant exchange)
- Tool use turn
- Error response (including 429)
- Malformed line (corrupted JSON)
- Unknown field (future Claude Code version)
- Cache fields (creation and read tokens)

## Fixture sanitisation checklist

Before committing a fixture:
1. Replace absolute paths (`/Users/...`, `/home/...`, `C:\Users\...`) with `/path/to/project`
2. Remove any string starting `sk-ant-` or `Bearer `
3. Skim for proprietary content from other projects
4. Rename the file to end in `-sanitised.jsonl`

CI will fail the build if any file under `test/fixtures/` contains unsanitised patterns.
