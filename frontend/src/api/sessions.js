import { api } from './client'

export const sessionApi = {
  startSession:      (selected_emotion) => api.post('/sessions', { selected_emotion }),
  endSession:        (id)               => api.patch(`/sessions/${id}/end`, {}),
  getSessions:       (page = 1)         => api.get(`/sessions?page=${page}`),
  getSessionById:    (id)               => api.get(`/sessions/${id}`),
  getSessionMessages:(id)               => api.get(`/sessions/${id}/messages`),
}
