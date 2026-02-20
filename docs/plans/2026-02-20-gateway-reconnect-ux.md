# Gateway 断连重连 UX 优化 — 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Gateway 断开时 stream 挂起等待重连（15s 超时），重连后自动历史同步恢复，而非立即报错。

**Architecture:** 新增 `reconnected` 事件贯穿 Transport → IPC → Renderer。Stream 层 disconnect 时挂起而非 error，reconnect 时正常关闭 stream 并由 history sync 补全。

**Tech Stack:** Electron IPC, WebSocket, Zustand, Vitest

---

### Task 1: Transport 层 — 区分首次连接和重连

**Files:**
- Modify: `electron/main/services/chat/transport.ts`

**Step 1: 添加 `wasConnected` 标志和 `reconnected` 事件**

在 `ChatTransport` 类中添加 `wasConnected` 私有字段。在 `close` 事件中设置 `wasConnected = true`，在 ACP connect 成功后根据 `wasConnected` 决定 emit `connected` 还是 `reconnected`。

```typescript
// 新增字段（在 private connected = false 后面）
private wasConnected = false;

// close 事件中（在 this.connected = false 之后）
this.wasConnected = true;

// ACP connect 成功后（在 this.connected = true 之后）
if (this.wasConnected) {
  this.emit("reconnected");
} else {
  this.emit("connected");
}
// 注意：删除原来的 this.emit("connected")
```

**Step 2: 验证类型检查通过**

Run: `bun run type-check`

**Step 3: Commit**

```bash
scripts/committer "✨ feat(transport): emit reconnected event on ws reconnect" electron/main/services/chat/transport.ts
```

---

### Task 2: Service + IPC 层 — 转发 reconnected 事件

**Files:**
- Modify: `electron/main/services/chat-websocket.ts`
- Modify: `electron/main/ipc/chat.ts`

**Step 1: ChatWebSocketService 转发 reconnected**

在构造函数中添加：
```typescript
this.transport.on("reconnected", () => this.emit("reconnected"));
```

**Step 2: IPC 注册 reconnected 事件转发**

在 `forwardToWindow` 映射中添加：
```typescript
reconnected: "chat:reconnected",
```

**Step 3: 验证类型检查通过**

Run: `bun run type-check`

**Step 4: Commit**

```bash
scripts/committer "✨ feat(ipc): forward reconnected event to renderer" electron/main/services/chat-websocket.ts electron/main/ipc/chat.ts
```

---

### Task 3: Preload + IPC 类型 — 暴露 onReconnected

**Files:**
- Modify: `electron/preload/index.ts`
- Modify: `src/lib/ipc.ts`

**Step 1: Preload 暴露 onReconnected**

在 `electron/preload/index.ts` 的 chat 对象中，紧跟 `onDisconnected` 后添加：
```typescript
onReconnected: (cb: () => void) => createVoidListener("chat:reconnected", cb),
```

**Step 2: ElectronAPI 类型新增 onReconnected**

在 `src/lib/ipc.ts` 的 `ElectronAPI.chat` 接口中添加：
```typescript
onReconnected: (callback: () => void) => () => void;
```

**Step 3: ipc.chat 新增 onReconnected 方法**

```typescript
onReconnected(callback: () => void) {
  const api = getElectronAPI();
  return api?.chat.onReconnected(callback) ?? (() => {});
},
```

**Step 4: 验证类型检查通过**

Run: `bun run type-check`

**Step 5: Commit**

```bash
scripts/committer "✨ feat(preload): expose onReconnected IPC event" electron/preload/index.ts src/lib/ipc.ts
```

---

### Task 4: Adapter 层 — 新增 onReconnected

**Files:**
- Modify: `packages/openclaw-chat-stream/src/stream/chat-adapter.ts`
- Modify: `src/features/Chat/utils/openclawAdapter.ts`

**Step 1: chat-adapter.ts 新增 onReconnected 类型**

在 `onDisconnected` 后添加：
```typescript
/** Subscribe to transport-level reconnect. Returns unsubscribe. */
onReconnected?: (handler: () => void) => () => void
```

**Step 2: openclawAdapter.ts 桥接 onReconnected**

在 `onDisconnected` 后添加：
```typescript
onReconnected: (handler) => ipc.chat.onReconnected(handler),
```

**Step 3: 验证类型检查通过**

Run: `bun run type-check`

**Step 4: Commit**

```bash
scripts/committer "✨ feat(adapter): add onReconnected to chat transport adapter" packages/openclaw-chat-stream/src/stream/chat-adapter.ts src/features/Chat/utils/openclawAdapter.ts
```

---

### Task 5: Finish Policy — 新增 onDisconnected / onReconnected

**Files:**
- Modify: `packages/openclaw-chat-stream/src/stream/finish-policy.ts`
- Test: `packages/openclaw-chat-stream/src/stream/__tests__/finish-policy.test.ts`

**Step 1: 写失败测试**

在 `finish-policy.test.ts` 末尾添加：

```typescript
describe('disconnect/reconnect', () => {
  it('onDisconnected starts timeout, onReconnected cancels and finishes', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.setClientRunId('run-1')
    policy.onDisconnected(15_000)
    expect(policy.isClosed).toBe(false)
    // Reconnect before timeout
    policy.onReconnected()
    expect(policy.isFinished).toBe(true)
    expect(policy.isClosed).toBe(true)
    expect(cb.chunks).not.toContainEqual(expect.objectContaining({ type: 'error' }))
    expect(cb.chunks).toContainEqual({ type: 'finish' })
  })

  it('onDisconnected times out to error after deadline', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.setClientRunId('run-1')
    policy.onDisconnected(15_000)
    vi.advanceTimersByTime(15_000)
    expect(policy.isClosed).toBe(true)
    expect(cb.chunks).toContainEqual({ type: 'error', errorText: 'Gateway disconnected' })
  })

  it('onDisconnected is no-op when already closed', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.onChatFinal()
    policy.onDisconnected(15_000)
    vi.advanceTimersByTime(15_000)
    // Only one close
    expect(cb.chunks.filter(c => (c as { type: string }).type === 'finish')).toHaveLength(1)
  })

  it('onReconnected is no-op when not disconnected', () => {
    const cb = makeCallbacks()
    const policy = createFinishPolicy(cb)
    policy.onReconnected()
    expect(policy.isFinished).toBe(false)
    expect(policy.isClosed).toBe(false)
  })
})
```

**Step 2: 运行测试确认失败**

Run: `bunx vitest run --silent='passed-only' 'packages/openclaw-chat-stream/src/stream/__tests__/finish-policy.test.ts'`
Expected: FAIL — `onDisconnected` / `onReconnected` 不存在

**Step 3: 实现 onDisconnected / onReconnected**

在 `finish-policy.ts` 中：

接口新增：
```typescript
onDisconnected(timeoutMs: number): void
onReconnected(): void
```

实现（在 return 对象中添加）：
```typescript
let disconnectTimer: ReturnType<typeof setTimeout> | null = null

onDisconnected(timeoutMs: number) {
  if (closed) return
  disconnectTimer = setTimeout(() => {
    disconnectTimer = null
    failOnce('Gateway disconnected')
  }, timeoutMs)
},

onReconnected() {
  if (!disconnectTimer) return
  clearTimeout(disconnectTimer)
  disconnectTimer = null
  finishOnce()
},
```

同时在 `clearTimers` 中清理 `disconnectTimer`：
```typescript
if (disconnectTimer) {
  clearTimeout(disconnectTimer)
  disconnectTimer = null
}
```

**Step 4: 运行测试确认通过**

Run: `bunx vitest run --silent='passed-only' 'packages/openclaw-chat-stream/src/stream/__tests__/finish-policy.test.ts'`
Expected: ALL PASS

**Step 5: 类型检查**

Run: `bun run type-check`

**Step 6: Commit**

```bash
scripts/committer "✨ feat(finish-policy): add disconnect/reconnect with timeout" packages/openclaw-chat-stream/src/stream/finish-policy.ts packages/openclaw-chat-stream/src/stream/__tests__/finish-policy.test.ts
```

---

### Task 6: Stream 层 — 挂起 + 重连逻辑

**Files:**
- Modify: `packages/openclaw-chat-stream/src/stream/chat-stream.ts`

**Step 1: 替换 onDisconnected 回调**

将当前的 `onDisconnected` 回调（L347-353）替换为：

```typescript
if (adapter.onDisconnected) {
  unsubDisconnect = adapter.onDisconnected(() => {
    if (finish.isClosed) return
    log.warn('[stream.disconnected]', { sessionKey })
    finish.onDisconnected(15_000)
  })
}
```

**Step 2: 新增 onReconnected 订阅**

在 `unsubDisconnect` 赋值后添加 `unsubReconnect` 变量和订阅：

```typescript
let unsubReconnect: (() => void) | null = null

// 在 unsubDisconnect 赋值后
if (adapter.onReconnected) {
  unsubReconnect = adapter.onReconnected(() => {
    if (finish.isClosed) return
    log.info('[stream.reconnected]', { sessionKey })
    finish.onReconnected()
  })
}
```

**Step 3: 清理 unsubReconnect**

在 `unsubscribe` 回调中添加 `unsubReconnect?.()`:
```typescript
unsubscribe: () => { unsubscribe?.(); unsubDisconnect?.(); unsubReconnect?.() },
```

**Step 4: 类型检查**

Run: `bun run type-check`

**Step 5: Commit**

```bash
scripts/committer "✨ feat(stream): suspend on disconnect, resume on reconnect" packages/openclaw-chat-stream/src/stream/chat-stream.ts
```

---

### Task 7: Listener 层 — reconnected 触发历史同步

**Files:**
- Modify: `src/store/chat/slices/transport/listener.ts`

**Step 1: 修改 onDisconnected — 不再清理 loading 消息**

将 `onDisconnected` 回调简化为只设置连接状态：
```typescript
ipc.chat.onDisconnected(() => {
  useChatStore.getState().setWsConnected(false);
});
```

**Step 2: 新增 onReconnected 监听**

在 `onDisconnected` 后添加：
```typescript
ipc.chat.onReconnected(() => {
  useChatStore.getState().setWsConnected(true);
});
```

注意：历史同步由 `useOpenClawHistorySync` 中的 gateway event listener 自动处理（reconnect 后 gateway 会发送 heartbeat/chat 事件触发 scheduler）。`setWsConnected(true)` 会让 ConnectionStatus 恢复绿点。

**Step 3: 类型检查**

Run: `bun run type-check`

**Step 4: Commit**

```bash
scripts/committer "✨ feat(listener): handle reconnected event for history sync" src/store/chat/slices/transport/listener.ts
```

---

### Task 8: 集成验证 + lint

**Step 1: 类型检查**

Run: `bun run type-check`

**Step 2: 运行所有相关测试**

Run: `bunx vitest run --silent='passed-only' 'packages/openclaw-chat-stream/src/stream/__tests__/finish-policy.test.ts'`

**Step 3: Lint + Format**

Run: `pnpm lint && pnpm format:check`

如果 format 失败：`pnpm format` 然后重新检查。

**Step 4: 最终 commit（如有 format 修复）**

```bash
scripts/committer "💄 style: format" <changed files>
```
