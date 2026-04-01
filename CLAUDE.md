# 配置 B — Claude Code + CodeRabbit

## Review 规则

代码全部写完后：
1. 创建 PR 到 main 分支
2. 等待 CodeRabbit 自动 review（通常 1-2 分钟）
3. 阅读 CodeRabbit 的每条评论
4. 逐条修复 CodeRabbit 发现的问题
5. push 修复代码，等待 CodeRabbit 重新 review
6. 重复直到 CodeRabbit 无新问题

每条 CodeRabbit 发现的问题，都要记录到 metrics.jsonl。


## 指标采集

整个开发过程中，每次发生以下事件，追加一行 JSON 到项目根目录的 `metrics.jsonl`：

### 阶段标记
开始和结束每个大阶段时：
```json
{"event":"phase","ts":"2026-04-01T10:00:00Z","agent":"single","name":"review|test|fix","action":"start|end"}
```

### Bug 发现
当 CodeRabbit 评论指出问题时：
```json
{"event":"bug_found","ts":"2026-04-01T10:00:00Z","source":"coderabbit","description":"CodeRabbit 评论内容摘要","severity":"P0|P1|P2","file":"涉及文件","fixed":true}
```

当你自己发现 bug 时：
```json
{"event":"bug_found","ts":"2026-04-01T10:00:00Z","source":"self","description":"一句话描述","severity":"P0|P1|P2","file":"涉及文件","fixed":true}
```

### CodeRabbit Review 轮次
每次 CodeRabbit review 完成时：
```json
{"event":"coderabbit_review","ts":"2026-04-01T10:00:00Z","round":1,"issues_found":5,"issues_fixed":5}
```

### 测试编写
每写一个测试用例时：
```json
{"event":"test_written","ts":"2026-04-01T10:00:00Z","file":"测试文件路径","type":"positive|negative","description":"测什么"}
```
- positive = 测正常流程能走通
- negative = 测异常/边界/错误路径（空输入、未授权、超时、并发等）

### 代码覆盖率
所有测试写完后，运行覆盖率检查并记录结果：
```json
{"event":"coverage","ts":"2026-04-01T10:00:00Z","lines":85.2,"branches":72.1,"functions":90.0,"statements":84.5}
```

### 完成标记
全部工作完成时：
```json
{"event":"done","ts":"2026-04-01T10:00:00Z","total_commits":N}
```
