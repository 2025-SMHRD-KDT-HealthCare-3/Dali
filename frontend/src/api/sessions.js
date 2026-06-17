import { api } from './client'

export const sessionApi = {
  startSession:    (selected_emotion) => api.post('/sessions', { selected_emotion }),
  endSession:      (id)               => api.patch(`/sessions/${id}/end`, {}),
  deleteAllSessions: ()               => api.delete('/sessions'),
}
