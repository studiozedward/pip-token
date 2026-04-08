---
name: Parser Compatibility
about: Report that Pip-Token's parser broke after a Claude Code update
title: "[Parser] "
labels: parser
assignees: ""
---

## Environment

- **Claude Code version:** (run `claude --version`)
- **Pip-Token version:**
- **OS:**

## What stopped working?

Describe what you noticed — missing data, zero counts, error messages in the panel, etc.

## Sample JSONL (5-10 lines)

Paste a small sample from your session log. The file is at `~/.claude/projects/<project-hash>/<session>.jsonl`.

```jsonl
(paste here)
```

### Before submitting, please confirm:

- [ ] I have replaced absolute file paths (e.g. `/Users/me/...`) with `/path/to/project`
- [ ] I have removed any string starting with `sk-ant-` or `Bearer `
- [ ] I have removed any content from messages that I wouldn't want public
- [ ] I understand this issue will be visible on a public GitHub repo and indexed by search engines
