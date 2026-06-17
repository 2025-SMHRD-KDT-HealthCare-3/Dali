import { api } from './client'

export const missionApi = {
  getMissions:     ()   => api.get('/missions'),
  completeMission: (id) => api.patch(`/missions/${id}`, {}),
}
