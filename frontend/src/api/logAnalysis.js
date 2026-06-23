import { api } from './client'

export const logAnalysisApi = {
  getLogAnalyses: (session_id) => api.get(`/log-analyses?session_id=${session_id}`),
}
