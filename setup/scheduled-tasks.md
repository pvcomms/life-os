# Scheduled Tasks Registry

Tasks registered in Claude Code scheduled-tasks. To re-register from scratch, use the prompts in `agents/` with the schedules below.

| taskId                   | cron (IST)         | status                  |
| ------------------------ | ------------------ | ----------------------- |
| whoop-recovery-check     | `30 6 * * *`       | ✓ active                |
| recovery-aware-scheduler | `45 6 * * *`       | ✓ active                |
| morning-brief            | `30 7 * * *`       | ✓ active (updated)      |
| focus-kickoff            | `30 9 * * 1-5`     | ✓ active                |
| keep-monitor             | `0 10,13,16 * * *` | ✓ active                |
| friday-lessons           | `0 17 * * 5`       | ✓ active                |
| monthly-synthesis        | `0 20 * * 0`       | ✓ active (gate-checked) |
| the-progress-audit       | `0 20 * * *`       | ✓ active (upgraded)     |
| daily-review             | —                  | ✗ disabled (redundant)  |
| 8pm-work-progress        | —                  | ✗ disabled (redundant)  |
