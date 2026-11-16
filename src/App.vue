<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PortDrawer from './components/PortDrawer.vue'
import PortMap from './components/PortMap.vue'
import portHero from '../assets/port-hero.jpg'
import portTerminal from '../assets/port-terminal.jpg'
import dataNoticeUrl from '../assets/data-notice.txt?url'
import {
  dataMeta,
  formatCount,
  ports,
  reducedMotion,
  regions,
  sizeLabels,
  typeLabels,
  useLabels,
} from './data/ports'

const PAGE_SIZE = 24
const SIDEBAR_SIZE = 60

const query = ref('')
const searchInput = ref('')
const heroQuery = ref('')
const region = ref('全部')
const page = ref(1)
const selectedId = ref(null)
const drawerShow = ref(false)
const atlasSearch = ref(null)
const portMap = ref(null)

let searchTimer = null
let navigationTimer = null
let revealObserver = null
let lastFocused = null

const filteredPorts = computed(() => {
  const normalizedQuery = query.value.trim().toLocaleLowerCase().replace(/[\s\-_/().,·]+/g, '')
  return ports.filter((port) => {
    const regionMatch = region.value === '全部' || port.region === region.value
    return regionMatch && (!normalizedQuery || port.searchText.includes(normalizedQuery))
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredPorts.value.length / PAGE_SIZE)))
const pageResults = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredPorts.value.slice(start, start + PAGE_SIZE)
})
const sidebarResults = computed(() => filteredPorts.value.slice(0, SIDEBAR_SIZE))
const selectedPort = computed(() => ports.find((port) => port.id === selectedId.value) || null)
const panelFoot = computed(() => filteredPorts.value.length > SIDEBAR_SIZE
  ? `海图显示全部结果 · 列表前 ${SIDEBAR_SIZE} 条`
  : '点击条目 · 展开港口档案')
const indexStatus = computed(() => {
  const regionText = region.value === '全部' ? '全部区域' : region.value
  const queryText = query.value ? ` · “${query.value}”` : ''
  const pageText = filteredPorts.value.length > PAGE_SIZE ? ` · 第 ${page.value} / ${totalPages.value} 页` : ''
  return `${regionText}${queryText} · ${formatCount(filteredPorts.value.length)} 条港口档案${pageText}`
})

function directoryTags(port) {
  return port.tags.length
    ? port.tags.slice(0, 2)
    : [sizeLabels[port.size], useLabels[port.use]].filter(Boolean)
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' })
}

function cancelMapNavigation() {
  if (navigationTimer !== null) {
    clearTimeout(navigationTimer)
    navigationTimer = null
  }
  portMap.value?.cancelPendingReveal()
}

function openPort(id) {
  lastFocused = document.activeElement
  selectedId.value = id
  drawerShow.value = true
}

function handleDrawerClosed() {
  selectedId.value = null
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus()
}

async function selectRegion(value) {
  cancelMapNavigation()
  if (searchTimer !== null) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  query.value = searchInput.value
  region.value = value
  page.value = 1
  await nextTick()
  portMap.value?.fitResults(filteredPorts.value)
}

async function searchAtlas(value) {
  cancelMapNavigation()
  if (searchTimer !== null) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  query.value = value
  page.value = 1
  await nextTick()
  portMap.value?.fitResults(filteredPorts.value)
}

async function submitHeroSearch(value) {
  cancelMapNavigation()
  if (searchTimer !== null) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  query.value = value
  searchInput.value = value
  region.value = '全部'
  page.value = 1
  await nextTick()
  scrollToSection('atlas')
  navigationTimer = setTimeout(() => {
    navigationTimer = null
    portMap.value?.fitResults(filteredPorts.value)
  }, reducedMotion() ? 30 : 500)
}

async function clearFilters() {
  cancelMapNavigation()
  if (searchTimer !== null) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  query.value = ''
  searchInput.value = ''
  heroQuery.value = ''
  region.value = '全部'
  page.value = 1
  await nextTick()
  portMap.value?.resetMapView()
}

function handlePageChange() {
  scrollToSection('directory')
}

function locatePort(port) {
  cancelMapNavigation()
  scrollToSection('atlas')
  navigationTimer = setTimeout(() => {
    navigationTimer = null
    portMap.value?.revealMarker(port)
  }, reducedMotion() ? 20 : 350)
}

function handleGlobalKeydown(event) {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !drawerShow.value) {
    event.preventDefault()
    atlasSearch.value?.focus()
    scrollToSection('atlas')
  }
}

watch(searchInput, (value) => {
  cancelMapNavigation()
  if (searchTimer !== null) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    query.value = value
    page.value = 1
  }, 140)
})

watch(totalPages, (total) => {
  if (page.value > total) page.value = total
})

watch(filteredPorts, (results) => {
  if (selectedId.value && !results.some((port) => port.id === selectedId.value)) {
    drawerShow.value = false
  }
})

onMounted(() => {
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        revealObserver.unobserve(entry.target)
      }
    })
  }, { threshold: 0.12 })
  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element))
  document.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  if (searchTimer !== null) clearTimeout(searchTimer)
  if (navigationTimer !== null) clearTimeout(navigationTimer)
  revealObserver?.disconnect()
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <a class="skip-link" href="#main">跳至主要内容</a>
  <div class="noise" aria-hidden="true" />

  <header class="site-header">
    <a class="brand" href="#top" aria-label="PORTUS 全球港口图志首页">
      <svg class="brand-mark" viewBox="0 0 40 46" fill="none" aria-hidden="true">
        <circle cx="20" cy="7" r="4" stroke="currentColor" stroke-width="1.5" />
        <path d="M20 11v28M10 18h20M6 32c2 7 7 10 14 10s12-3 14-10M3 32h9m16 0h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        <path d="M15 13h10" stroke="currentColor" stroke-width="1.5" />
      </svg>
      <span><span class="brand-word">PORTUS</span><span class="brand-sub">全球港口图志</span></span>
    </a>
    <nav class="main-nav" aria-label="主导航">
      <a href="#atlas">探索地图</a>
      <a href="#directory">港口索引</a>
      <a href="#about">关于图志</a>
    </nav>
    <div class="header-edition">EXPLORER EDITION · 2026</div>
  </header>

  <main id="main">
    <section id="top" class="hero">
      <div class="hero-copy">
        <p class="eyebrow">A living atlas of global seaports</p>
        <h1 class="hero-title"><span>港口，</span><span class="accent-line">是世界的心跳。</span></h1>
        <p class="hero-english">Where the world comes ashore.</p>
        <p class="hero-intro">从新加坡的转运枢纽，到鹿特丹的欧洲门户。以一张交互海图，阅读全球 {{ formatCount(dataMeta.recordCount) }} 座真实港口的位置、港型与公开设施记录，让遥远的海岸线变得触手可及。</p>
        <div class="hero-actions">
          <a class="button button-primary" href="#atlas">
            探索世界港口
            <van-icon name="arrow" />
          </a>
          <a class="button button-ghost" href="#directory">浏览港口索引</a>
        </div>
        <div class="hero-search" role="search">
          <label class="sr-only" for="heroSearch">搜索港口</label>
          <van-search
            id="heroSearch"
            v-model="heroQuery"
            autocomplete="off"
            placeholder="试试搜索：上海 / CNSHA / Rotterdam"
            @search="submitHeroSearch"
          />
          <button class="hero-search-submit" type="button" @click="submitHeroSearch(heroQuery)">在海图中查找</button>
        </div>
        <p class="hero-note">真实收录 {{ formatCount(dataMeta.recordCount) }} 座港口 · 覆盖 {{ dataMeta.countryCount }} 个国家与地区 · 2025 年 4 月版</p>
      </div>

      <div class="hero-visual">
        <div class="hero-photo">
          <img :src="portHero" alt="密集的集装箱码头、岸桥与港湾航拍" fetchpriority="high">
          <div class="photo-label">
            <div><strong>Gateways of commerce</strong><small>全球贸易的岸线与门户</small></div>
            <span class="photo-index">01</span>
          </div>
        </div>
        <div class="hero-coordinate" aria-hidden="true">
          <div class="coordinate-top">
            <span>YOUR NEXT DISCOVERY</span>
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 17c3-6 6-8 10-8 2.5 0 4 1 6 3M5 5l2 2m12 10 2 2M9 19c3-3 6-4 11-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
          </div>
          <div class="coordinate-value">01°15′N · 103°50′E</div>
          <div class="coordinate-sub">SINGAPORE / STRAIT OF MALACCA</div>
        </div>
        <div class="compass" aria-hidden="true">
          <svg viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="43" stroke="currentColor" stroke-opacity=".25" />
            <circle cx="50" cy="50" r="32" stroke="currentColor" stroke-opacity=".16" stroke-dasharray="1 5" />
            <path d="m50 13 7 30 30 7-30 7-7 30-7-30-30-7 30-7 7-30Z" stroke="currentColor" stroke-opacity=".65" />
            <path d="m50 13 7 30-7 7-7-7 7-30Z" fill="#7ce3c3" />
            <circle cx="50" cy="50" r="3" fill="#ff9166" />
            <text x="50" y="9" text-anchor="middle" fill="currentColor" font-size="7" font-family="DM Sans">N</text>
          </svg>
        </div>
      </div>
      <span class="hero-side-note" aria-hidden="true">LATITUDE · LONGITUDE · DISCOVERY</span>
    </section>

    <section class="signal-strip" aria-label="图志概览">
      <div class="signal-inner">
        <div class="signal-item"><div class="signal-value">{{ formatCount(dataMeta.recordCount) }}<sup>PORTS</sup></div><div class="signal-label">真实港口档案</div></div>
        <div class="signal-item"><div class="signal-value">{{ dataMeta.countryCount }}<sup>COUNTRIES</sup></div><div class="signal-label">国家与地区</div></div>
        <div class="signal-item"><div class="signal-value">08<sup>REGIONS</sup></div><div class="signal-label">全球地理分区</div></div>
        <div class="signal-item"><div class="signal-value">2025.04<sup>SNAPSHOT</sup></div><div class="signal-label">公开静态数据版本</div></div>
      </div>
    </section>

    <section id="atlas" class="atlas-section">
      <div class="section-wrap">
        <div class="section-heading reveal">
          <div><p class="eyebrow">01 / The interactive atlas</p><h2>一张地图，抵达世界。</h2></div>
          <p class="heading-description">缩放海图，或按区域与关键词筛选。密集港口会自动聚合；点击标记或列表条目，即可查看对应的真实档案。</p>
        </div>
        <div class="atlas-toolbar reveal">
          <div class="atlas-search-wrap">
            <label class="sr-only" for="portSearch">按名称、国家、UN/LOCODE 或 WPI 编号搜索港口</label>
            <van-search
              id="portSearch"
              ref="atlasSearch"
              v-model="searchInput"
              autocomplete="off"
              placeholder="搜索港口、国家、UN/LOCODE 或 WPI 编号…"
              @search="searchAtlas"
            />
            <span class="search-key" aria-hidden="true">/</span>
          </div>
          <div class="result-summary" aria-live="polite">当前显示 <strong>{{ formatCount(filteredPorts.length) }}</strong> 座港口</div>
        </div>
        <div class="region-filters reveal" aria-label="按区域筛选">
          <van-button
            v-for="item in regions"
            :key="item"
            class="region-button"
            round
            size="small"
            :aria-pressed="region === item"
            @click="selectRegion(item)"
          >
            {{ item === '全部' ? '全部区域' : item }}
          </van-button>
        </div>
        <div class="atlas-shell reveal">
          <aside class="port-panel" aria-label="筛选后的港口列表">
            <div class="panel-head"><h3>港口列表</h3><span>Port directory</span></div>
            <div class="port-list">
              <template v-if="sidebarResults.length">
                <button
                  v-for="(port, index) in sidebarResults"
                  :key="port.id"
                  class="port-item"
                  type="button"
                  :aria-label="`查看${port.displayName}档案`"
                  @click="openPort(port.id)"
                >
                  <span class="port-number">{{ String(index + 1).padStart(2, '0') }}</span>
                  <span><span class="port-item-name">{{ port.displayName }}</span><span class="port-item-meta">{{ port.countryZh }} · {{ port.region }}</span></span>
                  <span class="port-item-code">{{ port.code }}</span>
                </button>
                <div v-if="filteredPorts.length > SIDEBAR_SIZE" class="list-limit">继续搜索可缩小范围，海图仍显示全部匹配港口。</div>
              </template>
              <van-empty v-else class="empty-list" image="search" description="没有找到匹配的港口，试试其他关键词或切换区域。" />
            </div>
            <div class="panel-foot">{{ panelFoot }}</div>
          </aside>
          <PortMap
            ref="portMap"
            :ports="ports"
            :results="filteredPorts"
            :selected-id="selectedId"
            @select="openPort"
          />
        </div>
      </div>
    </section>

    <section id="directory" class="directory">
      <div class="section-wrap">
        <div class="section-heading reveal">
          <div><p class="eyebrow">02 / Port index</p><h2>每一座港口，<br>都有真实档案。</h2></div>
          <p class="heading-description">从 UN/LOCODE 与 WPI 编号，到港型、水深和设施记录。每页展示 24 条档案，搜索与区域筛选始终作用于全部数据。</p>
        </div>
        <div class="index-meta reveal">
          <span>{{ indexStatus }}</span>
          <van-button class="clear-filters" size="mini" @click="clearFilters">清除筛选 ↗</van-button>
        </div>
        <div class="directory-list reveal">
          <template v-if="pageResults.length">
            <button
              v-for="(port, index) in pageResults"
              :key="port.id"
              class="directory-row"
              type="button"
              :aria-label="`打开${port.displayName}详情`"
              @click="openPort(port.id)"
            >
              <span class="directory-no">{{ String((page - 1) * PAGE_SIZE + index + 1).padStart(2, '0') }}</span>
              <span class="directory-port-name">{{ port.displayName }}<span class="directory-port-en">{{ port.name }}</span></span>
              <span class="directory-code">{{ port.code }}</span>
              <span class="directory-region">{{ port.countryZh }}<br>{{ port.region }}</span>
              <span class="directory-type">{{ typeLabels[port.type] || sizeLabels[port.size] || '港型未记录' }}</span>
              <span class="directory-tags">
                <van-tag v-for="tag in directoryTags(port)" :key="tag" class="directory-tag" round plain>{{ tag }}</van-tag>
              </span>
              <span class="row-arrow"><van-icon name="arrow" /></span>
            </button>
          </template>
          <van-empty v-else class="directory-empty" image="search" description="这片海域暂时没有结果，请更换搜索词或清除区域筛选。" />
        </div>
        <van-pagination
          v-if="filteredPorts.length > PAGE_SIZE"
          v-model="page"
          class="directory-pagination reveal"
          :total-items="filteredPorts.length"
          :items-per-page="PAGE_SIZE"
          :show-page-size="5"
          force-ellipses
          aria-label="港口索引分页"
          @change="handlePageChange"
        >
          <template #prev-text><van-icon name="arrow-left" /> 上一页</template>
          <template #next-text>下一页 <van-icon name="arrow" /></template>
        </van-pagination>
      </div>
    </section>

    <section id="about" class="manifesto">
      <div class="manifesto-grid">
        <div class="reveal">
          <p class="eyebrow">03 / Our perspective</p>
          <h2 class="manifesto-quote">The sea connects <em>what distance separates.</em><span class="cn-quote">海有距离，港无边界。</span></h2>
        </div>
        <div class="manifesto-copy reveal">
          <p>全球约八成的货物贸易量通过海运完成。每一座港口，都是观察世界经济的一扇窗：货物在此集散，文化在此相遇，城市因航线而生长。</p>
          <p>PORTUS 将 NGA World Port Index 的 2025 年 4 月版公开资料整理为可搜索的世界图志，收录 {{ formatCount(dataMeta.recordCount) }} 座港口。位置、港型、水深与设施字段来自该版本；中文别名、地理分区和设施标签为便于浏览而补充或归纳。</p>
          <p class="manifesto-note">这是公开基础资料的静态快照，不展示实时船位、到港船舶、拥堵或动态吞吐量。“未记录”不代表没有；参考坐标与港口参数不用于航海、靠泊、调度或船舶安全决策。港口、陆地数据与交互地图组件随网站本地打包，在线字体需要联网加载。</p>
        </div>
      </div>
      <div class="image-band reveal">
        <img :src="portTerminal" alt="停靠在码头的大型集装箱船与岸边起重机" loading="lazy">
        <div class="image-caption"><strong>Every port opens a new horizon.</strong><span>每一座港口，都通向新的地平线</span></div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div><span class="footer-brand">PORTUS</span> · 全球港口图志</div>
    <div class="footer-links">
      <a :href="dataNoticeUrl" target="_blank" rel="noreferrer">数据说明 / NGA · CC BY 4.0</a>
      <a href="https://github.com/aashishvanand/seaport-data-js" target="_blank" rel="noreferrer">汇编 / seaport-data-js</a>
      <a href="https://unsplash.com" target="_blank" rel="noreferrer">影像 / Unsplash</a>
      <a href="#atlas">返回海图 ↑</a>
      <span>© 2026 PORTUS</span>
    </div>
  </footer>

  <PortDrawer
    v-model:show="drawerShow"
    :port="selectedPort"
    @closed="handleDrawerClosed"
    @locate="locatePort"
  />
</template>
