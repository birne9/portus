<script setup>
import { computed, nextTick, ref } from 'vue'
import { showToast } from 'vant'
import {
  formatCoordinate,
  formatDepth,
  sizeLabels,
  typeLabels,
} from '../data/ports'

const props = defineProps({
  show: { type: Boolean, default: false },
  port: { type: Object, default: null },
})

const emit = defineEmits(['update:show', 'closed', 'locate'])
const closeButton = ref(null)

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const description = computed(() => {
  if (!props.port) return ''
  const port = props.port
  return [
    `${port.displayName}位于${port.countryZh}${port.sourceRegion ? `，NGA 分区为 ${port.sourceRegion}` : ''}。`,
    port.water ? `记录水域：${port.water}。` : '源数据未记录所在水域。',
    '本档案依据 2025 年 4 月版 World Port Index 整理；水深与设施均为该版本的历史快照，“未记录”不代表没有。',
  ].join('')
})

const englishName = computed(() => {
  if (!props.port) return ''
  const alternate = props.port.alt && props.port.alt !== props.port.name ? ` · ${props.port.alt}` : ''
  return props.port.name + alternate
})

const facts = computed(() => {
  if (!props.port) return []
  const port = props.port
  return [
    ['UN / LOCODE', port.locode || '未记录'],
    ['WPI 编号', port.wpi],
    ['港口规模', sizeLabels[port.size] || '未记录'],
    ['港口类型', typeLabels[port.type] || '未记录'],
    ['航道水深', formatDepth(port.channelDepth)],
    ['锚地水深', formatDepth(port.anchorageDepth)],
    ['货物码头水深', formatDepth(port.cargoDepth)],
    ['最大船舶吃水', formatDepth(port.maxDraft)],
  ]
})

async function copyPortCode() {
  if (!props.port) return
  const code = props.port.code
  let input = null
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(code)
    } else {
      input = document.createElement('textarea')
      input.value = code
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      if (!document.execCommand('copy')) throw new Error('Browser copy command was rejected')
    }
    showToast(`已复制港口代码 ${code}`)
  } catch {
    showToast(`港口代码：${code}`)
  } finally {
    input?.remove()
  }
}

function locatePort() {
  if (!props.port) return
  emit('locate', props.port)
  visible.value = false
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    visible.value = false
    return
  }
  if (event.key !== 'Tab') return
  const drawer = event.currentTarget
  const focusable = [...drawer.querySelectorAll("button:not(:disabled), a[href], input, [tabindex]:not([tabindex='-1'])")]
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

async function focusCloseButton() {
  await nextTick()
  closeButton.value?.$el?.focus()
}
</script>

<template>
  <van-popup
    v-model:show="visible"
    class="port-drawer"
    position="right"
    teleport="body"
    lock-scroll
    safe-area-inset-bottom
    role="dialog"
    aria-modal="true"
    aria-labelledby="drawerTitle"
    @opened="focusCloseButton"
    @closed="emit('closed')"
    @keydown="handleKeydown"
  >
    <div class="drawer-top">
      <span class="drawer-brand">PORTUS / PORT PROFILE</span>
      <van-button ref="closeButton" class="drawer-close" icon="cross" aria-label="关闭港口档案" @click="visible = false" />
    </div>

    <div v-if="port" class="drawer-body">
      <div class="drawer-eyebrow">
        <span>{{ port.region }} / {{ port.countryZh }}</span>
        <span>WPI {{ port.wpi }}</span>
      </div>
      <h2 id="drawerTitle" class="drawer-title">{{ port.displayName }}</h2>
      <p class="drawer-en">{{ englishName }}</p>
      <p class="drawer-description">{{ description }}</p>
      <div class="drawer-actions">
        <van-button class="button button-primary" block icon="location-o" @click="locatePort">
          在海图中定位
        </van-button>
        <van-button class="button button-ghost" block @click="copyPortCode">
          复制 {{ port.code }}
        </van-button>
      </div>
      <dl class="drawer-facts">
        <div v-for="fact in facts" :key="fact[0]" class="drawer-fact">
          <dt>{{ fact[0] }}</dt>
          <dd>{{ fact[1] }}</dd>
        </div>
      </dl>
      <h3 class="drawer-subtitle">源数据设施与服务标签</h3>
      <div class="drawer-tags">
        <template v-if="port.tags.length">
          <van-tag v-for="tag in port.tags" :key="tag" class="drawer-tag" round plain>
            {{ tag }}
          </van-tag>
        </template>
        <van-tag v-else class="drawer-tag" round plain>无肯定设施记录 · 不代表没有</van-tag>
      </div>
      <div class="drawer-coordinate">
        <small>WGS 84 REFERENCE / WGS84 参考坐标</small>
        <strong>{{ formatCoordinate(port.lat, 'N', 'S') }} · {{ formatCoordinate(port.lng, 'E', 'W') }}</strong>
      </div>
    </div>
    <div class="drawer-foot">
      NGA World Port Index · 2025 年 4 月静态快照<br>
      “未记录”不代表没有；不用于航海、靠泊或实时业务决策。
    </div>
  </van-popup>
</template>
