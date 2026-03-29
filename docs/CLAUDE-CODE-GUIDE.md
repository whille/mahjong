# Claude Code 高效使用指南

> 整理自多个优秀资源的最佳实践

---

## 一、核心命令速查

| 命令 | 功能 |
|------|------|
| `/help` | 查看 |
| `/` | 查看使用限额和重置时间 |
| `/stats` | 查看使用统计和活动图 |
| `/clear | 清空重新开始 |
| `/compact` | 压缩对话释放上下文空间 |
| `/copy` | 复制最后回复到剪贴板 |
| `/plan` | 进入计划模式 |
| `/mcp` | 管理 MCP 服务器 |
| `/chrome` | 切换原生浏览器集成 |
| `/rewind [n]` | 撤销最近 n 轮对话 |

**CLI 启动参数：**
```bash
claude                    # 启动交互模式
claude -c                 # 继续最近会话
claude -r "abc123"        # 恢复特定会话
claude -p "任务描述"       # headless 模式
claude --model opus       # 指定模型
claude --chrome           # 启用浏览器集成
```

---

## 二、配置优化

### 2.1 终端别名
```bash
# ~/.zshrc 或 ~/.bashrc
alias c='claude'
alias='claudechrome'
alias cp='claude -p'
```

### 2.2 全局配置文件
```json
// ~/.claude.json
{
  "": "claude-sonnet-4-6",
  "language": "中文",
  "hooks": {
    "PostToolUse": [...]
  }
}
```

### 2.3 状态栏自定义
可在状态栏显示：模型名称、当前目录、git 分支、token 使用进度等。

---

## 三、CLAUDE.md 配置

### 3.1 项目级配置
在项目根目录创建 `CLAUDE.md`，自动加载到会话上下文：

```markdown
# 项目名称

## 架构
- 前端: React + TypeScript
- 后端: Node.js + Express
- 数据库: PostgreSQL

## 命令
- `npm run dev` - 启动开发服务器
- `npm test` - 运行测试

## 代码规范
- 使用 ESLint + Prettier
- 组件使用 PascalCase
- 函数使用 camelCase

## 测试指南
- 新功能必须有测试
- 覆盖率 > 80%
```

### 3.2 配置层级
优先级从高到低：
1. Enterprise（不可覆盖）
2. CLI flags
3. Local project（`.claude/settings.local.json`）
4. Shared project（`.claude/settings.json`）
5. User（`~/.claude/settings.json`）

---

## 四、Hooks 自动化

### 4.1 Hook 类型
| Hook | 触发时机 |
|------|----------|
| `UserPromptSubmit` | 提交 prompt 时 |
| `PreToolUse` | 工具执行前 |
| `PostToolUse` | 工具执行后 |
| `Notification` | 通知触发时 |
| `Stop` | Claude 响应结束时 |
| `SessionStart` | 新会话开始时 |

### 4.2 实用 Hook 示例
```json
// ~/.claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "npx prettier --write $FILE" }
        ]
      }
    ]
  }
}
```

---

## 五、MCP 集成

### 5.1 推荐 MCP 服务器
| 服务器 | 用途 |
|--------|------|
| GitHub | PR/Issue 管理 |
| PostgreSQL | 数据库操作 |
| Puppeteer | 浏览器自动化 |
| Filesystem | 文件系统操作 |
| Slack | 消息通知 |

### 5.2 配置示例
```json
{
  "mcpServers": {
    "github": {
      "command": "mcp-github",
      "args": []
    }
  }
}
```

---

## 六、子代理使用

### 6.1 内置子代理
| 代理 | 模型 | 用途 |
|------|------|------|
| Explore | Haiku | 代码库探索（只读） |
| Plan | Sonnet | 规划复杂实现 |
| General-purpose | Sonnet/Opus | 完整读写能力 |

### 6.2 成本优化策略
- 使用 Haiku 进行探索性任务
- 使用 Sonnet 进行日常开发
- 只在复杂推理时使用 Opus
- 可降低 40-50% 成本

---

## 七、工作流程技巧

### 7.1 问题分解
将大任务拆分为可独立解决的小步骤：
```
❌ "重构整个认证系统"
✅ "1. 分析当前认证流程 2. 设计新架构 3. 实现登录模块..."
```

### 7.2 上下文管理
- 及时使用 `/compact` 压缩对话
- 超过 100 轮对话建议重启
- 创建 `HANDOFF.md` 方便新会话继续

### 7.3 语音输入
使用本地转录工具提高效率：
- MacWhisper（macOS）
- superwhisper（跨平台）

### 7.4 Git 工作流
让 Claude 处理：
- 代码提交
- 分支管理
- PR 创建
- 冲突解决

---

## 八、高级用法

### 8.1 Headless 模式
```bash
# CI/CD 集成
claude -p "分析测试失败原因" < test-output.log

# Pre-commit 钩子
git diff --cached | claude -p "检查代码质量"

# 日志分析
tail -200 app.log | claude -p "分析异常"
```

### 8.2 自定义斜杠命令
在 `.claude/commands/` 创建 `.md` 文件：

```markdown
<!-- .claude/commands/review.md -->
审查当前文件：
1. 检查代码规范
2. 检查安全漏洞
3. 提出改进建议

文件: $ARGUMENTS
```

### 8.3 远程执行
```bash
# 发送任务到云端
claude "分析大型代码库 &"

# 拉取远程会话到本地
claude --teleport
```

---

## 九、模型选择指南

| 模型 | 用途 | 成本/百万 token |
|------|------|-----------------|
| Haiku | 简单任务、探索子代理 | $1 输入 / $5 输出 |
| Sonnet | 日常开发、代码实现 | $3 输入 / $15 输出 |
| Opus | 复杂推理、架构设计 | $5 输入 / $25 输出 |

---

## 十、最佳实践清单

### ✅ 推荐做法
- [ ] 创建项目级 `CLAUDE.md` 配置
- [ ] 使用 Hooks 自动化重复任务
- [ ] 大任务拆分为小步骤
- [ ] 定期 `/compact` 管理上下文
- [ ] 使用正确的模型（Haiku 探索，Sonnet 实现）
- [ ] 配置有用的 MCP 服务器
- [ ] 使用终端别名提高效率

### ❌ 避免做法
- [ ] 单次对话超过 100 轮
- [ ] 用 Opus 做简单任务
- [ ] 没有项目上下文直接问问题
- [ ] 忽略 `/usage` 提示
- [ ] 不压缩对话直到上下文溢出

---

## 参考资源

1. [Builder.io - How I use Claude Code](https://www.builder.io/blog/claude-code)
2. [GitHub - claude-code-tips](https://github.com/ykdojo/claude-code-tips)
3. [DEV - The Ultimate Claude Code Guide](https://dev.to/holasoymalva/the-ultimate-claude-code-guide)
4. [Introl - Claude Code CLI Comprehensive Guide](https://introl.com/blog/claude-code-cli-comprehensive-guide-2025)
5. [Claude Code 官方文档](https://code.claude.com/docs/en/overview)
