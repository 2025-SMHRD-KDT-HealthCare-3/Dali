import { api } from './client'

export const chatApi = {
  sendMessage: (body)     => api.post('/chat/respond', body),
  sendAudio:   (formData) => api.postForm('/chat/audio', formData),
}
