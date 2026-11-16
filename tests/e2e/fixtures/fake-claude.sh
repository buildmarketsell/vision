#!/bin/sh
# Stands in for the real `claude` CLI in tests: names the conversation like Claude Code
# does (terminal title), prints a line, then echoes input.
printf '\033]0;\342\234\263 Test conversation\007'
echo "Fake Claude ready in $(pwd)"
cat
