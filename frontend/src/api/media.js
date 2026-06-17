import { api } from './client'

export const mediaApi = {
  getMusic: (emotion) => api.get(`/media/music${emotion ? `?emotion=${emotion}` : ''}`),
  getVideo: (emotion) => api.get(`/media/video?emotion=${emotion}`),
}
