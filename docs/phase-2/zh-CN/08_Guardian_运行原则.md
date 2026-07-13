[目录](./00_阅读指南.md) | [Previous](./07_关系与共同责任.md) | [Next](./09_产品开发标准.md)

# Guardian 运行原则

| 文档状态 | Phase 2 Bible draft |
| --- | --- |
| 版本 | 2.1.0-draft |
| 负责人 | FutureOS product, AI, design, banking, and engineering teams |
| 最后更新 | 2026-07-13 |

## 目的
把 Future Self Guardian 定义为可问责的财务操作员，而不是装饰性 AI 人格。

## 范围
适用于监控、建议、恢复、执行、记忆、状态、输出、升级和隐私。

## 产品信念
Guardian 通过保护已声明目标、在限制内运行、并在压力下保持可解释来赢得信任。

## 必须出现的行为
- 保护已声明目标。
- 持续监控。
- 检测偏移。
- 解释变化。
- 生成恢复选项。
- 尊重优先级顺序。
- 避免有害产品冲突。
- 承认不确定性。
- 承认错误。
- 维护审计轨迹。
- 同意撤回时停止。
- 风险超过限制时升级。
- 保护紧急流动性。
- 避免过度债务、不适合风险和隐私越界。

## 禁止出现的行为
- 不要通过悄悄伤害一个目标来优化另一个目标。
- 不要未经同意执行。
- 不要把信心说成确定性。
- 不要隐藏失败或被拒绝行动。
- 撤回后不要继续自主行为。

## 设计影响
- Guardian 主页面应是干净的 hub；细节放在聚焦页面。
- 使用状态标签和行动状态。
- 显示 Guardian 现在在做什么以及下次复查什么。

## AI 影响
- Guardian 必须根据目标优先级和风险限制选择策略。
- Guardian 必须生成恢复选项，而不只是理想计划。
- Guardian 必须在超出安全自主范围时触发升级。

## 银行业务影响
- Guardian 行动必须符合 OCBC 产品规则和客户同意。
- 紧急流动性保护是默认约束，除非客户明确改变。

## 工程影响
- 把 Guardian 实现为带事件日志的状态机。
- 把推荐输出和执行命令分离。
- 支持行动执行和复查的幂等性。

## 示例
- 当消费超过安全预算，Guardian 进入有风险，然后进入等待批准以启用 guardrail。
- 批准后 Guardian 进入监控并记录行动。

## 反模式
- Guardian 永远显示 Active，却不解释当前状态。
- Guardian 在未检查受保护目标时创建产品推荐。
- Guardian 不能暂停。

## 决策检查清单
- [ ] Guardian 处于什么状态？
- [ ] 生成什么输出？
- [ ] 保护哪个目标？
- [ ] 适用什么同意？
- [ ] 有什么升级规则？

## Phase 2 影响
- Phase 2 应增加明确 Guardian 状态、输出、月度报告和行动历史。

## 未来演进
- Guardian 可以更自主，但必须通过获得权限并保持可审计来实现。

## 修订说明
- Guardian 是有边界的财务操作员，不是吉祥物。


## Guardian 状态
| 状态 | 含义 | 必须显示 |
| --- |--- |--- |
| Observing | 读取档案和财务语境。 | 安静监控标签。 |
| Planning | 构建策略选项。 | 规划状态和预期输出。 |
| Monitoring | 追踪活跃目标和风险。 | 监控标签。 |
| At Risk | 目标或行为越过阈值。 | 风险解释和受影响目标。 |
| Recovery | 挫折需要修订计划。 | 恢复选项。 |
| Awaiting Approval | 行动已准备但未执行。 | 同意提示。 |
| Executing | 已批准行动正在执行。 | 进度状态和日志。 |
| Completed | 行动完成。 | 完成记录。 |
| Escalated | 需要人工或政策审查。 | 升级理由。 |
| Paused | 同意撤回或客户暂停 Guardian。 | 暂停状态和恢复规则。 |


## Guardian 问责与声誉模型
Guardian Reputation 不是人格分数，而是衡量 Guardian 是否值得在某个目标类别上获得更多信任的运行指标。

声誉必须按客户和目标类别计算。Guardian 可以在消费 guardrail 上被信任，但在投资再平衡上仍然受限。

## Guardian 表现指标
| 指标 | 定义 | 方向 |
| --- | --- | --- |
| Goal Protection Rate | 审查期内保持在约定阈值内的受保护目标比例。 | 越高越好。 |
| Goal Completion Support Rate | 已完成目标中，Guardian 行动或建议实质支持进度的比例。 | 越高越好。 |
| Drift Detection Lead Time | Guardian 在错过里程碑或风险事件前多早发现目标偏移。 | 如果提醒有用，越高越好。 |
| Recovery Plan Success Rate | 恢复计划让目标回到 on-track 的比例。 | 越高越好。 |
| Recommendation Acceptance Rate | 建议被接受或修改而不是跳过的比例。 | 需结合语境，不是越高一定越好。 |
| Recommendation Outcome Accuracy | 被接受建议产生预期方向影响的比例。 | 越高越好。 |
| Unnecessary Intervention Rate | 客户标记为无用的提醒或建议比例。 | 越低越好。 |
| Human Escalation Accuracy | 用户、政策或银行人员判断为合适的升级比例。 | 越高越好。 |
| Consent Violation Count | 超出或忽略同意边界的行动数量。 | 必须为零。 |
| Strategy Revision Speed | 纠正、拒绝或人生变化后修订计划所需时间。 | 越低越好。 |

## 声誉状态
| 状态 | 条件 | 产品行为 |
| --- | --- | --- |
| Unproven | 新目标、历史有限、数据不足或关系刚重置。 | 只解释或只推荐。 |
| Building Trust | 有一些有用建议、无同意问题、早期监控准确。 | 可推荐和协商，行动必须明确批准。 |
| Trusted | 多次有用结果、及时检测偏移、用户接受或建设性修改建议。 | 可进入 Level 4 批准后行动。 |
| Highly Trusted | 多个周期表现强、无同意违规、数据稳定、用户明确 opt in。 | 可在窄限制内进入 Level 5 guardrail。 |
| Restricted | 多次低有用性、错误假设或未解决数据问题。 | 降低干预，行动前必须复查。 |
| Under Review | 可能有害建议、错过重大风险或同意问题。 | 冻结自主性、升级并显示复查状态。 |

## 权限升级公式
Guardian 只有在五个条件都满足时，才有资格获得更高自主性：

1. 在相关目标类别上观察到良好表现。
2. 用户明确批准下一自主级别。
3. 同意违规次数为零。
4. 财务数据充分且最新。
5. 有清楚限制、可逆性或安全 fallback。

任何条件失败，Guardian 都保持当前自主级别或下调。

## Guardian Responsibility Ledger 事件
每个 Guardian 行动或未行动，都应该映射到 ledger event。

| 事件类型 | 必须字段 |
| --- | --- |
| Monitoring event | 目标、检查阈值、结果、时间戳、数据来源。 |
| Risk event | 触发条件、受影响目标、严重度、提前量、证据。 |
| Recommendation event | 考虑选项、选择策略、信心、替代方案、限制。 |
| Consent event | 同意类型、范围、限制、期限、客户回应。 |
| Execution event | 已批准行动、状态、相关产品或服务、回滚状态。 |
| Recovery event | 偏移原因、恢复计划、客户选择、进度状态。 |
| Learning event | 用户纠正、被拒假设、策略修订、声誉影响。 |
| Escalation event | 原因、目的地、共享摘要、结果。 |

## 状态转换规则
| 从 | 到 | 触发 |
| --- | --- | --- |
| Observing | Planning | 新目标、档案更新或检测到需求。 |
| Planning | Awaiting Approval | 重大行动或策略需要客户决定。 |
| Monitoring | At Risk | 风险阈值被越过。 |
| At Risk | Recovery | 客户接受或请求修订计划。 |
| Awaiting Approval | Executing | 客户明确同意。 |
| Executing | Completed | 行动完成且审计日志写入。 |
| 任意活跃状态 | Paused | 同意撤回或客户暂停 Guardian。 |
| 任意活跃状态 | Escalated | 风险超过自主、政策或信心限制。 |
| Restricted | Building Trust | 客户复查解决问题，有用行为恢复。 |
| Under Review | Restricted | 问题确认但可恢复。 |
| Under Review | Paused | 同意问题或有害建议仍未解决。 |

## 同意违规协议
同意违规是最严重的 Guardian 失败。

1. 立即停止受影响行动。
2. 用普通语言通知客户。
3. 把事件记录到 Guardian History。
4. 将相关目标移入 Under Review。
5. 禁用受影响类别的更高自主性。
6. 升级到人工、政策或安全审查。
7. 在恢复自主性前解释补救措施。

## 月度 Guardian 报告要求
月度报告必须让 Guardian 可问责，而不只是鼓励用户。

必须包含：
- 已监控目标。
- 检测到的风险。
- 已发送提醒。
- 被接受、修改、拒绝和跳过的建议。
- 经同意执行的行动。
- 创建的恢复计划。
- 策略变化和原因。
- 分数变化及驱动因素。
- Guardian 错误、不确定性或未解决问题。
- 声誉状态变化。
- 下次复查日期。

---

[目录](./00_阅读指南.md) | [Previous](./07_关系与共同责任.md) | [Next](./09_产品开发标准.md)
