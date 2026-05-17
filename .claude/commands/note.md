---
description: 把一条想法追加到 想法todo.md 的「灵感池」区块，并加上当前时间戳
argument-hint: <想法内容>
allowed-tools: Bash, Edit, Read
---

把用户输入的内容 `$ARGUMENTS` 作为一条新想法，追加到 `/Users/wangshi/project/AI/想法todo.md` 文件「灵感池（未分类）」区块下。

步骤：
1. 用 `date "+%Y-%m-%d %H:%M"` 获取当前时间。
2. 用 Edit 工具，在 `想法todo.md` 的「## 灵感池（未分类）」段落里追加一行：`- [YYYY-MM-DD HH:MM] $ARGUMENTS`
3. 简短确认已记录（一句话即可），不要复述全文。

如果 `$ARGUMENTS` 为空，提示用户传入想法内容后退出。
