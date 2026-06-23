import { api } from './client'

export const missionApi = {
  getMissions:  ()           => api.get('/missions'),
  setCompleted: (id, state)  => api.patch(`/missions/${id}`, { is_completed: state }),
}
