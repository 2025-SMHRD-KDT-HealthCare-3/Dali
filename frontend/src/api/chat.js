import { api } from './client'

export const chatApi = {
  sendMessage:  (body)     => api.post('/chat/respond', body),
  sendAudioStt: (formData) => api.postForm('/chat/audio/stt', formData),
}
