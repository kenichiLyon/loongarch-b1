<template>
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">LoongArch · Kylin · LLM Assisted Assessment</p>
      <h1>软件实训成果智能核查评价与报表系统</h1>
      <p class="summary">
        面向学生提交、教师复核和课程统计的 PC Web 工作台，首版聚焦上传解析、规则核查、AI 初评、教师确认与报表导出闭环。
      </p>
      <div class="actions">
        <button>开始配置实训任务</button>
        <span>第 0 周治理已启动，下一步初始化业务模型。</span>
      </div>
    </section>

    <section class="grid" aria-label="核心能力">
      <article v-for="item in capabilities" :key="item.title" class="card">
        <span class="index">{{ item.index }}</span>
        <h2>{{ item.title }}</h2>
        <p>{{ item.description }}</p>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
const capabilities = [
  {
    index: '01',
    title: '成果上传与解析',
    description: '接收 Word、PDF、截图、代码包与 Git 链接，先确定性解析，再生成脱敏摘要。',
  },
  {
    index: '02',
    title: '规则核查 + LLM 初评',
    description: '规则引擎核查完整性，大模型辅助识别要求覆盖、逻辑风险和改进建议。',
  },
  {
    index: '03',
    title: '教师复核确认',
    description: '教师逐项改分、写评语并确认最终成绩，智能评价不直接替代人工裁定。',
  },
  {
    index: '04',
    title: '报表导出与审计',
    description: '生成学生、班级、课程统计报表，导出 Excel/PDF 并记录生成条件。',
  },
];
</script>
