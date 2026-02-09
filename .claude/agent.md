# ClawUI Agent Guidelines

## Component Design

**组件只负责渲染和暴露 props，业务逻辑（状态、副作用、IPC 调用、路由跳转）放在 store 或 hooks 中。**
