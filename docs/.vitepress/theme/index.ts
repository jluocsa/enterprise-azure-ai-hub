import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import AgentEvalBuilder from './components/AgentEvalBuilder.vue'
import ApimPolicyBuilder from './components/ApimPolicyBuilder.vue'
import BcpResidencyAdvisor from './components/BcpResidencyAdvisor.vue'
import CatalogExplorer from './components/CatalogExplorer.vue'
import HubHome from './components/HubHome.vue'
import IntakeScorecard from './components/IntakeScorecard.vue'
import PageBrief from './components/PageBrief.vue'
import PlaybookMeta from './components/PlaybookMeta.vue'
import PtuCalculator from './components/PtuCalculator.vue'
import StudioSuite from './components/StudioSuite.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('AgentEvalBuilder', AgentEvalBuilder)
    app.component('ApimPolicyBuilder', ApimPolicyBuilder)
    app.component('BcpResidencyAdvisor', BcpResidencyAdvisor)
    app.component('CatalogExplorer', CatalogExplorer)
    app.component('HubHome', HubHome)
    app.component('IntakeScorecard', IntakeScorecard)
    app.component('PageBrief', PageBrief)
    app.component('PlaybookMeta', PlaybookMeta)
    app.component('PtuCalculator', PtuCalculator)
    app.component('StudioSuite', StudioSuite)
  },
} satisfies Theme
