import { api } from './client'

export const emotionAlertApi = {
  getAlerts:    (page = 1) => api.get(`/emotion-alerts?page=${page}`),
  confirmAlert: (id)       => api.patch(`/emotion-alerts/${id}/confirm`, {}),
}
