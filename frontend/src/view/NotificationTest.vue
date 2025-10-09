<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  startTitleFlashing,
  stopTitleFlashing,
  startIconBlinking,
  stopIconBlinking,
  requestNotificationPermission,
  isUserActive,
  playFinishedNotificationSound,
  playDingSound,
  sendTaskCompletedNotification,
  sendPlanApprovalNotification,
  sendToolPermissionNotification,
} from '../utils/notification'
import { useGlobalToast } from '../stores/toast'

const toast = useGlobalToast()

// 状态管理
const notificationPermission = ref<NotificationPermission>('default')
const userActiveStatus = ref(false)
const titleFlashingActive = ref(false)
const iconBlinkingActive = ref(false)
const statusMessage = ref('')
const statusType = ref<'success' | 'error' | 'info' | ''>('')

// 输入参数
const customTitle = ref('新通知')
const flashInterval = ref(1000)
const iconBlinkText = ref('🔴')
const iconBlinkInterval = ref(1000)
const toolName = ref('Bash')

// 刷新状态
const refreshStatus = () => {
  notificationPermission.value = Notification.permission
  userActiveStatus.value = isUserActive()
}

// 显示状态消息
const showStatus = (type: 'success' | 'error' | 'info', message: string) => {
  statusType.value = type
  statusMessage.value = message
  setTimeout(() => {
    statusMessage.value = ''
    statusType.value = ''
  }, 3000)
}

// ===== 标题闪动测试 =====
const startTitleFlash = () => {
  try {
    startTitleFlashing(customTitle.value, flashInterval.value)
    titleFlashingActive.value = true
    showStatus('success', '✅ 标题闪动已开始')
  } catch (error) {
    showStatus('error', `❌ 启动标题闪动失败: ${error}`)
  }
}

const stopTitleFlash = () => {
  try {
    stopTitleFlashing()
    titleFlashingActive.value = false
    showStatus('info', '⏹️ 标题闪动已停止')
  } catch (error) {
    showStatus('error', `❌ 停止标题闪动失败: ${error}`)
  }
}

// ===== 图标闪动测试 =====
const startIconFlash = async () => {
  try {
    await startIconBlinking(iconBlinkText.value, iconBlinkInterval.value)
    iconBlinkingActive.value = true
    showStatus('success', '✅ 图标闪动已开始')
  } catch (error) {
    showStatus('error', `❌ 启动图标闪动失败: ${error}`)
  }
}

const stopIconFlash = () => {
  try {
    stopIconBlinking()
    iconBlinkingActive.value = false
    showStatus('info', '⏹️ 图标闪动已停止')
  } catch (error) {
    showStatus('error', `❌ 停止图标闪动失败: ${error}`)
  }
}

// ===== 通知权限测试 =====
const requestPermission = async () => {
  try {
    const permission = await requestNotificationPermission()
    notificationPermission.value = permission
    if (permission === 'granted') {
      showStatus('success', '✅ 通知权限已授予')
    } else if (permission === 'denied') {
      showStatus('error', '❌ 通知权限被拒绝')
    } else {
      showStatus('info', 'ℹ️ 通知权限请求已发送，请浏览器确认')
    }
  } catch (error) {
    showStatus('error', `❌ 请求通知权限失败: ${error}`)
  }
}

// ===== 音频通知测试 =====
const playAudio1 = () => {
  try {
    playFinishedNotificationSound()
    showStatus('success', '🔊 播放完成通知声音')
  } catch (error) {
    showStatus('error', `❌ 播放音频失败: ${error}`)
  }
}

const playAudio2 = () => {
  try {
    playDingSound()
    showStatus('success', '🔔 播放 Ding 声音')
  } catch (error) {
    showStatus('error', `❌ 播放 Ding 声音失败: ${error}`)
  }
}

// ===== 浏览器通知测试 =====
const sendTaskNotification = () => {
  try {
    sendTaskCompletedNotification()
    showStatus('success', '📢 任务完成通知已发送')
  } catch (error) {
    showStatus('error', `❌ 发送任务通知失败: ${error}`)
  }
}

const sendPlanNotification = () => {
  try {
    sendPlanApprovalNotification()
    showStatus('success', '📢 计划批准通知已发送')
  } catch (error) {
    showStatus('error', `❌ 发送计划通知失败: ${error}`)
  }
}

const sendToolNotification = () => {
  try {
    sendToolPermissionNotification(toolName.value)
    showStatus('success', `📢 工具权限通知已发送 (${toolName.value})`)
  } catch (error) {
    showStatus('error', `❌ 发送工具权限通知失败: ${error}`)
  }
}

// ===== 复合通知测试（忽略 isUserActive 判断）=====
const testCompletedNotification = () => {
  try {
    // 直接调用底层函数，跳过 isUserActive 检查
    startTitleFlashing('任务完成')
    startIconBlinking()
    playFinishedNotificationSound()
    sendTaskCompletedNotification()

    toast.add({
      severity: 'success',
      summary: '任务完成',
      detail: 'Claude 已完成当前任务 (测试模式忽略活跃状态)',
      life: 9999999
    })

    showStatus('success', '🎉 完整任务完成通知已触发')
  } catch (error) {
    showStatus('error', `❌ 复合通知失败: ${error}`)
  }
}

const testToolPermissionNotification = () => {
  try {
    // 直接调用底层函数，跳过 isUserActive 检查
    startTitleFlashing('需要工具权限')
    startIconBlinking('⚠️')
    playDingSound()
    sendToolPermissionNotification(toolName.value)

    showStatus('success', '🔧 完整工具权限通知已触发')
  } catch (error) {
    showStatus('error', `❌ 工具权限通知失败: ${error}`)
  }
}

// ===== 停止所有通知 =====
const stopAllNotifications = () => {
  try {
    stopTitleFlashing()
    stopIconBlinking()
    titleFlashingActive.value = false
    iconBlinkingActive.value = false
    showStatus('info', '🛑 所有通知已停止')
  } catch (error) {
    showStatus('error', `❌ 停止通知失败: ${error}`)
  }
}

// 页面加载时初始化状态
onMounted(() => {
  refreshStatus()
  setInterval(refreshStatus, 2000) // 每2秒刷新状态
})
</script>

<template>
  <div class="notification-test-page">
    <div class="header">
      <h1>🔔 通知系统测试工具</h1>
      <p>测试所有通知功能（忽略用户活跃状态判断）</p>
    </div>

    <div class="container">
      <!-- 左侧：控制面板 -->
      <div class="panel">
        <h3>🎛️ 通知控制</h3>

        <!-- 状态显示 -->
        <div class="status-section">
          <h4>📊 当前状态</h4>
          <div class="status-grid">
            <div class="status-item">
              <span class="label">通知权限:</span>
              <span :class="['value', notificationPermission]">
                {{ notificationPermission === 'granted' ? '✅ 已授予' :
                  notificationPermission === 'denied' ? '❌ 已拒绝' : '⏳ 未请求' }}
              </span>
            </div>
            <div class="status-item">
              <span class="label">用户活跃:</span>
              <span :class="['value', userActiveStatus ? 'active' : 'inactive']">
                {{ userActiveStatus ? '✅ 活跃' : '💤 非活跃' }}
              </span>
            </div>
            <div class="status-item">
              <span class="label">标题闪动:</span>
              <span :class="['value', titleFlashingActive ? 'active' : 'inactive']">
                {{ titleFlashingActive ? '🔄 运行中' : '⏹️ 已停止' }}
              </span>
            </div>
            <div class="status-item">
              <span class="label">图标闪动:</span>
              <span :class="['value', iconBlinkingActive ? 'active' : 'inactive']">
                {{ iconBlinkingActive ? '🔄 运行中' : '⏹️ 已停止' }}
              </span>
            </div>
          </div>
        </div>

        <!-- 参数设置 -->
        <div class="params-section">
          <h4>⚙️ 参数设置</h4>
          <div class="param-grid">
            <div class="param-item">
              <label>闪动标题:</label>
              <InputText v-model="customTitle" placeholder="输入通知标题" />
            </div>
            <div class="param-item">
              <label>闪动间隔:</label>
              <InputNumber v-model="flashInterval" :min="100" :max="5000" :step="100" suffix="ms" />
            </div>
            <div class="param-item">
              <label>图标文字:</label>
              <InputText v-model="iconBlinkText" placeholder="如: 🔴, 1, ⚠️" />
            </div>
            <div class="param-item">
              <label>图标间隔:</label>
              <InputNumber v-model="iconBlinkInterval" :min="100" :max="5000" :step="100" suffix="ms" />
            </div>
            <div class="param-item">
              <label>工具名称:</label>
              <InputText v-model="toolName" placeholder="如: Bash, Read, Write" />
            </div>
          </div>
        </div>

        <!-- 基础通知测试 -->
        <div class="test-section">
          <h4>🧪 基础通知测试</h4>
          <div class="button-group">
            <Button label="请求通知权限" severity="info" @click="requestPermission" />
            <Button label="播放完成音效" severity="success" @click="playAudio1" />
            <Button label="播放Ding音效" severity="success" @click="playAudio2" />
          </div>
        </div>

        <!-- 视觉效果测试 -->
        <div class="test-section">
          <h4>👁️ 视觉效果测试</h4>
          <div class="button-row">
            <Button :label="titleFlashingActive ? '停止标题闪动' : '开始标题闪动'"
              :severity="titleFlashingActive ? 'danger' : 'primary'"
              @click="titleFlashingActive ? stopTitleFlash() : startTitleFlash()" />
          </div>
          <div class="button-row">
            <Button :label="iconBlinkingActive ? '停止图标闪动' : '开始图标闪动'"
              :severity="iconBlinkingActive ? 'danger' : 'primary'"
              @click="iconBlinkingActive ? stopIconFlash() : startIconFlash()" />
          </div>
        </div>

        <!-- 浏览器通知测试 -->
        <div class="test-section">
          <h4>📢 浏览器通知测试</h4>
          <div class="button-group">
            <Button label="任务完成通知" severity="info" @click="sendTaskNotification" />
            <Button label="计划批准通知" severity="info" @click="sendPlanNotification" />
            <Button label="工具权限通知" severity="info" @click="sendToolNotification" />
          </div>
        </div>

        <!-- 复合通知测试 -->
        <div class="test-section">
          <h4>🎉 复合通知测试</h4>
          <div class="button-group">
            <Button label="完整任务完成通知" severity="success" @click="testCompletedNotification" />
            <Button label="完整工具权限通知" severity="warning" @click="testToolPermissionNotification" />
          </div>
        </div>

        <!-- 控制按钮 -->
        <div class="test-section">
          <h4>🛑 通知控制</h4>
          <div class="button-group">
            <Button label="停止所有通知" severity="danger" @click="stopAllNotifications" />
            <Button label="刷新状态" severity="secondary" @click="refreshStatus" />
          </div>
        </div>

        <!-- 状态消息 -->
        <Message v-if="statusMessage" :severity="statusType" :closable="false">
          {{ statusMessage }}
        </Message>
      </div>

      <!-- 右侧：说明面板 -->
      <div class="panel">
        <h3>📋 功能说明</h3>

        <div class="info-section">
          <h4>🔔 通知功能列表</h4>
          <div class="info-list">
            <div class="info-item">
              <h5>标题闪动</h5>
              <p>网页标题在原标题和通知标题之间交替闪动，吸引用户注意</p>
              <ul>
                <li>支持自定义闪动文本</li>
                <li>可调节闪动间隔</li>
                <li>页面可见时自动停止</li>
              </ul>
            </div>

            <div class="info-item">
              <h5>图标闪动</h5>
              <p>浏览器标签页图标闪动，支持Canvas生成通知标识</p>
              <ul>
                <li>Canvas模式：绘制带红点的图标</li>
                <li>降级模式：切换预设图标</li>
                <li>支持自定义通知文字</li>
              </ul>
            </div>

            <div class="info-item">
              <h5>浏览器通知</h5>
              <p>发送系统级浏览器通知，需要用户授权</p>
              <ul>
                <li>系统通知栏显示</li>
                <li>支持点击交互</li>
                <li>防止重复通知堆叠</li>
              </ul>
            </div>

            <div class="info-item">
              <h5>音频通知</h5>
              <p>播放提示音效，增强通知效果</p>
              <ul>
                <li>finished.mp3 音频文件播放</li>
                <li>Web Audio API 生成Ding音</li>
                <li>自动音量控制</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="info-section">
          <h4>⚡ 复合通知</h4>
          <p>当用户不在页面活跃时，系统会同时触发多种通知效果：</p>
          <ul class="feature-list">
            <li>📱 Toast消息（页面内显示）</li>
            <li>🔊 音频提示</li>
            <li>📢 浏览器通知</li>
            <li>🔄 标题闪动</li>
            <li>💎 图标闪动</li>
          </ul>
        </div>

        <div class="info-section">
          <h4>🔧 测试说明</h4>
          <p>本页面用于测试所有通知功能，特别说明：</p>
          <ul class="note-list">
            <li><strong>忽略用户活跃状态</strong>：复合通知测试会直接触发，不检查用户是否在页面活跃</li>
            <li><strong>权限要求</strong>：浏览器通知需要用户授权才能正常工作</li>
            <li><strong>环境限制</strong>：部分功能在HTTP环境下可能受限，建议HTTPS开发</li>
            <li><strong>浏览器兼容</strong>：不同浏览器的通知行为和限制可能不同</li>
          </ul>
        </div>

        <div class="info-section">
          <h4>📝 使用建议</h4>
          <ol class="usage-list">
            <li>首先点击"请求通知权限"获得浏览器通知权限</li>
            <li>单独测试各种基础通知效果</li>
            <li>使用复合通知测试完整的通知体验</li>
            <li>调整参数查看不同配置的效果</li>
            <li>运行测试后可以点击"停止所有通知"重置状态</li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notification-test-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  margin-bottom: 2rem;
  text-align: center;
}

.header h1 {
  margin: 0 0 0.5rem 0;
  color: var(--p-primary-color);
}

.header p {
  margin: 0;
  color: var(--p-text-muted-color);
}

.container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.panel {
  background: var(--p-surface-0);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--p-surface-border);
}

.panel h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: var(--p-text-color);
  border-bottom: 2px solid var(--p-primary-color);
  padding-bottom: 0.5rem;
}

.panel h4 {
  margin-top: 0;
  margin-bottom: 0.75rem;
  color: var(--p-text-color);
  font-size: 1rem;
}

/* 状态显示样式 */
.status-section {
  margin-bottom: 1.5rem;
}

.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: var(--p-surface-50);
  border-radius: 4px;
  border: 1px solid var(--p-surface-border);
}

.status-item .label {
  font-weight: 500;
  color: var(--p-text-color);
}

.status-item .value {
  font-weight: 600;
  font-size: 0.9rem;
}

.status-item .value.granted {
  color: #10b981;
}

.status-item .value.denied {
  color: #ef4444;
}

.status-item .value.default {
  color: #f59e0b;
}

.status-item .value.active {
  color: #10b981;
}

.status-item .value.inactive {
  color: #6b7280;
}

/* 参数设置样式 */
.params-section {
  margin-bottom: 1.5rem;
}

.param-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.param-item label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-text-color);
}

/* 测试区域样式 */
.test-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--p-surface-50);
  border-radius: 6px;
  border: 1px solid var(--p-surface-border);
}

.button-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.button-row {
  margin-bottom: 0.5rem;
}

.button-row:last-child {
  margin-bottom: 0;
}

/* 说明面板样式 */
.info-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--p-surface-border);
}

.info-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-item {
  background: var(--p-surface-50);
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid var(--p-surface-border);
}

.info-item h5 {
  margin: 0 0 0.5rem 0;
  color: var(--p-primary-color);
  font-size: 0.9rem;
}

.info-item p {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: var(--p-text-color);
}

.info-item ul {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.info-item li {
  margin-bottom: 0.25rem;
}

.feature-list,
.note-list,
.usage-list {
  margin: 0.5rem 0 0 0;
  padding-left: 1.25rem;
  font-size: 0.875rem;
}

.feature-list li,
.note-list li,
.usage-list li {
  margin-bottom: 0.25rem;
  color: var(--p-text-color);
}

.note-list li:first-child {
  font-weight: 500;
  color: var(--p-primary-color);
}

.usage-list {
  counter-reset: usage-counter;
}

.usage-list li {
  counter-increment: usage-counter;
}

.usage-list li::before {
  content: counter(usage-counter) '. ';
  font-weight: 600;
  color: var(--p-primary-color);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .container {
    grid-template-columns: 1fr;
  }

  .status-grid,
  .param-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .notification-test-page {
    padding: 1rem;
  }

  .button-group {
    justify-content: center;
  }
}
</style>