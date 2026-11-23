# VISION

Dan's own macOS workspace: files, Claude, his to-dos, calendar and content in one app. These are the words the code, tests and replies use.

## To-dos and planning

**To-do**:
One thing Dan has to do, in the To do / In progress / Done list.
_Avoid_: task (in UI text), item

**Plan**:
What a to-do needs to be auto-scheduled: how long it takes, priority, which hours, deadline, smallest piece.
_Avoid_: schedule settings

**Block**:
A stretch of calendar time auto-schedule gave to one to-do.
_Avoid_: slot, chunk

**Rollover**:
A planned to-do whose planned time has all passed without being ticked off gets another block at the next free moment, again and again until it is done.
_Avoid_: carry-over, time-used

## Focus

**Focus**:
A timed stretch of working on one to-do (or on nothing in particular), shown in the menu bar and the island.
_Avoid_: pomodoro, session (in UI text)

**Countdown**:
A focus with a set length that ends on its own.

**Stopwatch**:
A focus with no set length that counts up until Dan stops it.

**Check-in**:
The moment after a countdown ends, when VISION asks whether the to-do is done: Done, +5 min, or Not yet (with how much more it needs).
_Avoid_: prompt, wrap-up

**Island**:
The small black shape under the MacBook's notch (top center on other screens) that shows a running focus or a meeting heads-up and widens on hover.
_Avoid_: pill, notch bar, overlay

**Glance**:
What the menu bar and the island show right now: nothing, a focus, a check-in, or a meeting heads-up.

## Calendar

**Meeting**:
A timed event in a visible calendar that takes time: not all-day, not marked free, not one of VISION's blocks.
_Avoid_: call, appointment

**Heads-up**:
The five minutes before a meeting (and its first minutes, while it can still be joined), when the menu bar and island count down to it.
_Avoid_: reminder, alert

**Join link**:
The Google Meet, Zoom or Teams address of a meeting.

## Agents (after Bupsy, bupsy.si)

**Agent**:
A named Claude helper with its own job, folder, face, model and trust level, and one ongoing chat. Lives in the Agents page.
_Avoid_: bot (Bupsy's word), assistant, persona

**Job**:
What an agent is for, in Dan's words. Added to Claude's system prompt on every run.
_Avoid_: persona, instructions, role (role is the short label beside the name, like "Ads")

**Face**:
An agent's plush shape (circle, ghost, cat…) in one of eight colours. Its eyes show the mood: idle, working, needs you, done, sleeping, failed.
_Avoid_: avatar, icon

**Trust level**:
How much an agent may do without asking: Ask me everything, Allow edits, Auto, Never ask.
_Avoid_: autonomy, permission mode (in UI text)

**Waiting on you**:
Every approval or question from any agent that needs Dan's answer, in one list.
_Avoid_: inbox (that is VISION's Inbox), attention

**Routine**:
A message an agent gets on a schedule ("every weekday at 9:00, check yesterday's ads"). Runs while VISION is open; a missed one runs once when VISION opens again.
_Avoid_: cron, job (job is what the agent is for)

**Fresh chat**:
Ending an agent's long chat and starting a new one that carries only a short handoff note, so each message costs fewer tokens.

**Handoff note**:
The few lines an agent writes about where things stand before a fresh chat. Added to its system prompt until the next fresh chat.
