<template>
  <div class="voima-app m-4" theme="light">
    <!-- ── Exit / Save Dialog ── -->
    <v-dialog v-model="showExitDialog" max-width="480">
      <v-card class="ca-dialog-card">
        <div class="ca-dialog-head">Save & Continue Later?</div>
        <div class="ca-dialog-body">
          <p>
            Your progress has been saved automatically. You can return to this assessment at any
            time from your client dashboard.
          </p>
        </div>
        <div class="ca-dialog-footer">
          <v-btn class="voima-btn-ghost" @click="showExitDialog = false" elevation="0"
            >Stay here</v-btn
          >
          <v-btn class="voima-btn-primary" @click="goToDashboard" elevation="0"
            >Go to dashboard</v-btn
          >
        </div>
      </v-card>
    </v-dialog>

    <!-- ── Completion Dialog ── -->
    <v-dialog v-model="showCompleteDialog" max-width="520" persistent>
      <v-card class="ca-complete-card">
        <div class="ca-complete-icon-wrap">
          <div class="ca-score-ring" :class="ratingClass(healthRating)">
            <span class="ca-score-big">{{ Math.round(healthScore) }}</span>
            <span class="ca-score-denom">/100</span>
          </div>
        </div>
        <div class="ca-complete-title">Assessment Complete</div>
        <div class="ca-complete-rating" :class="ratingClass(healthRating)">
          {{ ratingLabel(healthRating) }}
        </div>
        <p class="ca-complete-hint">
          Your Voima compliance consultant will review these results and reach out within
          <strong>1–2 business days</strong> with a tailored action plan.
        </p>
        <div class="ca-complete-stats">
          <div class="ca-stat">
            <div class="ca-stat-value">{{ totalAnswered }}</div>
            <div class="ca-stat-label">Questions answered</div>
          </div>
          <div class="ca-stat">
            <div class="ca-stat-value ca-stat-danger">{{ totalGaps }}</div>
            <div class="ca-stat-label">Gaps identified</div>
          </div>
          <div class="ca-stat">
            <div class="ca-stat-value ca-stat-muted">{{ totalNA }}</div>
            <div class="ca-stat-label">Not applicable</div>
          </div>
        </div>
        <v-btn class="voima-btn-primary mt-5" @click="goToDashboard" elevation="0" block>
          <v-icon start>mdi-view-dashboard-outline</v-icon>
          View dashboard & gaps
        </v-btn>
      </v-card>
    </v-dialog>

    <div class="ca-root" v-if="!loading">
      <!-- ── Header ── -->
      <div class="ca-header">
        <div class="ca-header-inner">
          <div class="ca-header-left">
            <div class="ca-header-title">Compliance Assessment</div>
            <div class="ca-header-sub" v-if="assessment">{{ assessment.assessment_ref }}</div>
          </div>
          <div class="ca-header-center">
            <!-- <div class="ca-score-pill" :class="ratingClass(healthRating)">
              <span class="ca-score-pill-val">{{ Math.round(healthScore) }}</span>
              <span class="ca-score-pill-label">Health Score</span>
            </div> -->
          </div>
          <div class="ca-header-right">
            <div class="ca-autosave" v-if="saving">
              <v-progress-circular size="13" width="2" indeterminate color="#060d14" />
              <span>Saving…</span>
            </div>
            <div class="ca-autosave saved" v-else-if="lastSaved">
              <v-icon size="13" color="#060d14">mdi-check-circle-outline</v-icon>
              <span>Saved</span>
            </div>
            <v-btn
              color="success"
              class=""
              @click="showExitDialog = true"
              size="small"
              elevation="0"
            >
              Save & exit
            </v-btn>
          </div>
        </div>

        <!-- Module tab strip -->
        <div class="ca-tabs-wrap">
          <div class="ca-tabs-inner">
            <div
              v-for="(mod, i) in modules"
              :key="mod.id"
              class="ca-tab"
              :class="{
                active: activeModuleIndex === i,
                completed: moduleProgress(mod.id) === 100,
                partial: moduleProgress(mod.id) > 0 && moduleProgress(mod.id) < 100
              }"
              @click="goToModule(i)"
            >
              <div class="ca-tab-dot" />
              <span class="ca-tab-name">{{ mod.name }}</span>
              <span class="ca-tab-pct" v-if="moduleProgress(mod.id) > 0">
                {{ Math.round(moduleProgress(mod.id)) }}%
              </span>
            </div>
          </div>
        </div>

        <!-- Overall progress bar -->
        <div class="ca-overall-bar">
          <div class="ca-overall-fill" :style="{ width: overallProgress + '%' }" />
        </div>
      </div>

      <!-- ── Body ── -->
      <div class="ca-body">
        <div class="ca-layout">
          <!-- ── Left: Questions panel ── -->
          <div class="ca-questions-col">
            <div class="ca-module-header" v-if="activeModule">
              <div class="ca-module-badge">
                Module {{ activeModuleIndex + 1 }} of {{ modules.length }}
              </div>
              <h2 class="ca-module-title">{{ activeModule.name }}</h2>
              <p class="ca-module-desc" v-if="activeModule.description">
                {{ activeModule.description }}
              </p>
              <div class="ca-module-meta">
                <!-- <span class="ca-module-weight-pill">
                  {{ moduleWeight(activeModule) }}% of total score
                </span> -->
                <span class="ca-module-qcount">
                  {{ activeModuleQuestions.length }} question{{
                    activeModuleQuestions.length !== 1 ? 's' : ''
                  }}
                </span>
              </div>
            </div>

            <!-- Questions -->
            <div class="ca-question-list">
              <div
                v-for="(q, qi) in activeModuleQuestions"
                :key="q.id"
                class="ca-question-card"
                :class="{
                  answered: getResponse(q.id) !== null,
                  'is-yes': getResponse(q.id) === 'yes',
                  'is-no': getResponse(q.id) === 'no',
                  'is-na': getResponse(q.id) === 'na',
                  expanded: expandedQuestion === q.id,
                  critical: q.weight === 'critical'
                }"
                :id="`q-${q.id}`"
              >
                <div class="ca-question-head" @click="toggleExpand(q.id)">
                  <div class="ca-question-meta">
                    <span class="ca-qref">{{ q.question_ref }}</span>
                    <!-- <span class="ca-weight-badge" :class="`weight-${q.weight}`">
                      {{ q.weight }}
                    </span> -->
                    <!-- <span class="ca-pts">{{ q.points }}pt{{ q.points !== 1 ? 's' : '' }}</span> -->
                  </div>
                  <p class="ca-question-text">{{ q.question_text }}</p>
                  <div class="ca-question-status" v-if="getResponse(q.id)">
                    <v-icon
                      size="14"
                      :color="
                        getResponse(q.id) === 'yes'
                          ? '#22c55e'
                          : getResponse(q.id) === 'no'
                            ? '#ef4444'
                            : '#94a3b8'
                      "
                    >
                      {{
                        getResponse(q.id) === 'yes'
                          ? 'mdi-check-circle'
                          : getResponse(q.id) === 'no'
                            ? 'mdi-close-circle'
                            : 'mdi-minus-circle'
                      }}
                    </v-icon>
                    <span :class="`status-${getResponse(q.id)}`">{{
                      getResponse(q.id) === 'yes'
                        ? 'Yes'
                        : getResponse(q.id) === 'no'
                          ? 'No'
                          : 'N/A'
                    }}</span>
                  </div>
                </div>

                <!-- Response buttons -->
                <div class="ca-response-row">
                  <button
                    class="ca-resp-btn ca-resp-yes"
                    :class="{ active: getResponse(q.id) === 'yes' }"
                    @click.stop="setResponse(q, 'yes')"
                  >
                    <v-icon size="16">mdi-check</v-icon>
                    Yes
                  </button>
                  <button
                    class="ca-resp-btn ca-resp-no"
                    :class="{ active: getResponse(q.id) === 'no' }"
                    @click.stop="setResponse(q, 'no')"
                  >
                    <v-icon size="16">mdi-close</v-icon>
                    No
                  </button>
                  <button
                    class="ca-resp-btn ca-resp-na"
                    :class="{ active: getResponse(q.id) === 'na' }"
                    @click.stop="setResponse(q, 'na')"
                  >
                    <v-icon size="16">mdi-minus</v-icon>
                    N/A
                  </button>
                </div>

                <!-- Expanded: gap detail + notes + evidence -->
                <transition name="expand">
                  <div class="ca-question-expanded" v-if="expandedQuestion === q.id">
                    <!-- Gap alert (shown on 'no') -->
                    <div class="ca-gap-alert" v-if="getResponse(q.id) === 'no'">
                      <div class="ca-gap-alert-head">
                        <v-icon size="15" color="#ef4444">mdi-alert-circle-outline</v-icon>
                        Gap identified — remediation required
                      </div>
                      <p class="ca-gap-action">{{ q.remediation_action }}</p>
                      <div class="ca-evidence-hint" v-if="q.evidence_required">
                        <v-icon size="13">mdi-paperclip</v-icon>
                        Evidence required: <strong>{{ q.evidence_required }}</strong>
                      </div>
                    </div>

                    <!-- Evidence hint (on 'yes') -->
                    <div
                      class="ca-evidence-card"
                      v-if="getResponse(q.id) === 'yes' && q.evidence_required"
                    >
                      <v-icon size="14" color="#060d14">mdi-file-check-outline</v-icon>
                      <div>
                        <div class="ca-evidence-title">Evidence to retain</div>
                        <div class="ca-evidence-text">{{ q.evidence_required }}</div>
                      </div>
                    </div>

                    <!-- Notes -->
                    <div class="ca-notes-wrap">
                      <v-textarea
                        :model-value="getNotes(q.id)"
                        @update:model-value="setNotes(q.id, $event)"
                        label="Notes (optional)"
                        variant="outlined"
                        density="comfortable"
                        rows="2"
                        hide-details
                        class="ca-notes-field"
                        placeholder="Add context or observations…"
                      />
                    </div>
                  </div>
                </transition>
              </div>
            </div>

            <!-- Module nav footer -->
            <div class="ca-module-nav">
              <v-btn
                color="primary"
                variant="text"
                :disabled="activeModuleIndex === 0"
                @click="prevModule"
                elevation="0"
              >
                <v-icon start size="16">mdi-arrow-left</v-icon>
                Previous
              </v-btn>

              <div class="ca-module-nav-info">
                <div class="ca-module-nav-pct">
                  {{ Math.round(moduleProgress(activeModule?.id)) }}% answered
                </div>
              </div>

              <v-btn
                v-if="activeModuleIndex < modules.length - 1"
                class="voima-btn-primary"
                @click="nextModule"
                elevation="0"
              >
                Next module
                <v-icon end size="16">mdi-arrow-right</v-icon>
              </v-btn>

              <v-btn
                v-else
                class="voima-btn-success"
                :disabled="overallProgress < 100"
                :loading="submitting"
                @click="submitAssessment"
                elevation="0"
              >
                <v-icon start size="16">mdi-send-check</v-icon>
                Submit assessment
              </v-btn>
            </div>
          </div>

          <!-- ── Right: Score sidebar ── -->
          <!-- <div class="ca-sidebar">
            <div class="ca-sidebar-card ca-score-card">
              <div class="ca-sidebar-label">Live health score</div>
              <div class="ca-gauge-wrap">
                <svg viewBox="0 0 120 70" class="ca-gauge-svg">
                  <path
                    d="M10 65 A55 55 0 0 1 110 65"
                    fill="none"
                    stroke="#e2e8f0"
                    stroke-width="10"
                    stroke-linecap="round"
                  />
                  <path
                    d="M10 65 A55 55 0 0 1 110 65"
                    fill="none"
                    :stroke="gaugeColor"
                    stroke-width="10"
                    stroke-linecap="round"
                    :stroke-dasharray="`${gaugeArc} 173`"
                    class="ca-gauge-arc"
                  />
                  <text
                    x="60"
                    y="62"
                    text-anchor="middle"
                    font-size="22"
                    font-weight="700"
                    :fill="gaugeColor"
                  >
                    {{ Math.round(healthScore) }}
                  </text>
                </svg>
              </div>
              <div class="ca-rating-label" :class="ratingClass(healthRating)">
                {{ ratingLabel(healthRating) }}
              </div>
              <div class="ca-rating-sub">out of 100</div>
            </div>

            <div class="ca-sidebar-card">
              <div class="ca-sidebar-label">Module scores</div>
              <div class="ca-module-scores">
                <div
                  v-for="mod in modules"
                  :key="mod.id"
                  class="ca-mod-score-row"
                  @click="goToModule(modules.indexOf(mod))"
                >
                  <div class="ca-mod-score-left">
                    <div class="ca-mod-score-name">{{ mod.name }}</div>
                    <div class="ca-mod-score-bar-wrap">
                      <div
                        class="ca-mod-score-bar"
                        :style="{ width: moduleProgress(mod.id) + '%' }"
                        :class="moduleProgressClass(mod.id)"
                      />
                    </div>
                  </div>
                  <div class="ca-mod-score-right">
                    <span class="ca-mod-score-pct" :class="moduleProgressClass(mod.id)">
                      {{ Math.round(moduleProgress(mod.id)) }}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="ca-sidebar-card ca-gaps-card" v-if="totalGaps > 0">
              <div class="ca-sidebar-label">
                Gaps identified
                <span class="ca-gap-count-badge">{{ totalGaps }}</span>
              </div>
              <div class="ca-gaps-list">
                <div
                  v-for="gap in recentGaps.slice(0, 5)"
                  :key="gap.questionId"
                  class="ca-gap-item"
                  @click="scrollToQuestion(gap.questionId)"
                >
                  <div class="ca-gap-item-dot" :class="`weight-${gap.weight}`" />
                  <div class="ca-gap-item-text">
                    <div class="ca-gap-item-ref">{{ gap.ref }}</div>
                    <div class="ca-gap-item-desc">{{ gap.text }}</div>
                  </div>
                </div>
                <div class="ca-gaps-more" v-if="totalGaps > 5">+{{ totalGaps - 5 }} more gaps</div>
              </div>
            </div>

            <div class="ca-sidebar-card">
              <div class="ca-sidebar-label">Progress</div>
              <div class="ca-progress-stats">
                <div class="ca-prog-stat">
                  <div class="ca-prog-val ca-prog-yes">{{ totalYes }}</div>
                  <div class="ca-prog-lbl">Compliant</div>
                </div>
                <div class="ca-prog-stat">
                  <div class="ca-prog-val ca-prog-no">{{ totalGaps }}</div>
                  <div class="ca-prog-lbl">Gaps</div>
                </div>
                <div class="ca-prog-stat">
                  <div class="ca-prog-val ca-prog-na">{{ totalNA }}</div>
                  <div class="ca-prog-lbl">N/A</div>
                </div>
                <div class="ca-prog-stat">
                  <div class="ca-prog-val ca-prog-pending">{{ totalPending }}</div>
                  <div class="ca-prog-lbl">Pending</div>
                </div>
              </div>
            </div>
          </div> -->
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div class="ca-loading" v-else>
      <v-progress-circular size="36" width="3" indeterminate color="#060d14" />
      <p>Loading your compliance assessment…</p>
    </div>

    <!-- Snackbar -->
    <v-snackbar v-model="snack.show" :color="snack.color" :timeout="4000" location="bottom right">
      {{ snack.message }}
      <template #actions>
        <v-btn variant="text" @click="snack.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/services/supabase'

const route = useRoute()
const router = useRouter()

// ── State ──────────────────────────────────────────────────────────────────
const loading = ref(true)
const saving = ref(false)
const submitting = ref(false)
const lastSaved = ref(false)
const showExitDialog = ref(false)
const showCompleteDialog = ref(false)
const expandedQuestion = ref(null)
const activeModuleIndex = ref(0)

// Assessment data
const assessment = ref(null)
const modules = ref([]) // ordered modules applicable to this entity
const questions = ref([]) // all questions for this assessment
const responses = reactive({}) // { questionId: 'yes'|'no'|'na'|null }
const notes = reactive({}) // { questionId: string }

// Score
const healthScore = ref(0)
const healthRating = ref('needs_improvement')

// Snackbar
const snack = reactive({ show: false, message: '', color: 'error' })

// ── Route params ───────────────────────────────────────────────────────────
// Supports two entry points:
//   /assessment/:assessmentId          — returning user
//   /assessment/new/:applicationId     — fresh from onboarding
const assessmentId = computed(() => route.params.assessmentId || null)
const applicationId = computed(() => route.params.applicationId || null)

// ── Computed ──────────────────────────────────────────────────────────────
const activeModule = computed(() => modules.value[activeModuleIndex.value] || null)

const activeModuleQuestions = computed(() =>
  questions.value.filter((q) => q.module_id === activeModule.value?.id)
)

const getResponse = (qId) => responses[qId] ?? null
const getNotes = (qId) => notes[qId] ?? ''
const setNotes = (qId, val) => {
  notes[qId] = val
}

const moduleProgress = (moduleId) => {
  if (!moduleId) return 0
  const qs = questions.value.filter((q) => q.module_id === moduleId)
  if (!qs.length) return 0
  const answered = qs.filter((q) => responses[q.id] != null).length
  return (answered / qs.length) * 100
}

const moduleProgressClass = (moduleId) => {
  const pct = moduleProgress(moduleId)
  if (pct === 100) return 'pct-complete'
  if (pct >= 50) return 'pct-partial'
  if (pct > 0) return 'pct-started'
  return 'pct-none'
}

const overallProgress = computed(() => {
  if (!questions.value.length) return 0
  const answered = questions.value.filter((q) => responses[q.id] != null).length
  return Math.round((answered / questions.value.length) * 100)
})

const totalAnswered = computed(() => questions.value.filter((q) => responses[q.id] != null).length)
const totalYes = computed(() => questions.value.filter((q) => responses[q.id] === 'yes').length)
const totalGaps = computed(() => questions.value.filter((q) => responses[q.id] === 'no').length)
const totalNA = computed(() => questions.value.filter((q) => responses[q.id] === 'na').length)
const totalPending = computed(() => questions.value.filter((q) => responses[q.id] == null).length)

const recentGaps = computed(() =>
  questions.value
    .filter((q) => responses[q.id] === 'no')
    .sort((a, b) => {
      const w = { critical: 0, high: 1, medium: 2, low: 3 }
      return w[a.weight] - w[b.weight]
    })
    .map((q) => ({
      questionId: q.id,
      ref: q.question_ref,
      text: q.question_text.length > 60 ? q.question_text.slice(0, 60) + '…' : q.question_text,
      weight: q.weight
    }))
)

// ── Gauge ─────────────────────────────────────────────────────────────────
const gaugeArc = computed(() => Math.round((healthScore.value / 100) * 173))

const gaugeColor = computed(() => {
  const s = healthScore.value
  if (s >= 85) return '#22c55e'
  if (s >= 70) return '#84cc16'
  if (s >= 55) return '#f59e0b'
  if (s >= 40) return '#f97316'
  return '#ef4444'
})

// ── Rating helpers ─────────────────────────────────────────────────────────
const ratingLabel = (r) =>
  ({
    excellent: 'Excellent',
    healthy: 'Healthy',
    satisfactory: 'Satisfactory',
    needs_improvement: 'Needs Improvement',
    at_risk: 'At Risk',
    critical: 'Critical'
  })[r] || 'Pending'

const ratingClass = (r) =>
  ({
    excellent: 'rating-excellent',
    healthy: 'rating-healthy',
    satisfactory: 'rating-satisfactory',
    needs_improvement: 'rating-needs',
    at_risk: 'rating-risk',
    critical: 'rating-critical'
  })[r] || ''

const moduleWeight = (mod) => {
  if (!assessment.value || !mod) return 0
  const cat = assessment.value.entity_category
  const map = {
    regulated_financial: 'weight_regulated_financial',
    near_regulated_financial: 'weight_near_regulated',
    non_regulated: 'weight_non_regulated',
    other_regulated_non_financial: 'weight_other_regulated',
    other_non_financial: 'weight_other_non_financial'
  }
  return mod[map[cat]] || 0
}

// ── Score calculation (mirrors DB logic locally for live feedback) ─────────
const recalcScore = () => {
  if (!modules.value.length || !questions.value.length) return

  let totalWeightedScore = 0
  let totalWeight = 0

  for (const mod of modules.value) {
    const modQuestions = questions.value.filter((q) => q.module_id === mod.id)
    if (!modQuestions.length) continue

    const totalPts = modQuestions.reduce((sum, q) => sum + q.points, 0)
    if (!totalPts) continue

    // Only count answered questions (not na, not null)
    const earnedPts = modQuestions
      .filter((q) => responses[q.id] === 'yes')
      .reduce((sum, q) => sum + q.points, 0)

    const applicablePts = modQuestions
      .filter((q) => responses[q.id] === 'yes' || responses[q.id] === 'no')
      .reduce((sum, q) => sum + q.points, 0)

    const modScore = applicablePts > 0 ? (earnedPts / applicablePts) * 100 : 0

    const weight = moduleWeight(mod)
    totalWeightedScore += modScore * weight
    totalWeight += weight
  }

  healthScore.value = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0

  const s = healthScore.value
  if (s >= 90) healthRating.value = 'excellent'
  else if (s >= 75) healthRating.value = 'healthy'
  else if (s >= 60) healthRating.value = 'satisfactory'
  else if (s >= 45) healthRating.value = 'needs_improvement'
  else if (s >= 30) healthRating.value = 'at_risk'
  else healthRating.value = 'critical'
}

// ── Load assessment ────────────────────────────────────────────────────────
const loadOrCreateAssessment = async () => {
  loading.value = true
  try {
    if (assessmentId.value) {
      // Load existing
      const { data, error } = await supabase
        .from('compliance_assessments')
        .select('*')
        .eq('id', assessmentId.value)
        .single()
      if (error) throw error
      assessment.value = data

      // Load existing responses
      const { data: respData, error: respErr } = await supabase
        .from('assessment_responses')
        .select('question_id, response, notes')
        .eq('assessment_id', assessmentId.value)
      if (respErr) throw respErr
      for (const r of respData) {
        responses[r.question_id] = r.response
        if (r.notes) notes[r.question_id] = r.notes
      }
    } else if (applicationId.value) {
      // Create new assessment from application
      const payload = {
        p_application_id: applicationId.value
      }
      console.log('create assessment payload:', payload)
      const { data, error } = await supabase.rpc('create_assessment_from_application', payload)
      console.log('create assessment data:', data)
      console.log('create assessment error:', error)
      if (error) throw error
      console.log('create assessment error:', error)
      assessment.value = data
      // Load applicable modules
      await loadModulesAndQuestions()

      // Update URL without push so back button works
      router.replace({ name: 'assessment', params: { assessmentId: data.id } })
    }

    healthScore.value = assessment.value.health_score || 0
    healthRating.value = assessment.value.health_rating || 'needs_improvement'
  } catch (err) {
    console.log('load assessment error:', err)
  } finally {
    loading.value = false
  }
}

const loadModulesAndQuestions = async () => {
  const entityCat = assessment.value.entity_category

  console.log('loading modules for entity category:', entityCat)

  // Load modules applicable to this entity category
  const { data: modData, error: modErr } = await supabase
    .from('assessment_modules')
    .select(
      `
      *,
      module_entity_applicability!inner(entity_category)
    `
    )
    .eq('module_entity_applicability.entity_category', entityCat)
    .order('sort_order')

  console.log('modules data:', modData)
  console.log('modules error:', modErr)

  if (modErr) throw modErr
  if (!modData || modData.length === 0) {
    console.warn('No modules found for entity category:', entityCat)
    return
  }

  modules.value = modData

  const moduleIds = modData.map((m) => m.id)
  console.log('module ids:', moduleIds)

  // Load questions
  const { data: qData, error: qErr } = await supabase
    .from('assessment_questions')
    .select(
      `
      *,
      question_entity_applicability!inner(entity_category)
    `
    )
    .in('module_id', moduleIds)
    .eq('question_entity_applicability.entity_category', entityCat)
    .eq('is_active', true)
    .order('sort_order')

  console.log('questions data:', qData)
  console.log('questions error:', qErr)

  if (qErr) throw qErr
  questions.value = qData || []
}

// ── Save response ──────────────────────────────────────────────────────────
let saveTimer = null

const setResponse = async (question, value) => {
  // Toggle off if same value clicked
  if (responses[question.id] === value) {
    responses[question.id] = null
  } else {
    responses[question.id] = value
    // Auto-expand on 'no' to show gap info
    if (value === 'no') {
      expandedQuestion.value = question.id
    }
  }

  recalcScore()
  scheduleSave(question.id)
}

const scheduleSave = (questionId) => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveResponse(questionId), 600)
}

const saveResponse = async (questionId) => {
  if (!assessment.value?.id) return
  saving.value = true
  lastSaved.value = false
  try {
    const { error } = await supabase.rpc('upsert_assessment_response', {
      p_assessment_id: assessment.value.id,
      p_question_id: questionId,
      p_response: responses[questionId] || null,
      p_notes: notes[questionId] || null
    })
    if (error) throw error

    // Update assessment health score in DB
    await supabase
      .from('compliance_assessments')
      .update({
        health_score: healthScore.value,
        health_rating: healthRating.value,
        status: overallProgress.value > 0 ? 'in_progress' : 'not_started',
        updated_at: new Date().toISOString()
      })
      .eq('id', assessment.value.id)

    lastSaved.value = true
  } catch (err) {
    showSnack('Save failed: ' + err.message)
  } finally {
    saving.value = false
  }
}

// ── Submit assessment ─────────────────────────────────────────────────────
const submitAssessment = async () => {
  if (overallProgress.value < 100) {
    showSnack('Please answer all questions before submitting.')
    return
  }
  submitting.value = true
  try {
    const { error } = await supabase.rpc('submit_compliance_assessment', {
      p_assessment_id: assessment.value.id
    })
    if (error) throw error
    showCompleteDialog.value = true
  } catch (err) {
    showSnack('Submission failed: ' + err.message)
  } finally {
    submitting.value = false
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────
const goToModule = (i) => {
  activeModuleIndex.value = i
  expandedQuestion.value = null
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}

const nextModule = () => {
  if (activeModuleIndex.value < modules.value.length - 1) {
    goToModule(activeModuleIndex.value + 1)
  }
}

const prevModule = () => {
  if (activeModuleIndex.value > 0) {
    goToModule(activeModuleIndex.value - 1)
  }
}

const toggleExpand = (qId) => {
  expandedQuestion.value = expandedQuestion.value === qId ? null : qId
}

const scrollToQuestion = (qId) => {
  // First navigate to the correct module
  const q = questions.value.find((q) => q.id === qId)
  if (!q) return
  const modIdx = modules.value.findIndex((m) => m.id === q.module_id)
  if (modIdx !== -1 && modIdx !== activeModuleIndex.value) {
    goToModule(modIdx)
  }
  nextTick(() => {
    const el = document.getElementById(`q-${qId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      expandedQuestion.value = qId
    }
  })
}

const goToDashboard = () => {
  router.push({ name: 'dashboard' })
}

// ── Snackbar ──────────────────────────────────────────────────────────────
const showSnack = (message, color = 'error') => {
  snack.message = message
  snack.color = color
  snack.show = true
}

// ── Init ──────────────────────────────────────────────────────────────────
onMounted(loadOrCreateAssessment)
</script>

<style>
.voima-app,
.voima-app .v-application__wrap {
  background: #f5f7fa !important;
}
.v-tn {
  text-transform: none;
}
</style>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────────────── */
:root {
  --ca-teal: #060d14;
  --ca-ink: #0f172a;
  --ca-muted: #0356c9;
  --ca-subtle: #94a3b8;
  --ca-border: #00295f;
  --ca-border-d: #0b315f;
  --ca-surface: #ffffff;
  --ca-bg: #f5f7fa;
  --ca-yes: #22c55e;
  --ca-no: #ef4444;
  --ca-na: #94a3b8;
  --ca-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.06);
}

.ca-root {
  min-height: 100vh;
  background: var(--ca-bg);
  color: var(--ca-ink);
  padding-bottom: 60px;
}

/* ── Loading ─────────────────────────────────────────────────────────────── */
.ca-loading {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--ca-muted);
  font-size: 14px;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.ca-header {
  background: white;
  border-bottom: 1px solid var(--ca-border);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow:
    0 1px 0 var(--ca-border),
    0 2px 8px rgba(0, 0, 0, 0.04);
}
.ca-header-inner {
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 20px;
}
.ca-header-left {
  flex: 1;
  min-width: 0;
}
.ca-header-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ca-ink);
}
.ca-header-sub {
  font-size: 11px;
  color: var(--ca-muted);
  letter-spacing: 0.04em;
  margin-top: 1px;
}
.ca-header-center {
  display: flex;
  justify-content: center;
}
.ca-header-right {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
}

.ca-score-pill {
  display: flex;
  align-items: baseline;
  gap: 4px;
  background: #f1f5f9;
  border-radius: 99px;
  padding: 6px 14px;
  border: 1px solid var(--ca-border);
}
.ca-score-pill-val {
  font-size: 18px;
  font-weight: 800;
}
.ca-score-pill-label {
  font-size: 11px;
  color: var(--ca-muted);
}

.ca-autosave {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--ca-muted);
}
.ca-autosave.saved {
  color: var(--ca-teal);
}

/* ── Tab strip ────────────────────────────────────────────────────────────── */
.ca-tabs-wrap {
  border-top: 1px solid var(--ca-border);
  overflow-x: auto;
  scrollbar-width: none;
}
.ca-tabs-wrap::-webkit-scrollbar {
  display: none;
}
.ca-tabs-inner {
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  gap: 2px;
}
.ca-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ca-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}
.ca-tab:hover {
  color: var(--ca-ink);
}
.ca-tab.active {
  color: blue;
  border-bottom-color: var(--ca-teal);
  font-weight: 700;
}
.ca-tab.completed {
  color: #22c55e;
}
.ca-tab.completed .ca-tab-dot {
  background: #22c55e;
}
.ca-tab.partial .ca-tab-dot {
  background: #f59e0b;
}
.ca-tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ca-border-d);
  flex-shrink: 0;
  transition: background 0.2s;
}
.ca-tab.active .ca-tab-dot {
  background: var(--ca-teal);
}
.ca-tab-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ca-tab-pct {
  font-size: 10px;
  opacity: 0.7;
}

/* Overall progress bar */
.ca-overall-bar {
  height: 2px;
  background: var(--ca-border);
}
.ca-overall-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #16a34a);
  transition: width 0.4s ease;
}

/* ── Body layout ──────────────────────────────────────────────────────────── */
.ca-body {
  margin: 24px auto;
  padding: 0 24px;
}
.ca-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
  align-items: start;
}
@media (max-width: 900px) {
  .ca-layout {
    grid-template-columns: 1fr;
  }
  .ca-sidebar {
    order: -1;
  }
}

/* ── Module header ─────────────────────────────────────────────────────────── */
.ca-module-header {
  margin-bottom: 20px;
}
.ca-module-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ca-muted);
  margin-bottom: 6px;
}
.ca-module-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--ca-ink);
  margin: 0 0 6px;
}
.ca-module-desc {
  font-size: 13px;
  color: var(--ca-muted);
  margin: 0 0 10px;
  line-height: 1.6;
}
.ca-module-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ca-module-weight-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 99px;
  background: #dbeafe;
  color: #1d4ed8;
}
.ca-module-qcount {
  font-size: 12px;
  color: var(--ca-muted);
}

/* ── Question cards ────────────────────────────────────────────────────────── */
.ca-question-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ca-question-card {
  margin: 20px;
  background: linear-gradient(180deg, #eef5ff 0%, #f5f9ff 100%);
  border: 1.5px solid #dbeafe;
  border-radius: 14px;
  overflow: hidden;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.ca-question-card:hover {
  border-color: var(--ca-border-d);
}
.ca-question-card.is-yes {
  border-color: rgba(34, 197, 94, 0.4);
}
.ca-question-card.is-no {
  border-color: rgba(239, 68, 68, 0.4);
}
.ca-question-card.is-na {
  border-color: rgba(148, 163, 184, 0.4);
}
.ca-question-card.critical {
  border-left: 3px solid #ef4444;
}

.ca-question-head {
  padding: 16px 18px 12px;
  cursor: pointer;
  user-select: none;
}
.ca-question-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.ca-qref {
  font-size: 11px;
  font-weight: 700;
  color: var(--ca-muted);
  letter-spacing: 0.05em;
}
.ca-weight-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.weight-critical {
  background: #fee2e2;
  color: #b91c1c;
}
.weight-high {
  background: #ffedd5;
  color: #c2410c;
}
.weight-medium {
  background: #fef9c3;
  color: #92400e;
}
.weight-low {
  background: #f0fdf4;
  color: #166534;
}

.ca-pts {
  font-size: 11px;
  color: var(--ca-subtle);
  margin-left: auto;
}

.ca-question-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--ca-ink);
  margin: 0 0 4px;
  line-height: 1.6;
}

.ca-question-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  margin-top: 4px;
}
.status-yes {
  color: #22c55e;
}
.status-no {
  color: #ef4444;
}
.status-na {
  color: var(--ca-subtle);
}

/* Response buttons */
.ca-response-row {
  display: flex;
  gap: 8px;
  padding: 0 18px 14px;
}
.ca-resp-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: 1.5px solid var(--ca-border);
  background: var(--ca-bg);
  color: var(--ca-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.ca-resp-btn:hover {
  border-color: var(--ca-border-d);
  color: var(--ca-ink);
}

.ca-resp-yes.active {
  background: #f0fdf4;
  border-color: #86efac;
  color: #16a34a;
}
.ca-resp-no.active {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #dc2626;
}
.ca-resp-na.active {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #64748b;
}

.ca-resp-yes:hover:not(.active) {
  border-color: #86efac;
  color: #16a34a;
}
.ca-resp-no:hover:not(.active) {
  border-color: #fca5a5;
  color: #dc2626;
}

/* ── Expanded content ──────────────────────────────────────────────────────── */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}

.ca-question-expanded {
  border-top: 1px solid var(--ca-border);
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fafcff;
}

.ca-gap-alert {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 10px;
  padding: 12px 14px;
}
.ca-gap-alert-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #dc2626;
  margin-bottom: 6px;
}
.ca-gap-action {
  font-size: 13px;
  color: #7f1d1d;
  margin: 0 0 6px;
  line-height: 1.6;
}
.ca-evidence-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #b91c1c;
}

.ca-evidence-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 10px 14px;
}
.ca-evidence-title {
  font-size: 12px;
  font-weight: 700;
  color: #14532d;
  margin-bottom: 2px;
}
.ca-evidence-text {
  font-size: 12px;
  color: #166534;
}

.ca-notes-wrap :deep(.v-field) {
  background: #ffffff !important;
}
.ca-notes-wrap :deep(.v-field__outline) {
  --v-field-border-color: #e2e8f0 !important;
}
.ca-notes-wrap :deep(.v-field--focused .v-field__outline) {
  --v-field-border-color: #060d14 !important;
}
.ca-notes-wrap :deep(.v-label) {
  color: #94a3b8 !important;
  font-size: 13px !important;
}
.ca-notes-wrap :deep(.v-field__input) {
  font-size: 13px !important;
  color: #0f172a !important;
}

/* ── Module nav footer ─────────────────────────────────────────────────────── */
.ca-module-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--ca-border);
}
.ca-module-nav-info {
  text-align: center;
}
.ca-module-nav-pct {
  font-size: 13px;
  color: var(--ca-muted);
  font-weight: 500;
}

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
.ca-sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: sticky;
  top: 160px;
}

.ca-sidebar-card {
  background: var(--ca-surface);
  border: 1px solid var(--ca-border);
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--ca-shadow);
}

.ca-sidebar-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ca-muted);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Score card */
.ca-score-card {
  text-align: center;
}
.ca-gauge-wrap {
  display: flex;
  justify-content: center;
}
.ca-gauge-svg {
  width: 130px;
  height: 80px;
}
.ca-gauge-arc {
  transition:
    stroke-dasharray 0.5s ease,
    stroke 0.5s ease;
}
.ca-rating-label {
  font-size: 15px;
  font-weight: 700;
  margin-top: 4px;
}
.ca-rating-sub {
  font-size: 12px;
  color: var(--ca-muted);
  margin-top: 2px;
}

/* Rating colors */
.rating-excellent {
  color: #16a34a !important;
}
.rating-healthy {
  color: #65a30d !important;
}
.rating-satisfactory {
  color: #d97706 !important;
}
.rating-needs {
  color: #ea580c !important;
}
.rating-risk {
  color: #dc2626 !important;
}
.rating-critical {
  color: #991b1b !important;
}

/* Score ring in complete dialog */
.ca-score-ring {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  border: 3px solid currentColor;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ca-score-big {
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
}
.ca-score-denom {
  font-size: 11px;
  opacity: 0.6;
}

/* Module scores */
.ca-module-scores {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ca-mod-score-row {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  border-radius: 6px;
  padding: 3px 2px;
  transition: background 0.15s;
}
.ca-mod-score-row:hover {
  background: #f8fafc;
}
.ca-mod-score-left {
  flex: 1;
  min-width: 0;
}
.ca-mod-score-name {
  font-size: 12px;
  color: var(--ca-ink);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ca-mod-score-bar-wrap {
  height: 4px;
  background: var(--ca-border);
  border-radius: 99px;
  overflow: hidden;
}
.ca-mod-score-bar {
  height: 100%;
  border-radius: 99px;
  transition: width 0.4s ease;
}
.pct-complete .ca-mod-score-bar {
  background: #22c55e;
}
.pct-partial .ca-mod-score-bar {
  background: #f59e0b;
}
.pct-started .ca-mod-score-bar {
  background: #94a3b8;
}
.pct-none .ca-mod-score-bar {
  background: var(--ca-border);
}

.ca-mod-score-right {
  flex-shrink: 0;
}
.ca-mod-score-pct {
  font-size: 11px;
  font-weight: 700;
}
.pct-complete {
  color: #22c55e !important;
}
.pct-partial {
  color: #f59e0b !important;
}
.pct-started {
  color: var(--ca-muted) !important;
}
.pct-none {
  color: var(--ca-subtle) !important;
}

/* Gaps */
.ca-gap-count-badge {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fca5a5;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 99px;
}
.ca-gaps-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ca-gap-item {
  display: flex;
  gap: 8px;
  cursor: pointer;
  padding: 6px 6px;
  border-radius: 6px;
  transition: background 0.15s;
}
.ca-gap-item:hover {
  background: #fef2f2;
}
.ca-gap-item-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}
.ca-gap-item-dot.weight-critical {
  background: #ef4444;
}
.ca-gap-item-dot.weight-high {
  background: #f97316;
}
.ca-gap-item-dot.weight-medium {
  background: #f59e0b;
}
.ca-gap-item-dot.weight-low {
  background: #84cc16;
}
.ca-gap-item-ref {
  font-size: 10px;
  font-weight: 700;
  color: var(--ca-muted);
}
.ca-gap-item-desc {
  font-size: 11px;
  color: var(--ca-ink);
  line-height: 1.4;
}
.ca-gaps-more {
  font-size: 11px;
  color: var(--ca-muted);
  text-align: center;
  padding: 4px;
}

/* Progress stats */
.ca-progress-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 8px;
  text-align: center;
}
.ca-prog-val {
  font-size: 18px;
  font-weight: 700;
}
.ca-prog-lbl {
  font-size: 10px;
  color: var(--ca-muted);
  margin-top: 2px;
}
.ca-prog-yes {
  color: #22c55e;
}
.ca-prog-no {
  color: #ef4444;
}
.ca-prog-na {
  color: var(--ca-subtle);
}
.ca-prog-pending {
  color: var(--ca-muted);
}

/* ── Dialogs ──────────────────────────────────────────────────────────────── */
.ca-dialog-card {
  background: #ffffff !important;
  border: 1px solid var(--ca-border) !important;
  border-radius: 16px !important;
  color: var(--ca-ink) !important;
}
.ca-dialog-head {
  padding: 20px 24px 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--ca-ink);
}
.ca-dialog-body {
  padding: 12px 24px;
  font-size: 14px;
  color: var(--ca-muted);
  line-height: 1.7;
}
.ca-dialog-footer {
  padding: 12px 24px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* Complete dialog */
.ca-complete-card {
  background: #ffffff !important;
  border: 1px solid var(--ca-border) !important;
  border-radius: 16px !important;
  color: var(--ca-ink) !important;
  padding: 32px 28px 28px;
  text-align: center;
}
.ca-complete-icon-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}
.ca-complete-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--ca-ink);
  margin-bottom: 4px;
}
.ca-complete-rating {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
}
.ca-complete-hint {
  font-size: 13px;
  color: var(--ca-muted);
  line-height: 1.7;
  margin-bottom: 16px;
}
.ca-complete-stats {
  display: flex;
  justify-content: center;
  gap: 28px;
  border-top: 1px solid var(--ca-border);
  padding-top: 16px;
}
.ca-stat {
  text-align: center;
}
.ca-stat-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--ca-ink);
}
.ca-stat-danger {
  color: #ef4444 !important;
}
.ca-stat-muted {
  color: var(--ca-muted) !important;
}
.ca-stat-label {
  font-size: 12px;
  color: var(--ca-muted);
  margin-top: 2px;
}
.mt-5 {
  margin-top: 20px;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.voima-btn-primary {
  background: #060d14 !important;
  color: #fff !important;
  font-weight: 700 !important;
  text-transform: none !important;
  border-radius: 10px !important;
  padding: 0 20px !important;
  height: 40px !important;
  font-size: 13px !important;
  letter-spacing: 0 !important;
}
.voima-btn-success {
  background: #16a34a !important;
  color: #fff !important;
  font-weight: 700 !important;
  text-transform: none !important;
  border-radius: 10px !important;
  padding: 0 20px !important;
  height: 40px !important;
  font-size: 13px !important;
  letter-spacing: 0 !important;
}
.voima-btn-ghost {
  color: rgb(4, 227, 4) !important;
  font-weight: 600 !important;
  text-transform: none !important;
  border-radius: 10px !important;
  height: 40px !important;
  font-size: 13px !important;
  letter-spacing: 0 !important;
}
.voima-btn-ghost:hover {
  color: var(--ca-ink) !important;
  background: #f1f5f9 !important;
}
</style>
