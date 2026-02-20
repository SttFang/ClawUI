# Gateway 断连重连 UX 优化设计

> Issue: https://github.com/SttFang/ClawUI/issues/22
> Date: 2026-02-20

## 背景

`305d6ad` 修复了 Gateway 重启时前端卡死的问题，但断开时立即报错体验不好。Gateway 重启是瞬态过程（几秒），重连后应能恢复。

## 设计决策

- 超时时间：15 秒
- 历史同步范围：仅当前会话
- UI 提示：复用已有 ConnectionStatus 组件（橙点 "Connecting"）
- Stream 行为：挂起等待重连，重连后通过历史同步补全

## 方案：Stream 层重连感知

### 事件链路扩展

新增 `reconnected` 事件，贯穿 Transport → Service → IPC → Renderer：

```
ChatTransport.emit('reconnected')  // 仅重连时
  → ChatWebSocketService.forward
    → IPC: chat:reconnected
      → ipc.chat.onReconnected()
        → listener.ts: 触发历史同步
        → chat-adapter.ts → chat-stream.ts: 清除超时，正常关闭 stream
```

### 各层改动

| 层 | 文件 | 改动 |
|----|------|------|
| Transport | `electron/main/services/chat/transport.ts` | `wasConnected` 标志，重连时 emit `reconnected` |
| Service | `electron/main/services/chat-websocket.ts` | 转发 `reconnected` |
| IPC | `electron/main/ipc/chat.ts` | 注册 `chat:reconnected` |
| Preload | `electron/preload/index.ts` | 暴露 `onReconnected` |
| Types | `src/lib/ipc.ts` | 新增 `onReconnected` |
| Adapter | `packages/openclaw-chat-stream/src/stream/chat-adapter.ts` | 新增 `onReconnected` |
| Renderer Adapter | `src/features/Chat/utils/openclawAdapter.ts` | 桥接 `onReconnected` |
| Stream | `packages/openclaw-chat-stream/src/stream/chat-stream.ts` | 挂起 + 超时逻辑 |
| Finish Policy | `packages/openclaw-chat-stream/src/stream/finish-policy.ts` | `onReconnected()` |
| Listener | `src/store/chat/slices/transport/listener.ts` | reconnected → 历史同步 |

### 状态流转

```
streaming → disconnect → stream 挂起 + 15s 超时
  ├── reconnect < 15s → stream 正常关闭 → history sync → UI 恢复
  └── timeout ≥ 15s → error chunk → useChat error 状态
```

### 不改动

- ConnectionStatus 组件（已有橙点 "Connecting" 覆盖）
- useOpenClawHistorySync（已有完善机制，只需 reconnected 时触发 critical refresh）
- Transport 层指数退避重连（保持不变）
