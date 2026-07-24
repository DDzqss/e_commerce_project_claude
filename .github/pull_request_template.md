# Pull Request

## 关联
- Phase: <!-- 0/1/2/... -->
- Issue: #<!-- issue number 或 N/A -->
- 分支: <!-- feature/xxx -->

## 变更摘要
<!-- 1-3 句话描述本次改动的核心内容 -->

## 变更类型
- [ ] feat（新功能）
- [ ] fix（Bug 修复）
- [ ] refactor（重构）
- [ ] docs（文档）
- [ ] test（测试）
- [ ] chore（构建/依赖/杂项）
- [ ] perf（性能优化）

## 涉及端侧
- [ ] backend
- [ ] frontend-user-web
- [ ] frontend-merchant
- [ ] frontend-admin
- [ ] android-app
- [ ] infra / CI / docs

## 数据库变更
- [ ] 无
- [ ] 包含 Alembic 迁移（脚本已附）
- [ ] 需要手动数据迁移（说明如下）

## 测试
- [ ] 单元测试（新增/覆盖修改）
- [ ] 集成测试
- [ ] E2E 测试
- [ ] 手动测试（附截图/录屏）
- [ ] 现有测试全部通过

## 业务深度检查（P0 功能必勾）
- [ ] 已考虑正常流程
- [ ] 已考虑异常流程（超时、失败、并发、网络断开）
- [ ] 已考虑三角色权限（用户 / 商家 / 管理员）
- [ ] 已考虑体验细节（loading / error / empty 三态齐全）
- [ ] 已考虑联动效果（本改动会触发的下游功能）

## Security Review
- [ ] 已运行 `/security-review`（或 `/openai-security-best-practices`）无高危项
- [ ] 无秘钥泄露
- [ ] 无 SQL 注入 / XSS 风险
- [ ] 权限校验齐全

## 部署备注
<!-- 如需环境变量新增、数据迁移、缓存清理等，写在这里 -->
