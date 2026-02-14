# ClawUI Agent Guidelines

## Component Design

**组件只负责渲染和暴露 props，业务逻辑（状态、副作用、IPC 调用、路由跳转）放在 store 或 hooks 中。**

## Architecture Principles

**ClawUI 采用三层分离架构：renderer（React 组件 → hooks → Zustand stores）通过 IPC 桥接 main（IPC handlers → services → utils），跨进程契约由 `@clawui/types` 包统一定义。**

**packages 层提供可复用的原子能力（UI 基础组件、类型契约、协议适配、配置逻辑），主应用负责组合与业务编排；包之间零耦合，依赖图单向且扁平。**

**每个模块保持单一职责和高内聚：纯函数/常量/类型可被自由提取到同级文件，通过 barrel re-export 保持公开 API 稳定；服务实例在入口集中创建，通过参数注入传递。**

**不要引入只做转发的中间层（proxy class、re-export wrapper）；如果一个抽象层的每个方法都是 `return this.inner.xxx()`，它不应该存在。**

**重复出现两次以上的逻辑（type guard、CLI 调用模式、dialog 表单状态机）提取为共享工具，但只出现一次的不要预提取——等第二次出现时再抽象。**

**IPC handler 保持薄层：只做参数解包 → 调用 service → 返回结果；业务逻辑、状态管理、错误恢复全部下沉到 service 层。**
